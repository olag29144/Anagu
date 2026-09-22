import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as path from 'path';
import { MintResult, RevocationGround } from './types';

/**
 * BlockchainService — ethers v6 integration with the Hyperledger Besu QBFT node.
 *
 * Responsibilities:
 *  - Initialise a `JsonRpcProvider` and a registrar `Wallet` on module start.
 *  - Load the `LandTitleNFT` contract ABI from the Hardhat artifacts directory.
 *  - Provide typed methods for minting NFT land titles, revoking them, and
 *    querying revocation status.
 *
 * References: Requirements 3.1, 3.2, 4.3, 4.4
 */
@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);

  private provider!: ethers.JsonRpcProvider;
  private registrarWallet!: ethers.Wallet;
  private landTitleNFT!: ethers.Contract;

  constructor(private readonly configService: ConfigService) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    this.provider = new ethers.JsonRpcProvider(
      this.configService.getOrThrow<string>('BESU_RPC_URL'),
    );

    this.registrarWallet = new ethers.Wallet(
      this.configService.getOrThrow<string>('REGISTRAR_PRIVATE_KEY'),
      this.provider,
    );

    // Load the LandTitleNFT ABI from the compiled Hardhat artifacts.
    // The artifacts directory only exists after `npx hardhat compile`, so we
    // gracefully skip initialisation when the file is absent (e.g. CI without
    // a contracts compile step).
    const contractAddress =
      this.configService.getOrThrow<string>('LAND_TITLE_NFT_ADDRESS');
    const abi: ethers.InterfaceAbi | null = this.loadAbi();

    if (abi === null) {
      this.logger.warn(
        'LandTitleNFT artifact not found — BlockchainService running without contract binding. ' +
          'Run `npx hardhat compile` in the contracts/ directory and restart.',
      );
      return;
    }

    this.landTitleNFT = new ethers.Contract(
      contractAddress,
      abi,
      this.registrarWallet,
    );

    this.logger.log(
      `BlockchainService connected to LandTitleNFT at ${contractAddress}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Mint a new ERC-721 land title NFT.
   *
   * Steps:
   *  1. Call `mint(to, parcelRef, keccak256(spatialHash), titleMetadata)` on
   *     the LandTitleNFT contract (registrar wallet).
   *  2. Wait for the transaction receipt.
   *  3. Parse the `TitleMinted` event from the receipt logs to extract `tokenId`.
   *  4. Call `setMintTxHash(tokenId, bytes32(txHash))` to record the hash on-chain.
   *  5. Return `{ tokenId, txHash }`.
   *
   * @param to            Recipient wallet address (titleholder).
   * @param parcelRef     Off-chain parcel reference string.
   * @param spatialHash   WKT geometry string; keccak256 is computed here.
   * @param titleMetadata IPFS CID or metadata URI.
   */
  async mintTitle(
    to: string,
    parcelRef: string,
    spatialHash: string,
    titleMetadata: string,
  ): Promise<MintResult> {
    this.assertContractReady();

    const spatialHashBytes = ethers.keccak256(ethers.toUtf8Bytes(spatialHash));

    const tx: ethers.ContractTransactionResponse =
      await (this.landTitleNFT.mint(
        to,
        parcelRef,
        spatialHashBytes,
        titleMetadata,
      ) as Promise<ethers.ContractTransactionResponse>);

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('mintTitle: transaction receipt was null');
    }

    // Extract tokenId from the TitleMinted event
    const tokenId = this.parseTitleMintedEvent(receipt);

    // Encode the receipt hash as bytes32 for setMintTxHash.
    // receipt.hash is a 0x-prefixed 32-byte hex string; we strip the prefix,
    // parse it as a BigInt, and zero-pad to 32 bytes.
    const txHashBytes32 = ethers.zeroPadValue(
      ethers.toBeArray(BigInt(receipt.hash)),
      32,
    );

    const setHashTx: ethers.ContractTransactionResponse =
      await (this.landTitleNFT.setMintTxHash(
        tokenId,
        txHashBytes32,
      ) as Promise<ethers.ContractTransactionResponse>);
    await setHashTx.wait();

    return { tokenId, txHash: receipt.hash };
  }

  /**
   * Statutorily revoke a land title under the Land Use Act (1978) s.28.
   *
   * The Governor's wallet is constructed on-the-fly from the supplied private key
   * so the registrar wallet is never used for governor-only operations.
   *
   * @param tokenId           The ERC-721 token to revoke.
   * @param ground            Revocation ground (0 = OverridingPublicInterest,
   *                          1 = BreachOfStatutoryCondition).
   * @param governorPrivateKey Hex private key of the Governor's address.
   * @returns The transaction hash of the confirmed revocation.
   */
  async revokeTitle(
    tokenId: bigint,
    ground: RevocationGround,
    governorPrivateKey: string,
  ): Promise<string> {
    this.assertContractReady();

    const governorWallet = new ethers.Wallet(
      governorPrivateKey,
      this.provider,
    );

    const governorContract = this.landTitleNFT.connect(
      governorWallet,
    ) as ethers.Contract;

    const tx: ethers.ContractTransactionResponse =
      await (governorContract.revoke(
        tokenId,
        ground,
      ) as Promise<ethers.ContractTransactionResponse>);

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('revokeTitle: transaction receipt was null');
    }

    return receipt.hash;
  }

  /**
   * Query whether a given token has been revoked.
   *
   * @param tokenId The ERC-721 token to check.
   * @returns `true` if the token has been revoked, `false` otherwise.
   */
  async isRevoked(tokenId: bigint): Promise<boolean> {
    this.assertContractReady();
    return this.landTitleNFT.isRevoked(tokenId) as Promise<boolean>;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Load the LandTitleNFT ABI from the compiled Hardhat artifacts.
   * Returns `null` if the file does not exist yet.
   */
  private loadAbi(): ethers.InterfaceAbi | null {
    const artifactsPath = path.resolve(
      __dirname,
      '../../../contracts/artifacts/contracts/LandTitleNFT.sol/LandTitleNFT.json',
    );

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const artifact = require(artifactsPath) as { abi: ethers.InterfaceAbi };
      return artifact.abi;
    } catch {
      return null;
    }
  }

  /**
   * Parse the `TitleMinted` event from a transaction receipt to extract `tokenId`.
   * Throws if the event is not found (indicates a contract mismatch or ABI issue).
   */
  private parseTitleMintedEvent(
    receipt: ethers.TransactionReceipt,
  ): bigint {
    for (const log of receipt.logs) {
      try {
        const parsed = this.landTitleNFT.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsed?.name === 'TitleMinted') {
          return parsed.args.tokenId as bigint;
        }
      } catch {
        // Skip unparseable logs from other contracts
      }
    }

    throw new Error(
      'mintTitle: TitleMinted event not found in transaction receipt logs',
    );
  }

  /**
   * Assert that the contract binding was successfully initialised.
   * Throws a descriptive error if `onModuleInit` could not load the ABI.
   */
  private assertContractReady(): void {
    if (!this.landTitleNFT) {
      throw new Error(
        'BlockchainService: LandTitleNFT contract is not initialised. ' +
          'Ensure the contracts are compiled and LAND_TITLE_NFT_ADDRESS is set.',
      );
    }
  }
}
