'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { apiCall } from '@/lib/api';
import { getActiveDemoAccount } from '@/lib/supabase';
import { getActiveUserAccount } from '@/lib/user-store';
import { StatusBadge } from '@/components/status-badge';
import { PortalHeader } from '@/components/portal-header';
import { WalletConnectModal } from '@/components/web3/WalletConnectModal';
import {
  subscribeWalletDiscovery,
  discoverAllWallets,
  connectWalletProvider,
  formatShortAddress,
  type DetectedWalletProvider,
  type ConnectedWalletState,
} from '@/lib/web3-wallet';
import {
  revokeTitleOnChain,
  formatContractError,
} from '@/lib/ethers-contracts';
import {
  ContractRevocationGround,
  LAND_TITLE_NFT_ADDRESS,
} from '@/lib/contracts';
import { Landmark, AlertTriangle, ShieldAlert, Sparkles, Wallet, Lock } from 'lucide-react';

type RevocationGround = 'OverridingPublicInterest' | 'BreachOfStatutoryCondition';

interface AuditEntry {
  id: string;
  entity_id: string;
  action: string;
  outcome: string;
  metadata: {
    ground?: string;
    txHash?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

/**
 * Governor Page — Client Component.
 *
 * Provides the statutory revocation form (Land Use Act 1978, Section 28)
 * with direct ethers.js LandTitleNFT.revoke execution and audit history.
 */
export default function GovernorPage() {
  const [tokenId, setTokenId] = useState('');
  const [ground, setGround] = useState<RevocationGround>('OverridingPublicInterest');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [revocations, setRevocations] = useState<AuditEntry[]>([]);
  const [loadingRevocations, setLoadingRevocations] = useState(true);

  const [detectedWallets, setDetectedWallets] = useState<DetectedWalletProvider[]>([]);
  const [activeProvider, setActiveProvider] = useState<DetectedWalletProvider | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWalletState | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalError, setWalletModalError] = useState<string | null>(null);
  const [authorizedGovernor, setAuthorizedGovernor] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const activeUser = getActiveUserAccount();
      const demoAcc = getActiveDemoAccount();
      const allowed =
        activeUser?.role === 'governor' || demoAcc?.role === 'governor';
      setAuthorizedGovernor(allowed);
    };
    checkAuth();
    window.addEventListener('anagu-user-changed', checkAuth);
    window.addEventListener('storage', checkAuth);

    const unsubscribe = subscribeWalletDiscovery((wallets) => {
      setDetectedWallets(wallets);
    });
    return () => {
      unsubscribe();
      window.removeEventListener('anagu-user-changed', checkAuth);
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  async function connectGovernorProvider(wallet: DetectedWalletProvider) {
    setWalletModalError(null);
    setError(null);
    setWalletConnecting(true);
    try {
      setActiveProvider(wallet);
      const connected = await connectWalletProvider(wallet);
      setConnectedWallet(connected);
      setShowWalletModal(false);
    } catch (err) {
      const msg = formatContractError(err);
      setWalletModalError(msg);
      setError(msg);
    } finally {
      setWalletConnecting(false);
    }
  }

  async function handleConnectGovernorWallet() {
    setError(null);
    setWalletModalError(null);
    const wallets = await discoverAllWallets(300);
    setDetectedWallets(wallets);
    if (!connectedWallet && wallets.length === 1) {
      await connectGovernorProvider(wallets[0]);
      return;
    }
    setShowWalletModal(true);
  }

  // Fetch recent revocation audit entries on mount
  useEffect(() => {
    async function loadRevocations() {
      try {
        const data = await apiCall<AuditEntry[]>('/audit/revocations');
        setRevocations(data);
      } catch {
        setRevocations([]);
      } finally {
        setLoadingRevocations(false);
      }
    }
    loadRevocations();
  }, [success]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedTokenId = tokenId.trim();
    if (!trimmedTokenId) {
      setError('Token ID is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (activeProvider && connectedWallet) {
        const contractGround =
          ground === 'OverridingPublicInterest'
            ? ContractRevocationGround.OverridingPublicInterest
            : ContractRevocationGround.BreachOfStatutoryCondition;

        const result = await revokeTitleOnChain(
          activeProvider.provider,
          trimmedTokenId,
          contractGround,
        );

        // Best-effort sync to backend audit log if available
        try {
          await apiCall(`/titles/${encodeURIComponent(trimmedTokenId)}/revoke`, {
            method: 'POST',
            body: JSON.stringify({ ground, txHash: result.txHash }),
          });
        } catch {
          // On-chain revocation succeeded directly via ethers.js
        }

        setSuccess(
          `Land Title Token #${result.tokenId} revoked on-chain (${LAND_TITLE_NFT_ADDRESS.slice(0, 10)}…) under ${ground}. Tx Hash: ${result.txHash}`,
        );
        setTokenId('');
        return;
      }

      await apiCall(`/titles/${encodeURIComponent(trimmedTokenId)}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ ground }),
      });
      setSuccess(`Land Title Token #${trimmedTokenId} successfully revoked under: ${ground}. Immutable blockchain state updated.`);
      setTokenId('');
    } catch (err) {
      setError(
        activeProvider && connectedWallet
          ? formatContractError(err)
          : err instanceof Error
            ? err.message
            : 'Revocation failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB]">
      <PortalHeader currentRoleTitle="Executive Governor Portal" />

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#F4F7FB]">
                Statutory Land Title Revocation Executive Console
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                LAND USE ACT (1978) §28
              </span>
            </div>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Statutory gubernatorial prerogative pursuant to Section 28 of the Land Use Act (1978) · LandTitleNFT{' '}
              <span className="font-mono text-[#38BDF8]">{formatShortAddress(LAND_TITLE_NFT_ADDRESS)}</span>
            </p>
          </div>

          <button
            type="button"
            disabled={walletConnecting}
            onClick={() => void handleConnectGovernorWallet()}
            className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
              connectedWallet
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-[#0A0F16] border-[#1E293B] hover:border-[#38BDF8] text-[#F4F7FB]'
            }`}
          >
            <Wallet className="h-3.5 w-3.5 text-[#38BDF8]" />
            <span>
              {walletConnecting
                ? 'Connecting…'
                : connectedWallet
                  ? `${connectedWallet.walletName}: ${formatShortAddress(connectedWallet.address)}`
                  : 'Connect Governor Wallet (ethers.js)'}
            </span>
          </button>
        </div>

        {authorizedGovernor === null ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
          </div>
        ) : authorizedGovernor === false ? (
          <div className="rounded-xl bg-[#0A0F16] p-10 text-center border border-rose-500/40 space-y-4">
            <div className="mx-auto h-11 w-11 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-[#F4F7FB]">Governor Authorization Required</h2>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              Normal user accounts cannot access Governor revocation controls. Register an account as a Governor using an administrator-generated authorization code.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9]"
            >
              Return to My Dashboard
            </Link>
          </div>
        ) : (
        <>
        {/* Revocation form */}
        <div className="mb-10 rounded-xl bg-[#0A0F16] p-6 sm:p-8 border border-[#1E293B] shadow-xl">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#1E293B]">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-[#F4F7FB]">
                Execute Statutory Title Revocation
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setTokenId('1041')}
              className="px-2.5 py-1 text-xs font-mono text-[#38BDF8] bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 rounded border border-[#38BDF8]/30 transition-all flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" />
              <span>Target Token #1041</span>
            </button>
          </div>

          {success && (
            <div
              role="status"
              className="mb-5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 p-4 text-xs text-emerald-300 break-all"
            >
              {success}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-rose-950/30 border border-rose-500/40 p-4 text-xs text-rose-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="tokenId"
                className="mb-1.5 block text-xs font-mono text-[#94A3B8]"
              >
                ERC-721 Deed Token ID <span className="text-rose-400">*</span>
              </label>
              <input
                id="tokenId"
                type="text"
                required
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="block w-full h-10 px-3 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs font-mono text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                placeholder="e.g. 1041 or 1042"
              />
              <p className="mt-1 text-[11px] text-[#64748B] font-mono">
                The smart contract token ID of the Certificate of Occupancy registered on LandTitleNFT.
              </p>
            </div>

            <div>
              <label
                htmlFor="ground"
                className="mb-1.5 block text-xs font-mono text-[#94A3B8]"
              >
                Statutory Legal Ground <span className="text-rose-400">*</span>
              </label>
              <select
                id="ground"
                required
                value={ground}
                onChange={(e) => setGround(e.target.value as RevocationGround)}
                className="block w-full h-10 px-3 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
              >
                <option value="OverridingPublicInterest">
                  Overriding Public Interest (§28(1)(a) — Public Infrastructure/National Defence)
                </option>
                <option value="BreachOfStatutoryCondition">
                  Breach of Statutory Condition (§28(1)(b) — Unauthorised Alienation/Covenant Failure)
                </option>
              </select>
            </div>

            <div className="rounded-lg bg-amber-950/20 border border-amber-500/30 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>Statutory Notice:</strong>{' '}
                {connectedWallet
                  ? `Connected wallet (${formatShortAddress(connectedWallet.address)}) will invoke LandTitleNFT.revoke(tokenId, ground) directly via ethers.js (requires GOVERNOR_ROLE).`
                  : 'Execution emits a permanent on-chain TitleRevoked event and transitions the token metadata status to revoked.'}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-all disabled:opacity-60"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>
                {submitting
                  ? 'Executing Revocation on Ledger…'
                  : connectedWallet
                    ? 'Revoke Title On-Chain (ethers.js)'
                    : 'Execute Statutory Revocation'}
              </span>
            </button>
          </form>
        </div>

        {/* Recent revocations */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-[#F4F7FB]">
            Statutory Revocation Gazette Log
          </h2>

          {loadingRevocations && (
            <p className="text-xs text-[#94A3B8]">Loading revocation ledger audit…</p>
          )}

          {!loadingRevocations && revocations.length === 0 && (
            <div className="rounded-xl bg-[#0A0F16] p-8 text-center border border-[#1E293B]">
              <p className="text-xs text-[#94A3B8]">No revocations executed in the current gazette year.</p>
            </div>
          )}

          {!loadingRevocations && revocations.length > 0 && (
            <div className="overflow-hidden rounded-xl bg-[#0A0F16] border border-[#1E293B] shadow-xl">
              <table className="min-w-full divide-y divide-[#1E293B]">
                <thead className="bg-[#05080D]">
                  <tr>
                    {['Token ID', 'Statutory Ground', 'Ledger Outcome', 'Date Recorded'].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60 bg-[#0A0F16]">
                  {revocations.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#1E293B]/30 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-[#38BDF8]">
                        #{entry.entity_id}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-[#F4F7FB]">
                        {entry.metadata?.ground ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <StatusBadge status={entry.outcome.toLowerCase()} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-[#94A3B8]">
                        {new Date(entry.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </>
        )}
      </main>

      <WalletConnectModal
        open={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        detectedWallets={detectedWallets}
        connectedWallet={connectedWallet}
        connecting={walletConnecting}
        error={walletModalError}
        deepLinkPath="/governor"
        title="Connect Governor Wallet"
        onSelectWallet={(wallet) => connectGovernorProvider(wallet)}
        onDisconnect={() => {
          setActiveProvider(null);
          setConnectedWallet(null);
          setWalletModalError(null);
        }}
      />
    </div>
  );
}
