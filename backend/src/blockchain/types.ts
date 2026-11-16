/**
 * Result returned after a successful LandTitleNFT mint transaction.
 */
export interface MintResult {
  /** The ERC-721 token ID assigned to the newly minted land title. */
  tokenId: bigint;
  /** The transaction hash of the confirmed mint transaction. */
  txHash: string;
}

/**
 * Statutory grounds for revocation under the Nigerian Land Use Act (1978) s.28.
 * Maps 1-to-1 to the Solidity `RevocationGround` enum in LandTitleNFT.sol.
 *
 *  0 — OverridingPublicInterest
 *  1 — BreachOfStatutoryCondition
 */
export type RevocationGround = 0 | 1;

/**
 * Result returned after a registry-controlled title transfer via LandRegistry.
 */
export interface TransferResult {
  oldTokenId: bigint;
  newTokenId: bigint;
  from: string;
  to: string;
  txHash: string;
}

/**
 * Detailed result returned when revoking a title with on-chain metrics.
 */
export interface RevocationResult {
  txHash: string;
  gasUsed: bigint;
  confirmationTimeMs: number;
}

