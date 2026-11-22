import { ethers, type ContractRunner, type Eip1193Provider as EthersEip1193Provider } from 'ethers';
import {
  LAND_FEE_TOKEN_ABI,
  LAND_FEE_TOKEN_ADDRESS,
  LAND_REGISTRY_ABI,
  LAND_REGISTRY_ADDRESS,
  LAND_TITLE_NFT_ABI,
  LAND_TITLE_NFT_ADDRESS,
  ContractFeeType,
  ContractRevocationGround,
} from './contracts';

export interface IntegratedTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  loadedFromChain: boolean;
}

export interface IntegratedTokenBalance {
  address: string;
  balanceWei: bigint;
  balanceFormatted: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface PayLandWithTokenResult {
  txHash: string;
  amountWei: bigint;
  amountFormatted: string;
  symbol: string;
  name: string;
  decimals: number;
  recipient: string;
  payer: string;
  tokenAddress: string;
}

const FALLBACK_TOKEN_SYMBOL =
  process.env.NEXT_PUBLIC_LAND_FEE_TOKEN_SYMBOL?.trim() || 'LFEE';

export const DEFAULT_INTEGRATED_TOKEN_INFO: IntegratedTokenInfo = {
  address: LAND_FEE_TOKEN_ADDRESS,
  name: 'LandFeeToken',
  symbol: FALLBACK_TOKEN_SYMBOL,
  decimals: 18,
  loadedFromChain: false,
};

const TOKEN_META_CACHE_KEY = `anagu_token_meta_${LAND_FEE_TOKEN_ADDRESS.toLowerCase()}`;
let memoryCachedTokenInfo: IntegratedTokenInfo | null = null;

export function getCachedIntegratedTokenInfo(): IntegratedTokenInfo {
  if (memoryCachedTokenInfo) {
    return memoryCachedTokenInfo;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(TOKEN_META_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<IntegratedTokenInfo>;
        if (parsed.symbol && typeof parsed.decimals === 'number') {
          const resolvedSymbol =
            !parsed.loadedFromChain && parsed.symbol === 'FEE'
              ? FALLBACK_TOKEN_SYMBOL
              : parsed.symbol;
          memoryCachedTokenInfo = {
            address: LAND_FEE_TOKEN_ADDRESS,
            name: parsed.name || DEFAULT_INTEGRATED_TOKEN_INFO.name,
            symbol: resolvedSymbol,
            decimals: parsed.decimals,
            loadedFromChain: Boolean(parsed.loadedFromChain),
          };
          return memoryCachedTokenInfo;
        }
      }
    } catch {
      // Ignore cache read error
    }
  }
  return DEFAULT_INTEGRATED_TOKEN_INFO;
}

function saveCachedIntegratedTokenInfo(info: IntegratedTokenInfo): void {
  memoryCachedTokenInfo = info;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TOKEN_META_CACHE_KEY, JSON.stringify(info));
      window.dispatchEvent(new Event('anagu-token-info-changed'));
    } catch {
      // Ignore storage error
    }
  }
}

export interface ContractRegistrySnapshot {
  chainId: string;
  feeTokenAddress: string;
  feeTokenName: string;
  feeTokenSymbol: string;
  feeTokenDecimals: number;
  feeTokenTotalSupply: string;
  feeTokenTreasury: string;
  titleNftAddress: string;
  titleNftName: string;
  titleNftSymbol: string;
  registryAddress: string;
  titlesIssued: string;
  transfersCompleted: string;
  totalFeesCollected: string;
  registrationFeeWei: bigint;
  registrationFeeFormatted: string;
  transferFeeWei: bigint;
  transferFeeFormatted: string;
}

export interface WalletOnChainProfile {
  address: string;
  feeTokenBalanceWei: bigint;
  feeTokenBalanceFormatted: string;
  feeTokenAllowanceWei: bigint;
  feeTokenAllowanceFormatted: string;
  nftBalance: string;
  isRegistrar: boolean;
  isGovernor: boolean;
  isFeeMinter: boolean;
  isRegistryAdmin: boolean;
}

export interface OnChainTitleRecord {
  tokenId: string;
  owner: string;
  parcelId: string;
  spatialHash: string;
  applicationId: string;
  issuedAt: number;
  uri: string;
  isRevoked: boolean;
  revocationGround: number;
  revokedAt: number;
}

export interface RegisterTitleOnChainResult {
  tokenId: string;
  txHash: string;
  approveTxHash?: string;
  applicationIdBytes32: string;
  parcelIdBytes32: string;
  spatialHashBytes32: string;
  feePaidFormatted: string;
}

export interface TransferTitleOnChainResult {
  tokenId: string;
  txHash: string;
  approveTxHash?: string;
  applicationIdBytes32: string;
  newOwner: string;
  feePaidFormatted: string;
}

export interface RevokeTitleOnChainResult {
  tokenId: string;
  ground: ContractRevocationGround;
  txHash: string;
}

export function getEthersBrowserProvider(
  eip1193Provider: EthersEip1193Provider,
): ethers.BrowserProvider {
  return new ethers.BrowserProvider(eip1193Provider);
}

export function getReadOnlyProvider(
  eip1193Provider?: EthersEip1193Provider | null,
): ethers.Provider {
  if (eip1193Provider) {
    return new ethers.BrowserProvider(eip1193Provider);
  }
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();
  if (rpcUrl) {
    return new ethers.JsonRpcProvider(rpcUrl);
  }
  if (typeof window !== 'undefined') {
    const win = window as unknown as { ethereum?: EthersEip1193Provider };
    if (win.ethereum) {
      return new ethers.BrowserProvider(win.ethereum);
    }
  }
  return new ethers.JsonRpcProvider('http://127.0.0.1:8545');
}

function hasReachableProviderHint(eip1193Provider?: EthersEip1193Provider | null): boolean {
  if (eip1193Provider) return true;
  if (process.env.NEXT_PUBLIC_RPC_URL?.trim()) return true;
  if (typeof window !== 'undefined') {
    const win = window as unknown as { ethereum?: EthersEip1193Provider };
    if (win.ethereum) return true;
  }
  return false;
}

export async function fetchIntegratedTokenInfo(
  eip1193Provider?: EthersEip1193Provider | null,
): Promise<IntegratedTokenInfo> {
  const cached = getCachedIntegratedTokenInfo();
  if (!hasReachableProviderHint(eip1193Provider)) {
    return cached;
  }

  try {
    const provider = getReadOnlyProvider(eip1193Provider);
    const feeToken = new ethers.Contract(
      LAND_FEE_TOKEN_ADDRESS,
      LAND_FEE_TOKEN_ABI,
      provider,
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Token metadata lookup timed out')), 4500);
    });

    const [nameRaw, symbolRaw, decimalsRaw] = await Promise.race([
      Promise.all([
        (feeToken.name() as Promise<string>).catch(() => cached.name),
        feeToken.symbol() as Promise<string>,
        (feeToken.decimals() as Promise<bigint>).catch(() => BigInt(cached.decimals)),
      ]),
      timeoutPromise,
    ]);

    const cleanSymbol = symbolRaw?.trim() || cached.symbol;
    const cleanName = nameRaw?.trim() || cached.name;
    const cleanDecimals = Number(decimalsRaw);

    const next: IntegratedTokenInfo = {
      address: LAND_FEE_TOKEN_ADDRESS,
      name: cleanName,
      symbol: cleanSymbol,
      decimals: Number.isFinite(cleanDecimals) && cleanDecimals >= 0 ? cleanDecimals : 18,
      loadedFromChain: true,
    };
    saveCachedIntegratedTokenInfo(next);
    return next;
  } catch {
    return cached;
  }
}

export async function fetchIntegratedTokenBalance(
  eip1193Provider: EthersEip1193Provider,
  ownerAddress: string,
): Promise<IntegratedTokenBalance> {
  const provider = getEthersBrowserProvider(eip1193Provider);
  const [network, code] = await Promise.all([
    provider.getNetwork(),
    provider.getCode(LAND_FEE_TOKEN_ADDRESS),
  ]);
  if (!code || code === '0x') {
    throw new Error(
      `Token contract ${LAND_FEE_TOKEN_ADDRESS} is not deployed on Chain ID ${network.chainId.toString()}. Switch your wallet network.`,
    );
  }

  const feeToken = new ethers.Contract(
    LAND_FEE_TOKEN_ADDRESS,
    LAND_FEE_TOKEN_ABI,
    provider,
  );
  const cached = getCachedIntegratedTokenInfo();

  const [balanceWei, decimalsRaw, symbolRaw, nameRaw] = await Promise.all([
    feeToken.balanceOf(ownerAddress) as Promise<bigint>,
    (feeToken.decimals() as Promise<bigint>).catch(() => BigInt(cached.decimals)),
    (feeToken.symbol() as Promise<string>).catch(() => cached.symbol),
    (feeToken.name() as Promise<string>).catch(() => cached.name),
  ]);

  const decimals = Number(decimalsRaw);
  const symbol = symbolRaw?.trim() || cached.symbol;
  const name = nameRaw?.trim() || cached.name;

  saveCachedIntegratedTokenInfo({
    address: LAND_FEE_TOKEN_ADDRESS,
    name,
    symbol,
    decimals,
    loadedFromChain: true,
  });

  return {
    address: LAND_FEE_TOKEN_ADDRESS,
    balanceWei,
    balanceFormatted: ethers.formatUnits(balanceWei, decimals),
    symbol,
    name,
    decimals,
  };
}

function formatAmountForParseUnits(amount: number | string, decimals: number): string {
  const safeDecimals = Math.min(Math.max(decimals, 0), 18);
  if (typeof amount === 'string') {
    const cleaned = amount.replace(/,/g, '').trim();
    if (!cleaned || Number(cleaned) <= 0 || Number.isNaN(Number(cleaned))) {
      return '0';
    }
    const parts = cleaned.split('.');
    if (parts.length === 1) return parts[0];
    return `${parts[0] || '0'}.${parts[1].slice(0, safeDecimals)}`.replace(/\.$/, '');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return '0';
  }
  const fixed = amount.toFixed(Math.min(safeDecimals, 6));
  return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

export async function payLandWithIntegratedToken(
  eip1193Provider: Eip1193ProviderLike,
  params: {
    recipientAddress?: string;
    tokenAmount: number | string;
    parcelRef?: string;
  },
): Promise<PayLandWithTokenResult> {
  await eip1193Provider.request({ method: 'eth_requestAccounts' }).catch(() => undefined);

  const provider = getEthersBrowserProvider(eip1193Provider);
  const signer = await provider.getSigner();
  const payer = await signer.getAddress();

  const [network, contractCode] = await Promise.all([
    provider.getNetwork(),
    provider.getCode(LAND_FEE_TOKEN_ADDRESS),
  ]);

  if (!contractCode || contractCode === '0x') {
    throw new Error(
      `Your wallet is on Chain ID ${network.chainId.toString()}, where token contract ${LAND_FEE_TOKEN_ADDRESS} is not deployed. Switch your wallet to the network hosting your token and click Pay again.`,
    );
  }

  const feeToken = new ethers.Contract(
    LAND_FEE_TOKEN_ADDRESS,
    LAND_FEE_TOKEN_ABI,
    signer,
  );
  const cached = getCachedIntegratedTokenInfo();

  const [decimalsRaw, symbolRaw, nameRaw] = await Promise.all([
    (feeToken.decimals() as Promise<bigint>).catch(() => BigInt(cached.decimals)),
    (feeToken.symbol() as Promise<string>).catch(() => cached.symbol),
    (feeToken.name() as Promise<string>).catch(() => cached.name),
  ]);

  const decimals = Number(decimalsRaw);
  const symbol = symbolRaw?.trim() || cached.symbol;
  const name = nameRaw?.trim() || cached.name;

  saveCachedIntegratedTokenInfo({
    address: LAND_FEE_TOKEN_ADDRESS,
    name,
    symbol,
    decimals,
    loadedFromChain: true,
  });

  const amountString = formatAmountForParseUnits(params.tokenAmount, decimals);
  const amountWei = ethers.parseUnits(amountString, decimals);
  if (amountWei <= BigInt(0)) {
    throw new Error(`Land purchase amount in ${symbol} must be greater than zero.`);
  }

  const currentBalance = (await feeToken.balanceOf(payer)) as bigint;
  if (currentBalance < amountWei) {
    const neededNum = Number(ethers.formatUnits(amountWei, decimals));
    const heldNum = Number(ethers.formatUnits(currentBalance, decimals));
    throw new Error(
      `Insufficient ${symbol} balance on Chain ID ${network.chainId.toString()}. This parcel costs ${neededNum.toLocaleString()} ${symbol}, but your wallet holds ${heldNum.toLocaleString()} ${symbol}.`,
    );
  }

  const recipient =
    params.recipientAddress && ethers.isAddress(params.recipientAddress)
      ? params.recipientAddress
      : LAND_REGISTRY_ADDRESS;

  const tx = (await feeToken.transfer(
    recipient,
    amountWei,
  )) as ethers.ContractTransactionResponse;
  const receipt = await tx.wait();

  return {
    txHash: receipt?.hash || tx.hash,
    amountWei,
    amountFormatted: ethers.formatUnits(amountWei, decimals),
    symbol,
    name,
    decimals,
    recipient,
    payer,
    tokenAddress: LAND_FEE_TOKEN_ADDRESS,
  };
}

type Eip1193ProviderLike = EthersEip1193Provider;

export function getContractInstances(runner: ContractRunner) {
  const feeToken = new ethers.Contract(
    LAND_FEE_TOKEN_ADDRESS,
    LAND_FEE_TOKEN_ABI,
    runner,
  );
  const titleNFT = new ethers.Contract(
    LAND_TITLE_NFT_ADDRESS,
    LAND_TITLE_NFT_ABI,
    runner,
  );
  const registry = new ethers.Contract(
    LAND_REGISTRY_ADDRESS,
    LAND_REGISTRY_ABI,
    runner,
  );
  return { feeToken, titleNFT, registry };
}

export function toBytes32Hash(value: string): string {
  const trimmed = value.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(trimmed));
}

export function computeParcelSpatialHash(input: {
  parcelRef: string;
  coordinates?: string;
  polygon?: Array<{ lat: number; lng: number }>;
}): string {
  const canonical =
    input.polygon && input.polygon.length >= 3
      ? `POLYGON((${input.polygon.map((p) => `${p.lng.toFixed(6)} ${p.lat.toFixed(6)}`).join(',')}))`
      : `${input.parcelRef}|${input.coordinates || 'NIGERIA_CADASTRE'}`;
  return ethers.keccak256(ethers.toUtf8Bytes(canonical));
}

export function formatContractError(err: unknown): string {
  if (!err) return 'Smart contract transaction failed.';

  const anyErr = err as {
    code?: string | number;
    shortMessage?: string;
    reason?: string;
    message?: string;
    data?: string;
  };

  if (anyErr.code === 'ACTION_REJECTED' || anyErr.code === 4001) {
    return 'Transaction was rejected in your Web3 wallet.';
  }

  // Try decoding custom errors across all 3 ABIs
  const rawData = typeof anyErr.data === 'string' ? anyErr.data : undefined;
  if (rawData && rawData.startsWith('0x') && rawData.length >= 10) {
    const interfaces = [
      new ethers.Interface(LAND_REGISTRY_ABI),
      new ethers.Interface(LAND_TITLE_NFT_ABI),
      new ethers.Interface(LAND_FEE_TOKEN_ABI),
    ];
    for (const iface of interfaces) {
      try {
        const parsed = iface.parseError(rawData);
        if (parsed) {
          if (parsed.name === 'AccessControlUnauthorizedAccount') {
            return `Unauthorized wallet (${String(parsed.args[0]).slice(0, 10)}…): missing required on-chain role (${String(parsed.args[1]).slice(0, 10)}…).`;
          }
          if (parsed.name === 'ERC20InsufficientBalance') {
            return `Insufficient LandFeeToken balance: need ${ethers.formatUnits(parsed.args[2] as bigint, 18)} tokens, have ${ethers.formatUnits(parsed.args[1] as bigint, 18)}.`;
          }
          if (parsed.name === 'ERC20InsufficientAllowance') {
            return `Insufficient LandFeeToken allowance for LandRegistry. Please approve tokens first.`;
          }
          if (parsed.name === 'ERC721NonexistentToken') {
            return `LandTitleNFT Token #${String(parsed.args[0])} does not exist on-chain.`;
          }
          return `Contract reverted with ${parsed.name}.`;
        }
      } catch {
        // Check next interface
      }
    }
  }

  if (anyErr.reason) return anyErr.reason;
  if (anyErr.shortMessage) return anyErr.shortMessage;
  if (anyErr.message) return anyErr.message;
  return 'Smart contract interaction failed.';
}

export async function fetchContractRegistrySnapshot(
  eip1193Provider?: EthersEip1193Provider | null,
): Promise<ContractRegistrySnapshot> {
  const provider = getReadOnlyProvider(eip1193Provider);
  const { feeToken, titleNFT, registry } = getContractInstances(provider);

  const network = await provider.getNetwork();
  const chainId = `0x${network.chainId.toString(16)}`;

  const [
    feeTokenName,
    feeTokenSymbol,
    feeTokenDecimalsRaw,
    feeTokenTotalSupplyRaw,
    feeTokenTreasury,
    titleNftName,
    titleNftSymbol,
    titlesIssuedRaw,
    transfersCompletedRaw,
    totalFeesCollectedRaw,
    registrationFeeWei,
    transferFeeWei,
  ] = await Promise.all([
    feeToken.name() as Promise<string>,
    feeToken.symbol() as Promise<string>,
    feeToken.decimals() as Promise<bigint>,
    feeToken.totalSupply() as Promise<bigint>,
    feeToken.treasury() as Promise<string>,
    titleNFT.name() as Promise<string>,
    titleNFT.symbol() as Promise<string>,
    registry.titlesIssued() as Promise<bigint>,
    registry.transfersCompleted() as Promise<bigint>,
    registry.totalFeesCollected() as Promise<bigint>,
    registry.fees(ContractFeeType.Registration) as Promise<bigint>,
    registry.fees(ContractFeeType.Transfer) as Promise<bigint>,
  ]);

  const decimals = Number(feeTokenDecimalsRaw);

  return {
    chainId,
    feeTokenAddress: LAND_FEE_TOKEN_ADDRESS,
    feeTokenName,
    feeTokenSymbol,
    feeTokenDecimals: decimals,
    feeTokenTotalSupply: ethers.formatUnits(feeTokenTotalSupplyRaw, decimals),
    feeTokenTreasury,
    titleNftAddress: LAND_TITLE_NFT_ADDRESS,
    titleNftName,
    titleNftSymbol,
    registryAddress: LAND_REGISTRY_ADDRESS,
    titlesIssued: titlesIssuedRaw.toString(),
    transfersCompleted: transfersCompletedRaw.toString(),
    totalFeesCollected: ethers.formatUnits(totalFeesCollectedRaw, decimals),
    registrationFeeWei,
    registrationFeeFormatted: ethers.formatUnits(registrationFeeWei, decimals),
    transferFeeWei,
    transferFeeFormatted: ethers.formatUnits(transferFeeWei, decimals),
  };
}

export async function fetchWalletOnChainProfile(
  eip1193Provider: EthersEip1193Provider,
  address: string,
): Promise<WalletOnChainProfile> {
  const provider = getEthersBrowserProvider(eip1193Provider);
  const { feeToken, titleNFT, registry } = getContractInstances(provider);

  const [
    decimalsRaw,
    balanceWei,
    allowanceWei,
    nftBalanceRaw,
    registrarRole,
    governorRole,
    minterRole,
    defaultAdminRole,
  ] = await Promise.all([
    feeToken.decimals() as Promise<bigint>,
    feeToken.balanceOf(address) as Promise<bigint>,
    feeToken.allowance(address, LAND_REGISTRY_ADDRESS) as Promise<bigint>,
    titleNFT.balanceOf(address) as Promise<bigint>,
    registry.REGISTRAR_ROLE() as Promise<string>,
    titleNFT.GOVERNOR_ROLE() as Promise<string>,
    feeToken.MINTER_ROLE() as Promise<string>,
    registry.DEFAULT_ADMIN_ROLE() as Promise<string>,
  ]);

  const [isRegistrar, isGovernor, isFeeMinter, isRegistryAdmin] = await Promise.all([
    registry.hasRole(registrarRole, address) as Promise<boolean>,
    titleNFT.hasRole(governorRole, address) as Promise<boolean>,
    feeToken.hasRole(minterRole, address) as Promise<boolean>,
    registry.hasRole(defaultAdminRole, address) as Promise<boolean>,
  ]);

  const decimals = Number(decimalsRaw);

  return {
    address,
    feeTokenBalanceWei: balanceWei,
    feeTokenBalanceFormatted: ethers.formatUnits(balanceWei, decimals),
    feeTokenAllowanceWei: allowanceWei,
    feeTokenAllowanceFormatted: ethers.formatUnits(allowanceWei, decimals),
    nftBalance: nftBalanceRaw.toString(),
    isRegistrar,
    isGovernor,
    isFeeMinter,
    isRegistryAdmin,
  };
}

export async function verifyLandTitleOnChain(
  tokenIdOrParcelRef: string,
  eip1193Provider?: EthersEip1193Provider | null,
): Promise<OnChainTitleRecord | null> {
  const provider = getReadOnlyProvider(eip1193Provider);
  const { titleNFT } = getContractInstances(provider);

  const trimmed = tokenIdOrParcelRef.trim();
  if (!trimmed) return null;

  let resolvedTokenId: bigint;
  if (/^\d+$/.test(trimmed)) {
    resolvedTokenId = BigInt(trimmed);
  } else {
    const parcelBytes32 = toBytes32Hash(trimmed);
    resolvedTokenId = (await titleNFT.activeTokenOfParcel(parcelBytes32)) as bigint;
    if (resolvedTokenId === BigInt(0)) {
      return null;
    }
  }

  try {
    const [owner, titleData, isRevoked, revocationGround, revokedAt, uri] =
      await Promise.all([
        titleNFT.ownerOf(resolvedTokenId) as Promise<string>,
        titleNFT.titles(resolvedTokenId) as Promise<{
          parcelId: string;
          spatialHash: string;
          applicationId: string;
          issuedAt: bigint;
          uri: string;
        }>,
        titleNFT.isRevoked(resolvedTokenId) as Promise<boolean>,
        titleNFT.revocationGround(resolvedTokenId) as Promise<bigint>,
        titleNFT.revokedAt(resolvedTokenId) as Promise<bigint>,
        titleNFT.tokenURI(resolvedTokenId).catch(() => '') as Promise<string>,
      ]);

    return {
      tokenId: resolvedTokenId.toString(),
      owner,
      parcelId: titleData.parcelId,
      spatialHash: titleData.spatialHash,
      applicationId: titleData.applicationId,
      issuedAt: Number(titleData.issuedAt),
      uri: titleData.uri || uri,
      isRevoked,
      revocationGround: Number(revocationGround),
      revokedAt: Number(revokedAt),
    };
  } catch {
    return null;
  }
}

export async function approveLandFeeToken(
  eip1193Provider: EthersEip1193Provider,
  amountTokensOrWei: bigint | string,
): Promise<string> {
  const provider = getEthersBrowserProvider(eip1193Provider);
  const signer = await provider.getSigner();
  const { feeToken } = getContractInstances(signer);

  let amountWei: bigint;
  if (typeof amountTokensOrWei === 'bigint') {
    amountWei = amountTokensOrWei;
  } else {
    const decimals = Number((await feeToken.decimals()) as bigint);
    amountWei = ethers.parseUnits(amountTokensOrWei, decimals);
  }

  const tx = (await feeToken.approve(
    LAND_REGISTRY_ADDRESS,
    amountWei,
  )) as ethers.ContractTransactionResponse;
  const receipt = await tx.wait();
  return receipt?.hash || tx.hash;
}

export async function mintFeeTokenOnChain(
  eip1193Provider: EthersEip1193Provider,
  toAddress: string,
  amountTokens: string,
): Promise<string> {
  const provider = getEthersBrowserProvider(eip1193Provider);
  const signer = await provider.getSigner();
  const { feeToken } = getContractInstances(signer);
  const decimals = Number((await feeToken.decimals()) as bigint);
  const amountWei = ethers.parseUnits(amountTokens, decimals);

  const tx = (await feeToken.mint(
    toAddress,
    amountWei,
  )) as ethers.ContractTransactionResponse;
  const receipt = await tx.wait();
  return receipt?.hash || tx.hash;
}

export async function registerTitleOnChain(
  eip1193Provider: EthersEip1193Provider,
  params: {
    applicationRef: string;
    ownerAddress: string;
    parcelRef: string;
    spatialHash?: string;
    coordinates?: string;
    polygon?: Array<{ lat: number; lng: number }>;
    metadataUri: string;
  },
): Promise<RegisterTitleOnChainResult> {
  if (!ethers.isAddress(params.ownerAddress)) {
    throw new Error('A valid 0x titleholder Ethereum address is required for on-chain registration.');
  }

  const provider = getEthersBrowserProvider(eip1193Provider);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  const { feeToken, titleNFT, registry } = getContractInstances(signer);

  const applicationIdBytes32 = toBytes32Hash(params.applicationRef);
  const parcelIdBytes32 = toBytes32Hash(params.parcelRef);
  const spatialHashBytes32 = params.spatialHash
    ? toBytes32Hash(params.spatialHash)
    : computeParcelSpatialHash({
        parcelRef: params.parcelRef,
        coordinates: params.coordinates,
        polygon: params.polygon,
      });

  const [decimalsRaw, registrationFeeWei, currentAllowance, currentBalance] =
    await Promise.all([
      feeToken.decimals() as Promise<bigint>,
      registry.fees(ContractFeeType.Registration) as Promise<bigint>,
      feeToken.allowance(signerAddress, LAND_REGISTRY_ADDRESS) as Promise<bigint>,
      feeToken.balanceOf(signerAddress) as Promise<bigint>,
    ]);

  const decimals = Number(decimalsRaw);
  let approveTxHash: string | undefined;

  if (registrationFeeWei > BigInt(0)) {
    if (currentBalance < registrationFeeWei) {
      throw new Error(
        `Insufficient LandFeeToken balance. Registration requires ${ethers.formatUnits(registrationFeeWei, decimals)} tokens, wallet holds ${ethers.formatUnits(currentBalance, decimals)}.`,
      );
    }
    if (currentAllowance < registrationFeeWei) {
      const approveTx = (await feeToken.approve(
        LAND_REGISTRY_ADDRESS,
        registrationFeeWei,
      )) as ethers.ContractTransactionResponse;
      const approveReceipt = await approveTx.wait();
      approveTxHash = approveReceipt?.hash || approveTx.hash;
    }
  }

  const tx = (await registry.registerTitle(
    applicationIdBytes32,
    params.ownerAddress,
    parcelIdBytes32,
    spatialHashBytes32,
    params.metadataUri,
  )) as ethers.ContractTransactionResponse;

  const receipt = await tx.wait();
  const txHash = receipt?.hash || tx.hash;

  let extractedTokenId = '';
  if (receipt) {
    for (const log of receipt.logs) {
      try {
        const parsedRegistry = registry.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsedRegistry?.name === 'RegistrationExecuted') {
          extractedTokenId = (parsedRegistry.args.tokenId as bigint).toString();
          break;
        }
      } catch {
        // Ignore non-registry logs
      }
      try {
        const parsedNft = titleNFT.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsedNft?.name === 'TitleIssued') {
          extractedTokenId = (parsedNft.args.tokenId as bigint).toString();
          break;
        }
      } catch {
        // Ignore non-NFT logs
      }
    }
  }

  if (!extractedTokenId) {
    const activeToken = (await titleNFT.activeTokenOfParcel(parcelIdBytes32)) as bigint;
    extractedTokenId = activeToken > BigInt(0) ? activeToken.toString() : '0';
  }

  return {
    tokenId: extractedTokenId,
    txHash,
    approveTxHash,
    applicationIdBytes32,
    parcelIdBytes32,
    spatialHashBytes32,
    feePaidFormatted: ethers.formatUnits(registrationFeeWei, decimals),
  };
}

export async function transferTitleOnChain(
  eip1193Provider: EthersEip1193Provider,
  params: {
    applicationRef: string;
    tokenId: string | bigint;
    newOwnerAddress: string;
  },
): Promise<TransferTitleOnChainResult> {
  if (!ethers.isAddress(params.newOwnerAddress)) {
    throw new Error('A valid 0x recipient Ethereum address is required.');
  }

  const provider = getEthersBrowserProvider(eip1193Provider);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  const { feeToken, registry } = getContractInstances(signer);

  const applicationIdBytes32 = toBytes32Hash(params.applicationRef);
  const tokenIdBigInt = BigInt(params.tokenId);

  const [decimalsRaw, transferFeeWei, currentAllowance, currentBalance] =
    await Promise.all([
      feeToken.decimals() as Promise<bigint>,
      registry.fees(ContractFeeType.Transfer) as Promise<bigint>,
      feeToken.allowance(signerAddress, LAND_REGISTRY_ADDRESS) as Promise<bigint>,
      feeToken.balanceOf(signerAddress) as Promise<bigint>,
    ]);

  const decimals = Number(decimalsRaw);
  let approveTxHash: string | undefined;

  if (transferFeeWei > BigInt(0)) {
    if (currentBalance < transferFeeWei) {
      throw new Error(
        `Insufficient LandFeeToken balance. Title transfer requires ${ethers.formatUnits(transferFeeWei, decimals)} tokens, wallet holds ${ethers.formatUnits(currentBalance, decimals)}.`,
      );
    }
    if (currentAllowance < transferFeeWei) {
      const approveTx = (await feeToken.approve(
        LAND_REGISTRY_ADDRESS,
        transferFeeWei,
      )) as ethers.ContractTransactionResponse;
      const approveReceipt = await approveTx.wait();
      approveTxHash = approveReceipt?.hash || approveTx.hash;
    }
  }

  const tx = (await registry.transferTitle(
    applicationIdBytes32,
    tokenIdBigInt,
    params.newOwnerAddress,
  )) as ethers.ContractTransactionResponse;

  const receipt = await tx.wait();

  return {
    tokenId: tokenIdBigInt.toString(),
    txHash: receipt?.hash || tx.hash,
    approveTxHash,
    applicationIdBytes32,
    newOwner: params.newOwnerAddress,
    feePaidFormatted: ethers.formatUnits(transferFeeWei, decimals),
  };
}

export async function revokeTitleOnChain(
  eip1193Provider: EthersEip1193Provider,
  tokenId: string | bigint,
  ground: ContractRevocationGround,
): Promise<RevokeTitleOnChainResult> {
  const provider = getEthersBrowserProvider(eip1193Provider);
  const signer = await provider.getSigner();
  const { titleNFT } = getContractInstances(signer);

  const tokenIdBigInt = BigInt(tokenId);
  const tx = (await titleNFT.revoke(
    tokenIdBigInt,
    ground,
  )) as ethers.ContractTransactionResponse;
  const receipt = await tx.wait();

  return {
    tokenId: tokenIdBigInt.toString(),
    ground,
    txHash: receipt?.hash || tx.hash,
  };
}
