'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { StatusBadge } from '@/components/status-badge';
import { RegistrarActions } from './registrar-actions';

interface Application {
  id: string;
  citizen_id: string;
  owner_name: string;
  parcel_ref: string;
  status: string;
  spatial_hash: string | null;
  created_at: string;
}

/**
 * Registrar Dashboard — Client Component.
 *
 * Lists all applications with status `pending` or `in_review`.
 * Approve / Reject actions are handled by the RegistrarActions child component.
 */
export default function RegistrarPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadApplications() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace('/login');
      return;
    }

    const { data, error } = await supabase
      .from('applications')
      .select('id, citizen_id, owner_name, parcel_ref, status, spatial_hash, created_at')
      .in('status', ['pending', 'in_review'])
      .order('created_at', { ascending: true });

    if (error) {
      setFetchError(error.message);
    } else {
      setApplications(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Applications Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review pending and in-review land registration applications.
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
        </div>
      )}

      {fetchError && (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          Failed to load applications: {fetchError}
        </div>
      )}

      {!loading && applications.length === 0 && !fetchError && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-500">No applications pending review.</p>
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Applicant
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Parcel Ref
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Spatial Result
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Oracle Result
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Submitted
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {app.owner_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {app.parcel_ref}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {app.spatial_hash ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {app.status === 'in_review' ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(app.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/audit/${app.id}`}
                        className="text-xs text-primary-700 hover:underline"
                      >
                        Audit trail
                      </Link>
                      <RegistrarActions
                        applicationId={app.id}
                        onActionComplete={() => void loadApplications()}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
