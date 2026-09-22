'use client';

import { useState } from 'react';
import { apiCall } from '@/lib/api';

interface RegistrarActionsProps {
  applicationId: string;
  /** Called after a successful approve or reject so the parent can re-fetch. */
  onActionComplete?: () => void;
}

/**
 * Client Component for approve/reject buttons on the registrar queue.
 */
export function RegistrarActions({ applicationId, onActionComplete }: RegistrarActionsProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          onClick={() => void handleAction('reject')}
          disabled={loading !== null}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          aria-label={`Reject application ${applicationId}`}
        >
          {loading === 'reject' ? '…' : 'Reject'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
