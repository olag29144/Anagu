import { ethers } from 'ethers';
import {
  LAND_FEE_TOKEN_ABI,
  LAND_FEE_TOKEN_ADDRESS,
  LAND_REGISTRY_ADDRESS,
} from './contracts';
import { formatContractError } from './ethers-contracts';

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isWalletLink?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isRabby?: boolean;
  isPhantom?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  isBraveWallet?: boolean;
  isRainbow?: boolean;
  isBitKeep?: boolean;
  isBitget?: boolean;
  isZerion?: boolean;
  isSafePal?: boolean;
  isTokenPocket?: boolean;
  isExodus?: boolean;
  isBackpack?: boolean;
  isEnkrypt?: boolean;
  isTally?: boolean;
  isTaho?: boolean;
  isFrame?: boolean;
  isOneInchIOSWallet?: boolean;
  isOneInchAndroidWallet?: boolean;
  isBinance?: boolean;
  isImToken?: boolean;
  isStatus?: boolean;
  isMathWallet?: boolean;
  isAlphaWallet?: boolean;
  isOpera?: boolean;
  isBybit?: boolean;
  providers?: Eip1193Provider[];
  detected?: Eip1193Provider[];
  providerMap?: Map<string, Eip1193Provider> | Record<string, Eip1193Provider>;
}

export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

export interface DetectedWalletProvider {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  source?: 'eip6963' | 'injected';
  provider: Eip1193Provider;
}

export interface ConnectedWalletState {
  address: string;
  chainId: string;
  chainName: string;
  balanceEth: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  tokenDecimals: number;
  tokenBalance: string;
  tokenDeployedOnChain: boolean;
  walletId: string;
  walletName: string;
  walletIcon?: string;
}

export interface MobileWalletDeepLink {
  id: string;
  name: string;
  subtitle: string;
  href: string;
  accentClass: string;
}

export const ANAGU_ESCROW_ADDRESS = LAND_REGISTRY_ADDRESS;

const CHAIN_NAMES: Record<string, string> = {
  '0x1': 'Ethereum Mainnet',
  '0xaa36a7': 'Sepolia Testnet',
  '0x89': 'Polygon Mainnet',
  '0x13882': 'Polygon Amoy',
  '0x38': 'BNB Smart Chain',
  '0xa4b1': 'Arbitrum One',
  '0xa': 'OP Mainnet',
  '0x2105': 'Base Mainnet',
  '0xa86a': 'Avalanche C-Chain',
  '0x539': 'Anagu Besu / Local (1337)',
  '0x7a69': 'Hardhat / Local (31337)',
};

export function getChainName(chainId: string): string {
  const normalized = chainId.toLowerCase();
  return CHAIN_NAMES[normalized] ?? `Chain ${parseInt(normalized, 16) || chainId}`;
}

export function formatShortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  // iPadOS Safari reports Macintosh with touch points > 1
  if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) {
    return true;
  }
  return false;
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export interface SwitchableNetworkOption {
  chainId: string;
  chainName: string;
  rpcUrls?: string[];
  nativeCurrency?: { name: string; symbol: string; decimals: number };
  blockExplorerUrls?: string[];
}

export const COMMON_EVM_NETWORKS: SwitchableNetworkOption[] = [
  {
    chainId: '0xaa36a7',
    chainName: 'Sepolia Testnet',
    rpcUrls: ['https://rpc.sepolia.org'],
    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
  },
  {
    chainId: '0x89',
    chainName: 'Polygon Mainnet',
    rpcUrls: ['https://polygon-rpc.com'],
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  {
    chainId: '0x2105',
    chainName: 'Base Mainnet',
    rpcUrls: ['https://mainnet.base.org'],
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://basescan.org'],
  },
  {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    blockExplorerUrls: ['https://bscscan.com'],
  },
  {
    chainId: '0x539',
    chainName: 'Anagu Besu / Local (1337)',
    rpcUrls: ['http://127.0.0.1:8545'],
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  },
];

export async function switchWalletNetwork(
  provider: Eip1193Provider,
  targetChainId: string,
): Promise<string> {
  const normalized = targetChainId.toLowerCase();
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: normalized }],
    });
    return normalized;
  } catch (err) {
    const errCode = (err as { code?: number })?.code;
    if (errCode === 4902) {
      const preset = COMMON_EVM_NETWORKS.find(
        (n) => n.chainId.toLowerCase() === normalized,
      );
      if (preset?.rpcUrls && preset.nativeCurrency) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: preset.chainId,
              chainName: preset.chainName,
              rpcUrls: preset.rpcUrls,
              nativeCurrency: preset.nativeCurrency,
              blockExplorerUrls: preset.blockExplorerUrls,
            },
          ],
        });
        return normalized;
      }
    }
    throw err;
  }
}

// ============================================================================
// Global EIP-6963 + Exhaustive Window / Mobile In-App Provider Detection
// ============================================================================

const eip6963Registry = new Map<string, DetectedWalletProvider>();
let globalListenerAttached = false;

function handleGlobalEip6963Announce(event: Event) {
  const customEvent = event as CustomEvent<Eip6963ProviderDetail>;
  const detail = customEvent.detail;
  if (!detail?.info?.uuid || !detail?.provider || typeof detail.provider.request !== 'function') {
    return;
  }

  eip6963Registry.set(detail.info.uuid, {
    id: detail.info.uuid,
    name: detail.info.name,
    icon: detail.info.icon,
    rdns: detail.info.rdns,
    source: 'eip6963',
    provider: detail.provider,
  });
}

function ensureGlobalEip6963Listener() {
  if (typeof window === 'undefined' || globalListenerAttached) return;
  globalListenerAttached = true;
  window.addEventListener('eip6963:announceProvider', handleGlobalEip6963Announce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

function inferLegacyWalletName(provider: Eip1193Provider, hint?: string): string {
  // Check specific non-MetaMask wallet flags BEFORE isMetaMask (many wallets spoof isMetaMask)
  if (provider.isRabby) return 'Rabby Wallet';
  if (provider.isPhantom) return 'Phantom Wallet';
  if (provider.isOkxWallet || provider.isOKExWallet) return 'OKX Wallet';
  if (provider.isTrust || provider.isTrustWallet) return 'Trust Wallet';
  if (provider.isCoinbaseWallet || provider.isWalletLink) return 'Coinbase Wallet';
  if (provider.isRainbow) return 'Rainbow Wallet';
  if (provider.isBraveWallet) return 'Brave Wallet';
  if (provider.isBitKeep || provider.isBitget) return 'Bitget Wallet';
  if (provider.isZerion) return 'Zerion Wallet';
  if (provider.isSafePal) return 'SafePal Wallet';
  if (provider.isTokenPocket) return 'TokenPocket';
  if (provider.isExodus) return 'Exodus Wallet';
  if (provider.isBackpack) return 'Backpack Wallet';
  if (provider.isEnkrypt) return 'Enkrypt Wallet';
  if (provider.isTally || provider.isTaho) return 'Taho Wallet';
  if (provider.isFrame) return 'Frame Wallet';
  if (provider.isOneInchIOSWallet || provider.isOneInchAndroidWallet) return '1inch Wallet';
  if (provider.isBinance) return 'Binance Web3 Wallet';
  if (provider.isImToken) return 'imToken Wallet';
  if (provider.isStatus) return 'Status Wallet';
  if (provider.isMathWallet) return 'MathWallet';
  if (provider.isAlphaWallet) return 'AlphaWallet';
  if (provider.isBybit) return 'Bybit Wallet';
  if (provider.isOpera) return 'Opera Crypto Wallet';
  if (provider.isMetaMask) return 'MetaMask';
  if (hint) return hint;
  return 'Web3 Browser Wallet';
}

function extractProviderMapEntries(
  providerMap: Eip1193Provider['providerMap'],
  push: (provider: Eip1193Provider | undefined, hint?: string) => void,
) {
  if (!providerMap) return;
  if (providerMap instanceof Map) {
    providerMap.forEach((prov, key) => {
      push(prov, typeof key === 'string' ? key : undefined);
    });
    return;
  }
  if (typeof providerMap === 'object') {
    Object.entries(providerMap).forEach(([key, prov]) => {
      push(prov, key);
    });
  }
}

function collectLegacyProviders(): DetectedWalletProvider[] {
  if (typeof window === 'undefined') return [];

  const win = window as unknown as {
    ethereum?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider };
    okxwallet?: Eip1193Provider;
    coinbaseWalletExtension?: Eip1193Provider;
    walletLinkExtension?: Eip1193Provider;
    trustwallet?: Eip1193Provider & { ethereum?: Eip1193Provider };
    trustWallet?: Eip1193Provider & { ethereum?: Eip1193Provider };
    rabby?: Eip1193Provider;
    bitkeep?: { ethereum?: Eip1193Provider };
    bitget?: { ethereum?: Eip1193Provider };
    zerionWallet?: Eip1193Provider;
    backpack?: { ethereum?: Eip1193Provider };
    bybitWallet?: Eip1193Provider;
    tokenpocket?: { ethereum?: Eip1193Provider };
    safepalProvider?: Eip1193Provider;
    safepal?: Eip1193Provider;
    exodus?: { ethereum?: Eip1193Provider };
    enkrypt?: { providers?: { ethereum?: Eip1193Provider } };
    braveEthereum?: Eip1193Provider;
    tally?: Eip1193Provider;
    taho?: Eip1193Provider;
    oneInch?: Eip1193Provider;
    $oneinch?: Eip1193Provider;
    rainbow?: Eip1193Provider;
    metamask?: Eip1193Provider;
    frame?: Eip1193Provider;
    binancew3w?: { ethereum?: Eip1193Provider };
  };

  const candidates: Array<{ provider: Eip1193Provider; hint?: string }> = [];
  const push = (provider: Eip1193Provider | undefined, hint?: string) => {
    if (!provider || typeof provider.request !== 'function') return;
    candidates.push({ provider, hint });
  };

  if (win.ethereum) {
    if (Array.isArray(win.ethereum.providers)) {
      win.ethereum.providers.forEach((p) => push(p));
    }
    if (Array.isArray(win.ethereum.detected)) {
      win.ethereum.detected.forEach((p) => push(p));
    }
    extractProviderMapEntries(win.ethereum.providerMap, push);
    push(win.ethereum);
  }

  push(win.phantom?.ethereum, 'Phantom Wallet');
  push(win.okxwallet, 'OKX Wallet');
  push(win.coinbaseWalletExtension, 'Coinbase Wallet');
  push(win.walletLinkExtension, 'Coinbase Wallet');
  push(win.trustwallet?.ethereum ?? win.trustwallet, 'Trust Wallet');
  push(win.trustWallet?.ethereum ?? win.trustWallet, 'Trust Wallet');
  push(win.rabby, 'Rabby Wallet');
  push(win.bitkeep?.ethereum, 'Bitget Wallet');
  push(win.bitget?.ethereum, 'Bitget Wallet');
  push(win.zerionWallet, 'Zerion Wallet');
  push(win.backpack?.ethereum, 'Backpack Wallet');
  push(win.bybitWallet, 'Bybit Wallet');
  push(win.tokenpocket?.ethereum, 'TokenPocket');
  push(win.safepalProvider ?? win.safepal, 'SafePal Wallet');
  push(win.exodus?.ethereum, 'Exodus Wallet');
  push(win.enkrypt?.providers?.ethereum, 'Enkrypt Wallet');
  push(win.braveEthereum, 'Brave Wallet');
  push(win.tally ?? win.taho, 'Taho Wallet');
  push(win.oneInch ?? win.$oneinch, '1inch Wallet');
  push(win.rainbow, 'Rainbow Wallet');
  push(win.metamask, 'MetaMask');
  push(win.frame, 'Frame Wallet');
  push(win.binancew3w?.ethereum, 'Binance Web3 Wallet');

  const unique: DetectedWalletProvider[] = [];
  const seenProviders = new Set<Eip1193Provider>();

  candidates.forEach(({ provider, hint }, index) => {
    if (seenProviders.has(provider)) return;
    seenProviders.add(provider);
    const name = inferLegacyWalletName(provider, hint);
    unique.push({
      id: `legacy-${name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
      name,
      source: 'injected',
      provider,
    });
  });

  return unique;
}

function getMergedDetectedWallets(
  localEip6963Map?: Map<string, DetectedWalletProvider>,
): DetectedWalletProvider[] {
  const eip6963List = Array.from((localEip6963Map ?? eip6963Registry).values());
  const merged: DetectedWalletProvider[] = [...eip6963List];
  const legacy = collectLegacyProviders();

  for (const item of legacy) {
    const alreadyIncluded = merged.some(
      (existing) =>
        existing.provider === item.provider ||
        (existing.source === 'eip6963' &&
          existing.name.toLowerCase() === item.name.toLowerCase()),
    );
    if (!alreadyIncluded) {
      merged.push(item);
    }
  }

  return merged;
}

/**
 * Synchronous snapshot of all already-announced EIP-6963 + injected browser/device wallets.
 */
export function getSnapshotDetectedWallets(): DetectedWalletProvider[] {
  if (typeof window === 'undefined') return [];
  ensureGlobalEip6963Listener();
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  return getMergedDetectedWallets();
}

/**
 * Actively requests EIP-6963 wallets + probes window injections (waiting briefly so late-injecting
 * desktop extensions or mobile DApp browsers all respond).
 */
export async function discoverAllWallets(waitMs = 450): Promise<DetectedWalletProvider[]> {
  if (typeof window === 'undefined') return [];
  ensureGlobalEip6963Listener();
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, waitMs);
  });

  window.dispatchEvent(new Event('eip6963:requestProvider'));
  return getMergedDetectedWallets();
}

/**
 * Discovers all EIP-6963 and legacy injected Web3 wallets synchronously + via multi-stage events.
 */
export function subscribeWalletDiscovery(
  onChange: (wallets: DetectedWalletProvider[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  ensureGlobalEip6963Listener();

  const emitMerged = () => {
    onChange(getMergedDetectedWallets());
  };

  const handleAnnounce = (event: Event) => {
    handleGlobalEip6963Announce(event);
    emitMerged();
  };

  const handleRequestAndEmit = () => {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    emitMerged();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      handleRequestAndEmit();
    }
  };

  window.addEventListener('eip6963:announceProvider', handleAnnounce);
  window.addEventListener('ethereum#initialized', handleRequestAndEmit);
  window.addEventListener('focus', handleRequestAndEmit);
  document.addEventListener('visibilitychange', handleVisibility);

  window.dispatchEvent(new Event('eip6963:requestProvider'));
  emitMerged();

  // Multi-stage delayed checks for browser extensions / mobile DApp browsers that inject after load
  const timer1 = window.setTimeout(handleRequestAndEmit, 150);
  const timer2 = window.setTimeout(handleRequestAndEmit, 600);
  const timer3 = window.setTimeout(handleRequestAndEmit, 1500);

  return () => {
    window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    window.removeEventListener('ethereum#initialized', handleRequestAndEmit);
    window.removeEventListener('focus', handleRequestAndEmit);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.clearTimeout(timer1);
    window.clearTimeout(timer2);
    window.clearTimeout(timer3);
  };
}

export function mapWalletError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as { code?: number | string; message?: string; shortMessage?: string };
    const code = anyErr.code;
    if (code === 4001 || code === 'ACTION_REJECTED') {
      return 'Wallet request was declined in your Web3 wallet.';
    }
    if (code === -32002) {
      return 'A wallet approval prompt is already waiting in your Web3 wallet extension or app. Open your wallet icon to approve it.';
    }
    if (
      code === 'BAD_DATA' ||
      anyErr.message?.includes('could not decode result data') ||
      anyErr.shortMessage?.includes('could not decode result data')
    ) {
      return 'Your connected wallet appears to be on a different blockchain network than your integrated token contract. Switch your wallet network to the chain where your token is deployed and try again.';
    }
  }
  return formatContractError(err);
}

const DEFAULT_LFEE_SYMBOL =
  process.env.NEXT_PUBLIC_LAND_FEE_TOKEN_SYMBOL?.trim() || 'LFEE';

/**
 * Prompts the connected Web3 wallet (EIP-747 `wallet_watchAsset`) to add/display the LFEE ERC-20 token.
 */
export async function watchLfeeTokenInWallet(
  provider: Eip1193Provider,
  options?: {
    address?: string;
    symbol?: string;
    decimals?: number;
  },
): Promise<boolean> {
  const tokenAddress = options?.address || LAND_FEE_TOKEN_ADDRESS;
  const symbol = (options?.symbol?.trim() || DEFAULT_LFEE_SYMBOL).slice(0, 11);
  const decimals = typeof options?.decimals === 'number' ? options.decimals : 18;

  const result = await provider.request({
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {
        address: tokenAddress,
        symbol,
        decimals,
      },
    },
  });

  return Boolean(result);
}

/**
 * Connects to the selected wallet via EIP-1193 (`eth_requestAccounts`), reads the LFEE token
 * contract (`LAND_FEE_TOKEN_ADDRESS`), and registers LFEE in the wallet UI where supported.
 */
export async function connectWalletProvider(
  wallet: DetectedWalletProvider,
): Promise<ConnectedWalletState> {
  await wallet.provider.request({ method: 'eth_requestAccounts' });
  const browserProvider = new ethers.BrowserProvider(wallet.provider);
  const signer = await browserProvider.getSigner();
  const address = await signer.getAddress();

  let chainId = '0x1';
  try {
    const network = await browserProvider.getNetwork();
    chainId = `0x${network.chainId.toString(16)}`;
  } catch {
    // Keep fallback chainId
  }

  let balanceEth = '0.0000';
  try {
    const balanceWei = await browserProvider.getBalance(address);
    balanceEth = Number(ethers.formatEther(balanceWei)).toFixed(4);
  } catch {
    // Ignore balance read failures on restricted RPCs
  }

  let tokenSymbol = DEFAULT_LFEE_SYMBOL;
  let tokenName = 'LandFeeToken';
  let tokenDecimals = 18;
  let tokenBalance = '0.0000';
  let tokenDeployedOnChain = false;

  try {
    const code = await browserProvider.getCode(LAND_FEE_TOKEN_ADDRESS);
    if (code && code !== '0x') {
      tokenDeployedOnChain = true;
      const feeToken = new ethers.Contract(
        LAND_FEE_TOKEN_ADDRESS,
        LAND_FEE_TOKEN_ABI,
        browserProvider,
      );
      const [balWei, symRaw, nameRaw, decRaw] = await Promise.all([
        feeToken.balanceOf(address) as Promise<bigint>,
        (feeToken.symbol() as Promise<string>).catch(() => DEFAULT_LFEE_SYMBOL),
        (feeToken.name() as Promise<string>).catch(() => 'LandFeeToken'),
        (feeToken.decimals() as Promise<bigint>).catch(() => BigInt(18)),
      ]);
      tokenDecimals = Number(decRaw);
      tokenSymbol = symRaw?.trim() || DEFAULT_LFEE_SYMBOL;
      tokenName = nameRaw?.trim() || 'LandFeeToken';
      const formatted = Number(ethers.formatUnits(balWei, tokenDecimals));
      tokenBalance = Number.isFinite(formatted)
        ? formatted.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })
        : '0.00';

      if (typeof window !== 'undefined') {
        const watchKey = `anagu_lfee_watched_${chainId.toLowerCase()}_${address.toLowerCase()}`;
        if (!localStorage.getItem(watchKey)) {
          localStorage.setItem(watchKey, '1');
          void watchLfeeTokenInWallet(wallet.provider, {
            address: LAND_FEE_TOKEN_ADDRESS,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
          }).catch(() => {
            // Wallet declined or doesn't support EIP-747; connection stays active
          });
        }
      }
    }
  } catch {
    // Token contract lookup skipped or on a different chain; handled cleanly in UI
  }

  return {
    address,
    chainId,
    chainName: getChainName(chainId),
    balanceEth,
    tokenSymbol,
    tokenName,
    tokenAddress: LAND_FEE_TOKEN_ADDRESS,
    tokenDecimals,
    tokenBalance,
    tokenDeployedOnChain,
    walletId: wallet.id,
    walletName: wallet.name,
    walletIcon: wallet.icon,
  };
}

export async function signLandPurchaseAuthorization(
  provider: Eip1193Provider,
  params: {
    address: string;
    parcelRef: string;
    landTitle: string;
    location: string;
    areaSqm: number;
    priceNgn: number;
    priceUsd?: number;
    priceToken?: number;
    tokenSymbol?: string;
    buyerName: string;
    sellerWalletAddress?: string;
  },
): Promise<string> {
  const recipientAddress =
    params.sellerWalletAddress && /^0x[a-fA-F0-9]{40}$/.test(params.sellerWalletAddress)
      ? params.sellerWalletAddress
      : ANAGU_ESCROW_ADDRESS;

  const resolvedUsd =
    params.priceUsd && params.priceUsd > 0
      ? params.priceUsd
      : Math.round((params.priceNgn || 0) / 1600);
  const resolvedToken =
    params.priceToken && params.priceToken > 0 ? params.priceToken : resolvedUsd;
  const symbol = params.tokenSymbol?.trim() || DEFAULT_LFEE_SYMBOL;

  const message = [
    'ANAGU STATUTORY LAND REGISTRY — PURCHASE AUTHORIZATION',
    '',
    `Parcel Ref: ${params.parcelRef}`,
    `Parcel Title: ${params.landTitle}`,
    `Location: ${params.location}`,
    `Area: ${params.areaSqm.toLocaleString()} sqm`,
    `Agreed Price: ${resolvedToken.toLocaleString()} ${symbol} (≈ $${resolvedUsd.toLocaleString()} USD)`,
    `Buyer: ${params.buyerName}`,
    `Buyer Wallet: ${params.address}`,
    `Recipient / Escrow: ${recipientAddress}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n');

  const browserProvider = new ethers.BrowserProvider(provider);
  const signer = await browserProvider.getSigner();
  const signature = await signer.signMessage(message);

  return signature;
}

export async function sendLandPurchaseTransaction(
  provider: Eip1193Provider,
  params: {
    address: string;
    parcelRef: string;
    priceNgn: number;
    priceUsd?: number;
    priceToken?: number;
    tokenSymbol?: string;
    sellerWalletAddress?: string;
  },
): Promise<string> {
  const recipientAddress =
    params.sellerWalletAddress && ethers.isAddress(params.sellerWalletAddress)
      ? params.sellerWalletAddress
      : ANAGU_ESCROW_ADDRESS;

  const resolvedUsd =
    params.priceUsd && params.priceUsd > 0
      ? params.priceUsd
      : Math.round((params.priceNgn || 0) / 1600);
  const resolvedToken =
    params.priceToken && params.priceToken > 0 ? params.priceToken : resolvedUsd;
  const symbol = params.tokenSymbol?.trim() || DEFAULT_LFEE_SYMBOL;

  const dataHex = ethers.hexlify(
    ethers.toUtf8Bytes(
      `anagu:purchase:${params.parcelRef}:token:${resolvedToken}:${symbol}:usd:${resolvedUsd}:${Date.now()}`,
    ),
  );

  const browserProvider = new ethers.BrowserProvider(provider);
  const signer = await browserProvider.getSigner();
  const tx = await signer.sendTransaction({
    to: recipientAddress,
    value: BigInt(0),
    data: dataHex,
  });

  return tx.hash;
}

/**
 * Generates EIP-681 `ethereum:` intent URI that invokes any Web3 wallet registered on the device.
 */
export function buildEthereumIntentUri(): string {
  return `ethereum:${ANAGU_ESCROW_ADDRESS}?value=0`;
}

/**
 * Generates EIP-681 ERC-20 `transfer` URI so external/mobile wallets open pre-filled with the token transfer.
 */
export function buildErc20TransferIntentUri(params: {
  tokenAddress: string;
  recipientAddress?: string;
  amountTokens: number;
  decimals?: number;
  chainIdHex?: string;
}): string {
  const recipient =
    params.recipientAddress && ethers.isAddress(params.recipientAddress)
      ? params.recipientAddress
      : ANAGU_ESCROW_ADDRESS;
  const decimals = typeof params.decimals === 'number' ? params.decimals : 18;
  const amountStr = Number.isFinite(params.amountTokens) && params.amountTokens > 0
    ? params.amountTokens.toFixed(Math.min(decimals, 6)).replace(/\.?0+$/, '')
    : '0';
  const amountWei = ethers.parseUnits(amountStr || '0', decimals).toString();
  const chainSegment =
    params.chainIdHex && parseInt(params.chainIdHex, 16) > 0
      ? `@${parseInt(params.chainIdHex, 16)}`
      : '';
  return `ethereum:${params.tokenAddress}${chainSegment}/transfer?address=${recipient}&uint256=${amountWei}`;
}

/**
 * Triggers the device's registered `ethereum:` Web3 wallet handler via a non-navigating anchor click.
 */
export function triggerDeviceEthereumWalletIntent(customUri?: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = customUri || buildEthereumIntentUri();
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Builds universal mobile wallet deep links so tapping any mobile wallet opens the given
 * app path inside that wallet's built-in Web3 DApp browser.
 */
export function getMobileWalletDeepLinksForPath(relativePath?: string): MobileWalletDeepLink[] {
  if (typeof window === 'undefined') return [];

  const resolvedPath =
    relativePath ?? `${window.location.pathname}${window.location.search || ''}`;
  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
  const targetUrl = `${window.location.origin}${normalizedPath}`;
  const hostAndPath = targetUrl.replace(/^https?:\/\//, '');
  const encodedUrl = encodeURIComponent(targetUrl);
  const encodedOrigin = encodeURIComponent(window.location.origin);

  return [
    {
      id: 'metamask',
      name: 'MetaMask',
      subtitle: 'Open in MetaMask Mobile',
      href: `https://metamask.app.link/dapp/${hostAndPath}`,
      accentClass: 'border-orange-500/40 hover:border-orange-400 text-orange-300',
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      subtitle: 'Open in Trust Wallet',
      href: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodedUrl}`,
      accentClass: 'border-sky-500/40 hover:border-sky-400 text-sky-300',
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      subtitle: 'Open in Coinbase Wallet',
      href: `https://go.cb-w.com/dapp?cb_url=${encodedUrl}`,
      accentClass: 'border-blue-500/40 hover:border-blue-400 text-blue-300',
    },
    {
      id: 'phantom',
      name: 'Phantom',
      subtitle: 'Open in Phantom App',
      href: `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedOrigin}`,
      accentClass: 'border-purple-500/40 hover:border-purple-400 text-purple-300',
    },
    {
      id: 'okx',
      name: 'OKX Wallet',
      subtitle: 'Open in OKX App',
      href: `okx://wallet/dapp/url?dappUrl=${encodedUrl}`,
      accentClass: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-300',
    },
    {
      id: 'rainbow',
      name: 'Rainbow',
      subtitle: 'Open in Rainbow App',
      href: `https://rnbwapp.com/dapp?url=${encodedUrl}`,
      accentClass: 'border-pink-500/40 hover:border-pink-400 text-pink-300',
    },
    {
      id: 'bitget',
      name: 'Bitget Wallet',
      subtitle: 'Open in Bitget App',
      href: `https://bkcode.vip?action=dapp&url=${encodedUrl}`,
      accentClass: 'border-cyan-500/40 hover:border-cyan-400 text-cyan-300',
    },
    {
      id: 'zerion',
      name: 'Zerion',
      subtitle: 'Open in Zerion App',
      href: `https://link.zerion.io/open_url?url=${encodedUrl}`,
      accentClass: 'border-indigo-500/40 hover:border-indigo-400 text-indigo-300',
    },
    {
      id: 'safepal',
      name: 'SafePal',
      subtitle: 'Open in SafePal App',
      href: `https://link.safepal.io/open_url?url=${encodedUrl}`,
      accentClass: 'border-teal-500/40 hover:border-teal-400 text-teal-300',
    },
    {
      id: 'oneinch',
      name: '1inch Wallet',
      subtitle: 'Open in 1inch App',
      href: `https://wallet.1inch.io/dapp?url=${encodedUrl}`,
      accentClass: 'border-slate-500/40 hover:border-slate-400 text-slate-200',
    },
  ];
}

/**
 * Builds universal mobile wallet deep links so tapping any mobile wallet opens `/explore?buyParcel=<id>`
 * inside that wallet's built-in DApp browser and immediately triggers `eth_requestAccounts`.
 */
export function getMobileWalletDeepLinks(parcelId: string): MobileWalletDeepLink[] {
  return getMobileWalletDeepLinksForPath(`/explore?buyParcel=${encodeURIComponent(parcelId)}`);
}
