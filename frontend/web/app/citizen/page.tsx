'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { StatusBadge } from '@/components/status-badge';

interface Application {
  id: string;
  parcel_ref: string;
  status: string;
  created_at: string;
}

/**
 * Citizen Dashboard — Client Component.
 *
 * Fetches all applications belonging to the authenticated citizen and renders
 * them in a table with color-coded status badges.
 */
export default function CitizenPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
        .select('id, parcel_ref, status, created_at')
        .eq('citizen_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setFetchError(error.message);
      } else {
        setApplications(data ?? []);
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Applications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track the status of your land registration applications.
          </p>
        </div>
        <Link
          href="/citizen/submit"
          className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:ring-offset-2"
        >
          + Submit application
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {fetchError && (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          Failed to load applications: {fetchError}
        </div>
      )}

      {/* Empty state */}
      {!loading && applications.length === 0 && !fetchError && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-500">
            You have not submitted any applications yet.
          </p>
          <Link
            href="/citizen/submit"
            className="mt-4 inline-block rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-900"
          >
            Submit your first application
          </Link>
        </div>
      )}

      {/* Applications table */}
      {!loading && applications.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Application ID
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
                  Submitted
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Audit</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-600">
                    {app.id.slice(0, 8)}…
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {app.parcel_ref}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(app.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <Link
                      href={`/audit/${app.id}`}
                      className="text-primary-700 hover:underline"
                    >
                      View audit trail
                    </Link>
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
