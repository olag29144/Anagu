'use client';

import { useState } from 'react';
import { apiCall } from '@/lib/api';
import {
  getSnapshotDetectedWallets,
  connectWalletProvider,
} from '@/lib/web3-wallet';
import {
  registerTitleOnChain,
  formatContractError,
} from '@/lib/ethers-contracts';

interface RegistrarActionsProps {
  applicationId: string;
  parcelRef?: string;
  spatialHash?: string | null;
  ownerAddress?: string;
  /** Called after a successful approve or reject so the parent can re-fetch. */
  onActionComplete?: () => void;
}

/**
 * Client Component for approve/reject and on-chain mint buttons on the registrar queue.
 */
export function RegistrarActions({
  applicationId,
  parcelRef,
  spatialHash,
  ownerAddress,
  onActionComplete,
}: RegistrarActionsProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | 'mint' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mintNotice, setMintNotice] = useState<string | null>(null);

  async function handleAction(action: 'approve' | 'reject') {
    setError(null);
    setLoading(action);
    try {
      await apiCall(`/applications/${applicationId}/${action}`, { method: 'POST' });
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(null);
    }
  }

  async function handleMintOnChain() {
    setError(null);
    setMintNotice(null);
    setLoading('mint');
    try {
      const wallets = getSnapshotDetectedWallets();
      if (wallets.length === 0) {
        setError('Connect a browser Web3 wallet with REGISTRAR_ROLE to mint on-chain.');
        return;
      }
      const wallet = wallets[0];
      const connected = await connectWalletProvider(wallet);
      const targetOwner = ownerAddress || connected.address;
      const result = await registerTitleOnChain(wallet.provider, {
        applicationRef: applicationId,
        ownerAddress: targetOwner,
        parcelRef: parcelRef || applicationId,
        spatialHash: spatialHash || undefined,
        metadataUri: `ipfs://anagu/${parcelRef || applicationId}`,
      });
      setMintNotice(`Minted Token #${result.tokenId} (${result.txHash.slice(0, 12)}…)`);
      try {
        await apiCall(`/applications/${applicationId}/approve`, { method: 'POST' });
      } catch {
        // On-chain registration succeeded directly via ethers.js
      }
      onActionComplete?.();
    } catch (err) {
      setError(formatContractError(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => void handleAction('approve')}
          disabled={loading !== null}
          className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          aria-label={`Approve application ${applicationId}`}
        >
          {loading === 'approve' ? '…' : 'Approve'}
        </button>
        <button
          onClick={() => void handleMintOnChain()}
          disabled={loading !== null}
          className="rounded-md bg-[#38BDF8] px-3 py-1 text-xs font-medium text-[#020305] hover:bg-[#67E8F9] disabled:opacity-50"
          aria-label={`Mint on-chain for ${applicationId}`}
        >
          {loading === 'mint' ? 'Minting…' : 'Mint On-Chain'}
        </button>
        <button
          onClick={() => void handleAction('reject')}
          disabled={loading !== null}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          aria-label={`Reject application ${applicationId}`}
        >
          {loading === 'reject' ? '…' : 'Reject'}
        </button>
      </div>
      {mintNotice && <p className="text-[11px] font-mono text-emerald-400">{mintNotice}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
