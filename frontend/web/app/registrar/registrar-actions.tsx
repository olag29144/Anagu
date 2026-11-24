'use client';

import { useState } from 'react';
import { apiCall } from '@/lib/api';
import { WalletConnectModal } from '@/components/web3/WalletConnectModal';
import {
  discoverAllWallets,
  connectWalletProvider,
  type DetectedWalletProvider,
} from '@/lib/web3-wallet';
import {
  registerTitleOnChain,
  formatContractError,
} from '@/lib/ethers-contracts';
import { addNotification } from '@/lib/notifications-store';

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
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<DetectedWalletProvider[]>([]);

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

  async function executeMintWithWallet(wallet: DetectedWalletProvider) {
    setError(null);
    setMintNotice(null);
    setShowWalletModal(false);
    setLoading('mint');
    try {
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
      addNotification({
        title: 'Title Deed NFT Minted On-Chain',
        message: `Token #${result.tokenId} issued for ${parcelRef || applicationId} (${result.txHash.slice(0, 12)}…).`,
        category: 'application',
        severity: 'success',
        recipientRole: 'all',
        entityRef: `TOKEN-${result.tokenId}`,
        href: `/audit/${applicationId}`,
      });
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

  async function handleMintOnChain() {
    setError(null);
    setMintNotice(null);
    const wallets = await discoverAllWallets(300);
    setDetectedWallets(wallets);

    if (wallets.length === 1) {
      await executeMintWithWallet(wallets[0]);
      return;
    }

    setShowWalletModal(true);
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

      <WalletConnectModal
        open={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        detectedWallets={detectedWallets}
        connecting={loading === 'mint'}
        error={error}
        deepLinkPath="/registrar"
        title="Select Registrar Wallet to Mint"
        onSelectWallet={(wallet) => executeMintWithWallet(wallet)}
      />
    </div>
  );
}
