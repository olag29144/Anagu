'use client';

import { useEffect, useState, FormEvent } from 'react';
import {
  LAND_FEE_TOKEN_ADDRESS,
  LAND_REGISTRY_ADDRESS,
  LAND_TITLE_NFT_ADDRESS,
} from '@/lib/contracts';
import {
  fetchContractRegistrySnapshot,
  fetchWalletOnChainProfile,
  verifyLandTitleOnChain,
  approveLandFeeToken,
  formatContractError,
  type ContractRegistrySnapshot,
  type WalletOnChainProfile,
  type OnChainTitleRecord,
} from '@/lib/ethers-contracts';
import { formatShortAddress, type Eip1193Provider } from '@/lib/web3-wallet';
import {
  ShieldCheck,
  Coins,
  FileBadge2,
  Landmark,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';

interface ContractRegistryPanelProps {
  provider?: Eip1193Provider | null;
  walletAddress?: string | null;
}

export function ContractRegistryPanel({
  provider,
  walletAddress,
}: ContractRegistryPanelProps) {
  const [snapshot, setSnapshot] = useState<ContractRegistrySnapshot | null>(null);
  const [walletProfile, setWalletProfile] = useState<WalletOnChainProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);

  const [lookupInput, setLookupInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<OnChainTitleRecord | null>(null);
  const [lookupNotFound, setLookupNotFound] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [approvingFee, setApprovingFee] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadOnChainState = async () => {
    setLoading(true);
    setRpcError(null);
    try {
      const snap = await fetchContractRegistrySnapshot(provider);
      setSnapshot(snap);
      if (provider && walletAddress) {
        const profile = await fetchWalletOnChainProfile(provider, walletAddress);
        setWalletProfile(profile);
      } else {
        setWalletProfile(null);
      }
    } catch (err) {
      setRpcError(
        err instanceof Error
          ? `Connect a Web3 wallet on the deployed contract network (or set NEXT_PUBLIC_RPC_URL) to read live state: ${err.message}`
          : 'Unable to reach smart contract RPC.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOnChainState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, walletAddress]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // Ignore clipboard permissions
    }
  };

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!lookupInput.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupNotFound(false);
    setLookupResult(null);
    try {
      const record = await verifyLandTitleOnChain(lookupInput, provider);
      if (!record) {
        setLookupNotFound(true);
      } else {
        setLookupResult(record);
      }
    } catch (err) {
      setLookupError(formatContractError(err));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleApproveRegistrationFee = async () => {
    if (!provider || !snapshot) return;
    setApprovingFee(true);
    setActionNotice(null);
    setRpcError(null);
    try {
      const amountToApprove =
        snapshot.registrationFeeWei > BigInt(0)
          ? snapshot.registrationFeeWei
          : snapshot.transferFeeWei > BigInt(0)
            ? snapshot.transferFeeWei
            : '100';
      const txHash = await approveLandFeeToken(provider, amountToApprove);
      setActionNotice(`LandFeeToken allowance approved (${formatShortAddress(txHash)}).`);
      await loadOnChainState();
    } catch (err) {
      setRpcError(formatContractError(err));
    } finally {
      setApprovingFee(false);
    }
  };

  const contractRows = [
    {
      key: 'registry',
      name: 'LandRegistry',
      address: LAND_REGISTRY_ADDRESS,
      subtitle: 'Registration, Transfers & Fee Enforcement',
      icon: Landmark,
    },
    {
      key: 'nft',
      name: 'LandTitleNFT',
      address: LAND_TITLE_NFT_ADDRESS,
      subtitle: 'ERC-721 Statutory Title Deeds & Revocation',
      icon: FileBadge2,
    },
    {
      key: 'token',
      name: 'LandFeeToken',
      address: LAND_FEE_TOKEN_ADDRESS,
      subtitle: 'ERC-20 Statutory Fee Settlement Token',
      icon: Coins,
    },
  ];

  return (
    <section className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[rgba(91,133,167,0.16)]">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-[#F4F7FB]">
              On-Chain Smart Contract Registry (ethers.js)
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Live verification against deployed LandRegistry, LandTitleNFT, and LandFeeToken contracts.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadOnChainState()}
          disabled={loading}
          className="h-9 px-3 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.26)] text-xs text-[#94A3B8] hover:text-[#F4F7FB] hover:border-[#38BDF8]/45 inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#38BDF8]' : ''}`} />
          <span>Refresh Chain</span>
        </button>
      </div>

      {/* Contract Addresses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {contractRows.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.20)] p-3.5 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F4F7FB]">
                  <Icon className="h-3.5 w-3.5 text-[#38BDF8]" />
                  {item.name}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy(item.key, item.address)}
                  className="text-[11px] font-mono text-[#64748B] hover:text-[#67E8F9] inline-flex items-center gap-1"
                  title="Copy contract address"
                >
                  {copiedKey === item.key ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] font-mono text-[#38BDF8] break-all">{item.address}</p>
              <p className="text-[11px] text-[#64748B]">{item.subtitle}</p>
            </div>
          );
        })}
      </div>

      {actionNotice && (
        <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/35 px-3.5 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {rpcError && (
        <div className="rounded-lg bg-amber-950/25 border border-amber-500/30 px-3.5 py-2.5 text-xs text-amber-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <span>{rpcError}</span>
        </div>
      )}

      {/* Live Contract Metrics */}
      {snapshot && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.18)] p-3.5">
            <p className="text-[#64748B]">Titles Issued ({snapshot.titleNftSymbol})</p>
            <p className="mt-1 text-lg font-bold font-mono text-[#F4F7FB]">
              {snapshot.titlesIssued}
            </p>
          </div>
          <div className="rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.18)] p-3.5">
            <p className="text-[#64748B]">Transfers Completed</p>
            <p className="mt-1 text-lg font-bold font-mono text-[#38BDF8]">
              {snapshot.transfersCompleted}
            </p>
          </div>
          <div className="rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.18)] p-3.5">
            <p className="text-[#64748B]">Registration / Transfer Fee</p>
            <p className="mt-1 text-sm font-bold font-mono text-[#F4F7FB]">
              {snapshot.registrationFeeFormatted} / {snapshot.transferFeeFormatted}{' '}
              {snapshot.feeTokenSymbol}
            </p>
          </div>
          <div className="rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.18)] p-3.5">
            <p className="text-[#64748B]">Total Fees Collected</p>
            <p className="mt-1 text-lg font-bold font-mono text-emerald-400">
              {snapshot.totalFeesCollected} {snapshot.feeTokenSymbol}
            </p>
          </div>
        </div>
      )}

      {/* Connected Wallet On-Chain Status */}
      {walletProfile && snapshot && (
        <div className="rounded-lg bg-[#05080D] border border-emerald-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <p className="font-mono text-[#94A3B8]">
              Connected Signer:{' '}
              <span className="text-[#67E8F9]">{formatShortAddress(walletProfile.address)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[#E2E8F0] font-mono">
              <span>
                {snapshot.feeTokenSymbol} Balance:{' '}
                <strong className="text-emerald-400">
                  {walletProfile.feeTokenBalanceFormatted}
                </strong>
              </span>
              <span>·</span>
              <span>
                Registry Allowance:{' '}
                <strong className="text-[#38BDF8]">
                  {walletProfile.feeTokenAllowanceFormatted}
                </strong>
              </span>
              <span>·</span>
              <span>
                Owned Titles:{' '}
                <strong className="text-[#F4F7FB]">{walletProfile.nftBalance}</strong>
              </span>
            </div>
            {(walletProfile.isRegistrar ||
              walletProfile.isGovernor ||
              walletProfile.isFeeMinter ||
              walletProfile.isRegistryAdmin) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {walletProfile.isRegistrar && (
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/35 text-sky-300 font-mono text-[10px]">
                    REGISTRAR_ROLE
                  </span>
                )}
                {walletProfile.isGovernor && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-[10px]">
                    GOVERNOR_ROLE
                  </span>
                )}
                {walletProfile.isFeeMinter && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-[10px]">
                    MINTER_ROLE
                  </span>
                )}
                {walletProfile.isRegistryAdmin && (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/35 text-indigo-300 font-mono text-[10px]">
                    DEFAULT_ADMIN_ROLE
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={approvingFee || !provider}
            onClick={() => void handleApproveRegistrationFee()}
            className="h-9 px-3.5 rounded-lg bg-[#38BDF8] hover:bg-[#67E8F9] text-[#020305] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 shrink-0"
          >
            {approvingFee && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Approve {snapshot.feeTokenSymbol} for Registry</span>
          </button>
        </div>
      )}

      {/* On-Chain Title Verification Lookup */}
      <div className="pt-2 border-t border-[rgba(91,133,167,0.16)] space-y-3">
        <p className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
          Verify On-Chain Title Deed (Token ID or Parcel Ref)
        </p>
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Enter Token ID (e.g. 1) or Parcel Ref (e.g. NG-LAG-LEK-2026-0089)"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.24)] text-xs font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={lookupLoading}
            className="h-10 px-4 rounded-lg bg-[#38BDF8] hover:bg-[#67E8F9] text-[#020305] text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 shrink-0"
          >
            {lookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span>Verify On-Chain</span>
          </button>
        </form>

        {lookupError && (
          <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-500/35 rounded-lg px-3 py-2">
            {lookupError}
          </p>
        )}

        {lookupNotFound && (
          <p className="text-xs text-[#94A3B8] bg-[#05080D] border border-[rgba(91,133,167,0.20)] rounded-lg px-3 py-2">
            No minted LandTitleNFT record found for &ldquo;{lookupInput}&rdquo; on the active chain.
          </p>
        )}

        {lookupResult && (
          <div className="rounded-lg bg-[#05080D] border border-[#38BDF8]/35 p-4 space-y-2 text-xs font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[#38BDF8] font-semibold">
                Token #{lookupResult.tokenId}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] ${
                  lookupResult.isRevoked
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                }`}
              >
                {lookupResult.isRevoked ? 'REVOKED (§28)' : 'ACTIVE TITLE'}
              </span>
            </div>
            <p className="text-[#94A3B8] break-all">
              Owner: <span className="text-[#F4F7FB]">{lookupResult.owner}</span>
            </p>
            <p className="text-[#94A3B8] break-all">
              Parcel ID Hash: <span className="text-[#F4F7FB]">{lookupResult.parcelId}</span>
            </p>
            <p className="text-[#94A3B8] break-all">
              Spatial Hash: <span className="text-[#F4F7FB]">{lookupResult.spatialHash}</span>
            </p>
            {lookupResult.uri && (
              <p className="text-[#94A3B8] break-all">
                Metadata URI: <span className="text-[#67E8F9]">{lookupResult.uri}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
