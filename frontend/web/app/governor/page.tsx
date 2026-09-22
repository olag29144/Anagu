'use client';

import { useState, useEffect, FormEvent } from 'react';
import { apiCall } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';

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
 * and a list of recent revocation audit entries.
 */
export default function GovernorPage() {
  const [tokenId, setTokenId] = useState('');
  const [ground, setGround] = useState<RevocationGround>('OverridingPublicInterest');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [revocations, setRevocations] = useState<AuditEntry[]>([]);
  const [loadingRevocations, setLoadingRevocations] = useState(true);

  // Fetch recent revocation audit entries on mount
  useEffect(() => {
    async function loadRevocations() {
      try {
        // Fetch a known entity that lists recent revocations — use a sentinel id
        // In a real implementation this would be a paginated endpoint.
        // For now, we attempt to load from the backend audit endpoint.
        const data = await apiCall<AuditEntry[]>('/audit/revocations');
        setRevocations(data);
      } catch {
        // Non-fatal — the revocations list may not exist yet
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
      await apiCall(`/titles/${encodeURIComponent(trimmedTokenId)}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ ground }),
      });
      setSuccess(`Token #${trimmedTokenId} has been revoked under: ${ground}.`);
      setTokenId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revocation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Statutory Title Revocation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nigerian Land Use Act (1978), Section 28. Only Governor-role accounts may perform this
          action.
        </p>
      </div>

      {/* Revocation form */}
      <div className="mb-10 rounded-lg bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-6 text-base font-medium text-gray-900">Revoke a land title</h2>

        {success && (
          <div
            role="status"
            className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200"
          >
            {success}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label
              htmlFor="tokenId"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Token ID <span className="text-red-500">*</span>
            </label>
            <input
              id="tokenId"
              type="text"
              required
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
              placeholder="e.g. 42"
            />
            <p className="mt-1 text-xs text-gray-500">
              The on-chain ERC-721 token ID of the land title to revoke.
            </p>
          </div>

          <div>
            <label
              htmlFor="ground"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Revocation ground <span className="text-red-500">*</span>
            </label>
            <select
              id="ground"
              required
              value={ground}
              onChange={(e) => setGround(e.target.value as RevocationGround)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            >
              <option value="OverridingPublicInterest">
                Overriding Public Interest (§28(1)(a))
              </option>
              <option value="BreachOfStatutoryCondition">
                Breach of Statutory Condition (§28(1)(b))
              </option>
            </select>
          </div>

          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            <strong>Warning:</strong> Revocation is permanent and irreversible. The on-chain
            event will be recorded as a distinct, immutable blockchain record.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Revoking…
              </>
            ) : (
              'Revoke title'
            )}
          </button>
        </form>
      </div>

      {/* Recent revocations */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-gray-900">Recent Revocations</h2>

        {loadingRevocations && (
          <p className="text-sm text-gray-500">Loading revocation history…</p>
        )}

        {!loadingRevocations && revocations.length === 0 && (
          <p className="text-sm text-gray-500">No revocations recorded yet.</p>
        )}

        {!loadingRevocations && revocations.length > 0 && (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Token / Entity', 'Ground', 'Status', 'Date'].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {revocations.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-600">
                      {entry.entity_id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {entry.metadata?.ground ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={entry.outcome.toLowerCase()} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
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
    </main>
  );
}
