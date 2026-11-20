export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isRabby?: boolean;
  isPhantom?: boolean;
  isOkxWallet?: boolean;
  isBraveWallet?: boolean;
  isRainbow?: boolean;
  providers?: Eip1193Provider[];
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
  provider: Eip1193Provider;
}

export interface ConnectedWalletState {
  address: string;
  chainId: string;
  chainName: string;
  balanceEth: string;
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

export const ANAGU_ESCROW_ADDRESS = '0x71C83812a19f20108A456789b910123456789012';

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
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

function inferLegacyWalletName(provider: Eip1193Provider): string {
  if (provider.isRabby) return 'Rabby Wallet';
  if (provider.isPhantom) return 'Phantom Wallet';
  if (provider.isOkxWallet) return 'OKX Wallet';
  if (provider.isTrust || provider.isTrustWallet) return 'Trust Wallet';
  if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider.isRainbow) return 'Rainbow Wallet';
  if (provider.isBraveWallet) return 'Brave Wallet';
  if (provider.isMetaMask) return 'MetaMask';
  return 'Browser Web3 Wallet';
}

function collectLegacyProviders(): DetectedWalletProvider[] {
  if (typeof window === 'undefined') return [];

  const win = window as unknown as {
    ethereum?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider };
    okxwallet?: Eip1193Provider;
    coinbaseWalletExtension?: Eip1193Provider;
    trustwallet?: Eip1193Provider;
  };

  const candidates: Eip1193Provider[] = [];

  if (win.ethereum) {
    if (Array.isArray(win.ethereum.providers) && win.ethereum.providers.length > 0) {
      candidates.push(...win.ethereum.providers);
    } else {
      candidates.push(win.ethereum);
    }
  }
  if (win.phantom?.ethereum) candidates.push(win.phantom.ethereum);
  if (win.okxwallet) candidates.push(win.okxwallet);
  if (win.coinbaseWalletExtension) candidates.push(win.coinbaseWalletExtension);
  if (win.trustwallet) candidates.push(win.trustwallet);

  const unique: DetectedWalletProvider[] = [];
  const seenProviders = new Set<Eip1193Provider>();

  candidates.forEach((provider, index) => {
    if (!provider || typeof provider.request !== 'function' || seenProviders.has(provider)) {
      return;
    }
    seenProviders.add(provider);
    const name = inferLegacyWalletName(provider);
    unique.push({
      id: `legacy-${name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
      name,
      provider,
    });
  });

  return unique;
}

/**
 * Discovers all EIP-6963 and legacy injected Web3 wallets synchronously + via event listener.
 */
export function subscribeWalletDiscovery(
  onChange: (wallets: DetectedWalletProvider[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const eip6963Map = new Map<string, DetectedWalletProvider>();

  const emitMerged = () => {
    const merged: DetectedWalletProvider[] = Array.from(eip6963Map.values());
    const legacy = collectLegacyProviders();

    for (const item of legacy) {
      const alreadyIncluded = merged.some(
        (existing) =>
          existing.provider === item.provider ||
          existing.name.toLowerCase() === item.name.toLowerCase(),
      );
      if (!alreadyIncluded) {
        merged.push(item);
      }
    }
    onChange(merged);
  };

  const handleAnnounce = (event: Event) => {
    const customEvent = event as CustomEvent<Eip6963ProviderDetail>;
    const detail = customEvent.detail;
    if (!detail?.info?.uuid || !detail?.provider) return;

    eip6963Map.set(detail.info.uuid, {
      id: detail.info.uuid,
      name: detail.info.name,
      icon: detail.info.icon,
      rdns: detail.info.rdns,
      provider: detail.provider,
    });
    emitMerged();
  };

  window.addEventListener('eip6963:announceProvider', handleAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  emitMerged();

  // Re-emit shortly after mount in case an extension injects slightly late
  const timer = window.setTimeout(() => {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    emitMerged();
  }, 250);

  return () => {
    window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    window.clearTimeout(timer);
  };
}

export function getSnapshotDetectedWallets(): DetectedWalletProvider[] {
  return collectLegacyProviders();
}

function formatHexWeiToEth(hexBalance: string): string {
  try {
    const wei = BigInt(hexBalance);
    const whole = wei / BigInt('1000000000000000000');
    const remainder = wei % BigInt('1000000000000000000');
    const decimals = remainder.toString().padStart(18, '0').slice(0, 4);
    return `${whole.toString()}.${decimals}`;
  } catch {
    return '0.0000';
  }
}

export function mapWalletError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const code = (err as { code?: number }).code;
    const message = (err as { message?: string }).message;
    if (code === 4001) {
      return 'Wallet request was declined in your Web3 wallet.';
    }
    if (code === -32002) {
      return 'A wallet approval prompt is already open. Please check your Web3 wallet extension or app.';
    }
    if (message) return message;
  }
  return err instanceof Error ? err.message : 'Unable to connect Web3 wallet.';
}

/**
 * Triggers `eth_requestAccounts` on the target wallet provider to pop up the user's wallet.
 */
export async function connectWalletProvider(
  wallet: DetectedWalletProvider,
): Promise<ConnectedWalletState> {
  const accounts = (await wallet.provider.request({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('No wallet account was returned by your Web3 wallet.');
  }

  const address = accounts[0];

  let chainId = '0x1';
  try {
    const fetchedChainId = (await wallet.provider.request({
      method: 'eth_chainId',
    })) as string;
    if (fetchedChainId) chainId = fetchedChainId;
  } catch {
    // Keep fallback chainId
  }

  let balanceEth = '0.0000';
  try {
    const hexBal = (await wallet.provider.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    })) as string;
    if (hexBal) balanceEth = formatHexWeiToEth(hexBal);
  } catch {
    // Ignore balance read failures on restricted RPCs
  }

  return {
    address,
    chainId,
    chainName: getChainName(chainId),
    balanceEth,
    walletId: wallet.id,
    walletName: wallet.name,
    walletIcon: wallet.icon,
  };
}

function toUtf8Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let hex = '0x';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
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
  const ethAmount = resolvedUsd > 0 ? (resolvedUsd / 3200).toFixed(4) : '0.0000';

  const message = [
    'ANAGU STATUTORY LAND REGISTRY — PURCHASE AUTHORIZATION',
    '',
    `Parcel Ref: ${params.parcelRef}`,
    `Parcel Title: ${params.landTitle}`,
    `Location: ${params.location}`,
    `Area: ${params.areaSqm.toLocaleString()} sqm`,
    `Agreed Price: $${resolvedUsd.toLocaleString()} USD (${ethAmount} ETH)`,
    `Buyer: ${params.buyerName}`,
    `Buyer Wallet: ${params.address}`,
    `Recipient / Escrow: ${recipientAddress}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n');

  const signature = (await provider.request({
    method: 'personal_sign',
    params: [toUtf8Hex(message), params.address],
  })) as string;

  return signature;
}

export async function sendLandPurchaseTransaction(
  provider: Eip1193Provider,
  params: {
    address: string;
    parcelRef: string;
    priceNgn: number;
    priceUsd?: number;
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
  const ethAmount = resolvedUsd > 0 ? (resolvedUsd / 3200).toFixed(4) : '0.0000';

  const dataHex = toUtf8Hex(
    `anagu:purchase:${params.parcelRef}:usd:${resolvedUsd}:eth:${ethAmount}:${Date.now()}`,
  );

  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: params.address,
        to: recipientAddress,
        value: '0x0',
        data: dataHex,
      },
    ],
  })) as string;

  return txHash;
}

/**
 * Generates EIP-681 `ethereum:` intent URI that invokes any mobile wallet registered on the device.
 */
export function buildEthereumIntentUri(): string {
  return `ethereum:${ANAGU_ESCROW_ADDRESS}?value=0`;
}

/**
 * Triggers the device's registered `ethereum:` Web3 wallet handler via a non-navigating anchor click.
 */
export function triggerDeviceEthereumWalletIntent(): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = buildEthereumIntentUri();
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Builds universal mobile wallet deep links so tapping any mobile wallet opens the given
 * app path inside that wallet's built-in DApp browser.
 */
export function getMobileWalletDeepLinksForPath(relativePath: string): MobileWalletDeepLink[] {
  if (typeof window === 'undefined') return [];

  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
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
  ];
}

/**
 * Builds universal mobile wallet deep links so tapping any mobile wallet opens `/explore?buyParcel=<id>`
 * inside that wallet's built-in DApp browser and immediately triggers `eth_requestAccounts`.
 */
export function getMobileWalletDeepLinks(parcelId: string): MobileWalletDeepLink[] {
  return getMobileWalletDeepLinksForPath(`/explore?buyParcel=${encodeURIComponent(parcelId)}`);
}
