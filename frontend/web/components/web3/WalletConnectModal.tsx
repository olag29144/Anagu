'use client';

import { useEffect, useState } from 'react';
import {
  discoverAllWallets,
  formatShortAddress,
  getMobileWalletDeepLinksForPath,
  getSnapshotDetectedWallets,
  isMobileDevice,
  isRunningInIframe,
  mapWalletError,
  subscribeWalletDiscovery,
  triggerDeviceEthereumWalletIntent,
  watchLfeeTokenInWallet,
  type ConnectedWalletState,
  type DetectedWalletProvider,
} from '@/lib/web3-wallet';
import { LAND_FEE_TOKEN_ADDRESS } from '@/lib/contracts';
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  detectedWallets?: DetectedWalletProvider[];
  connectedWallet?: ConnectedWalletState | null;
  connecting?: boolean;
  error?: string | null;
  onSelectWallet: (wallet: DetectedWalletProvider) => void | Promise<unknown>;
  onDisconnect?: () => void;
  deepLinkPath?: string;
  title?: string;
  subtitle?: string;
}

export function WalletConnectModal({
  open,
  onClose,
  detectedWallets: externalWallets,
  connectedWallet,
  connecting = false,
  error,
  onSelectWallet,
  onDisconnect,
  deepLinkPath,
  title,
  subtitle,
}: WalletConnectModalProps) {
  const [internalWallets, setInternalWallets] = useState<DetectedWalletProvider[]>([]);
  const [scanning, setScanning] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const [directTabUrl, setDirectTabUrl] = useState('');
  const [addingToken, setAddingToken] = useState(false);
  const [tokenWatchStatus, setTokenWatchStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMobile(isMobileDevice());
    setInIframe(isRunningInIframe());
    if (typeof window !== 'undefined') {
      setDirectTabUrl(
        deepLinkPath ? `${window.location.origin}${deepLinkPath}` : window.location.href,
      );
    }
    setInternalWallets(getSnapshotDetectedWallets());

    const unsubscribe = subscribeWalletDiscovery((wallets) => {
      setInternalWallets(wallets);
    });

    let cancelled = false;
    setScanning(true);
    void discoverAllWallets(450).then((wallets) => {
      if (!cancelled) {
        setInternalWallets(wallets);
        setScanning(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [open, deepLinkPath]);

  if (!open) return null;

  const walletsToShow = (() => {
    const map = new Map<string, DetectedWalletProvider>();
    for (const w of internalWallets) {
      map.set(w.id, w);
    }
    for (const w of externalWallets ?? []) {
      if (!Array.from(map.values()).some((ex) => ex.provider === w.provider)) {
        map.set(w.id, w);
      }
    }
    return Array.from(map.values());
  })();

  const handleRescan = async () => {
    setScanning(true);
    const fresh = await discoverAllWallets(600);
    setInternalWallets(fresh);
    setScanning(false);
  };

  const mobileLinks = getMobileWalletDeepLinksForPath(deepLinkPath);

  const activeProviderForConnected = connectedWallet
    ? walletsToShow.find((w) => w.id === connectedWallet.walletId)?.provider ??
      walletsToShow[0]?.provider
    : undefined;

  const handleAddLfeeToken = async () => {
    if (!connectedWallet) return;
    setTokenWatchStatus(null);
    const provider = activeProviderForConnected;
    if (!provider) {
      setTokenWatchStatus(
        'Open this page in your wallet browser or re-select your wallet above to import LFEE.',
      );
      return;
    }
    setAddingToken(true);
    try {
      const added = await watchLfeeTokenInWallet(provider, {
        address: connectedWallet.tokenAddress || LAND_FEE_TOKEN_ADDRESS,
        symbol: connectedWallet.tokenSymbol || 'LFEE',
        decimals: connectedWallet.tokenDecimals ?? 18,
      });
      setTokenWatchStatus(
        added
          ? `${connectedWallet.tokenSymbol || 'LFEE'} token added to ${connectedWallet.walletName}.`
          : `${connectedWallet.tokenSymbol || 'LFEE'} token import was dismissed in your wallet.`,
      );
    } catch (err) {
      setTokenWatchStatus(mapWalletError(err));
    } finally {
      setAddingToken(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Connect LFEE Token Wallet'}
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-[#0A0F16] border border-[rgba(91,133,167,0.32)] p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(91,133,167,0.18)] pb-3.5">
          <div>
            <h3 className="text-base font-bold text-[#F4F7FB] flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#38BDF8]" />
              <span>
                {title ??
                  (connectedWallet
                    ? 'Connected LFEE Token Wallet'
                    : 'Connect LFEE Token Wallet')}
              </span>
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              {subtitle ??
                (connectedWallet
                  ? `Connected to LFEE Token (${formatShortAddress(LAND_FEE_TOKEN_ADDRESS)}).`
                  : `Connects your wallet directly to LFEE Token (${formatShortAddress(LAND_FEE_TOKEN_ADDRESS)}), not ETH.`)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-white"
            aria-label="Close wallet modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-amber-950/30 border border-amber-500/35 px-3.5 py-2.5 text-xs text-amber-300"
          >
            {error}
          </div>
        )}

        {connectedWallet && (
          <div className="rounded-lg bg-[#05080D] border border-emerald-500/35 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {connectedWallet.walletIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={connectedWallet.walletIcon}
                    alt={connectedWallet.walletName}
                    className="h-7 w-7 rounded-md shrink-0"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#F4F7FB] truncate">
                    {connectedWallet.walletName}
                  </p>
                  <p className="text-[11px] font-mono text-[#67E8F9] truncate">
                    {connectedWallet.address}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 shrink-0">Connected</span>
            </div>

            <div className="space-y-2 pt-2 border-t border-[rgba(91,133,167,0.16)] text-xs">
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span>{connectedWallet.chainName}</span>
                <span className="font-mono font-semibold tabular-nums text-[#67E8F9]">
                  {connectedWallet.tokenBalance} {connectedWallet.tokenSymbol || 'LFEE'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-[#64748B]">
                <span className="font-mono truncate">
                  {connectedWallet.tokenSymbol || 'LFEE'} Contract:{' '}
                  {formatShortAddress(connectedWallet.tokenAddress || LAND_FEE_TOKEN_ADDRESS)}
                </span>
                <span
                  className={
                    connectedWallet.tokenDeployedOnChain
                      ? 'text-emerald-400 font-mono shrink-0'
                      : 'text-amber-300 font-mono shrink-0'
                  }
                >
                  {connectedWallet.tokenDeployedOnChain ? 'LFEE Ready' : 'Wrong Network'}
                </span>
              </div>
            </div>

            {tokenWatchStatus && (
              <p className="text-[11px] text-[#67E8F9] bg-[#0A0F16] border border-[#38BDF8]/30 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{tokenWatchStatus}</span>
              </p>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={addingToken}
                onClick={() => void handleAddLfeeToken()}
                className="w-full h-9 rounded-lg bg-[#0A0F16] border border-[#38BDF8]/40 hover:border-[#38BDF8] text-xs font-medium text-[#67E8F9] inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {addingToken ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Coins className="h-3.5 w-3.5" />
                )}
                <span>
                  {addingToken
                    ? 'Sending LFEE Token to Wallet…'
                    : `Add ${connectedWallet.tokenSymbol || 'LFEE'} Token to Wallet`}
                </span>
              </button>

              {onDisconnect && (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="w-full h-9 rounded-lg bg-[#0A0F16] border border-rose-500/35 hover:border-rose-400 text-xs font-medium text-rose-300"
                >
                  Disconnect Wallet
                </button>
              )}
            </div>
          </div>
        )}

        {/* Detected Browser & Device In-App Wallets */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#64748B]">
              Detected Browser &amp; Device Wallets ({walletsToShow.length})
            </p>
            {scanning && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#38BDF8]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Scanning…
              </span>
            )}
          </div>

          {walletsToShow.length > 0 ? (
            <div className="space-y-2">
              {walletsToShow.map((wallet) => {
                const isCurrent = connectedWallet?.walletId === wallet.id;
                return (
                  <button
                    key={wallet.id}
                    type="button"
                    disabled={connecting}
                    onClick={() => void onSelectWallet(wallet)}
                    className={`w-full h-11 px-3.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#67E8F9]'
                        : 'bg-[#05080D] border-[rgba(91,133,167,0.24)] text-[#F4F7FB] hover:border-[#38BDF8]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {wallet.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={wallet.icon} alt="" className="h-5 w-5 rounded-sm shrink-0" />
                      ) : (
                        <Wallet className="h-4 w-4 text-[#38BDF8] shrink-0" />
                      )}
                      <span className="truncate">{wallet.name}</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#38BDF8] shrink-0">
                      {connecting ? 'Connecting…' : isCurrent ? 'Active' : 'Connect'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.20)] p-3.5 text-xs text-[#94A3B8] space-y-2.5">
              <p className="font-medium text-[#E2E8F0]">
                {inIframe
                  ? 'Browser extensions cannot inject into embedded preview frames.'
                  : mobile
                  ? 'No in-app mobile wallet browser detected in this tab.'
                  : 'No browser wallet extension responded yet.'}
              </p>
              <p className="text-[11px] text-[#64748B]">
                {inIframe
                  ? 'Open this page in a full browser tab so MetaMask, Rabby, Phantom, or Coinbase Wallet can trigger normally, or launch a phone wallet app below.'
                  : mobile
                  ? 'Tap "Detect Installed Phone Wallet" or open this page inside any wallet app below.'
                  : 'Unlock your browser wallet (MetaMask, Rabby, Phantom, Coinbase, Trust, OKX, Bitget) and click Re-scan, or open in your phone wallet app below.'}
              </p>
              {inIframe && directTabUrl && (
                <a
                  href={directTabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-9 px-3 rounded-lg bg-[#38BDF8]/15 border border-[#38BDF8]/50 hover:border-[#38BDF8] text-xs font-semibold text-[#67E8F9] inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Open in Full Browser Tab to Trigger Wallet</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={connecting || scanning}
            onClick={() => void handleRescan()}
            className="w-full h-10 rounded-lg bg-[#38BDF8] hover:bg-[#67E8F9] text-[#020305] text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
          >
            {scanning || connecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>
              {scanning
                ? 'Scanning Browser & Device Wallets…'
                : 'Re-scan Browser & Device Wallets'}
            </span>
          </button>
        </div>

        {/* Phone / Mobile Device Wallet Apps */}
        <div className="pt-3 border-t border-[rgba(91,133,167,0.16)] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] inline-flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span>Phone &amp; Mobile Device Wallets</span>
            </p>
            <button
              type="button"
              onClick={() => triggerDeviceEthereumWalletIntent()}
              className="text-[11px] font-mono text-[#38BDF8] hover:underline inline-flex items-center gap-1"
            >
              <span>Trigger Phone Wallet</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => triggerDeviceEthereumWalletIntent()}
            className="w-full h-9 px-3 rounded-lg bg-[#05080D] border border-[#38BDF8]/35 hover:border-[#38BDF8] text-xs font-medium text-[#67E8F9] inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Detect &amp; Open Installed Wallet on Device</span>
            <ExternalLink className="h-3 w-3" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            {mobileLinks.map((wallet) => (
              <a
                key={wallet.id}
                href={wallet.href}
                className={`px-3 py-2 rounded-lg bg-[#05080D] border text-xs font-medium flex items-center justify-between gap-1.5 transition-colors ${wallet.accentClass}`}
              >
                <span className="truncate">{wallet.name}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-80" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
