'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { StatusBadge } from '@/components/status-badge';

interface Application {
  id: string;
  owner_name: string;
  parcel_ref: string;
  status: string;
  created_at: string;
}

interface LandTitle {
  id: string;
  token_id: string;
  status: string;
  issued_at: string;
}

/**
 * Admin Dashboard — Client Component.
 *
 * Shows aggregated stats (total applications, total NFTs issued, total
 * revocations) and a full application list with a link to the audit trail.
 */
export default function AdminPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [titles, setTitles] = useState<LandTitle[]>([]);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [titlesError, setTitlesError] = useState<string | null>(null);
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

      const [appsResult, titlesResult] = await Promise.all([
        supabase
          .from('applications')
          .select('id, owner_name, parcel_ref, status, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('land_titles')
          .select('id, token_id, status, issued_at')
          .order('issued_at', { ascending: false }),
      ]);

      if (appsResult.error) setAppsError(appsResult.error.message);
      else setApplications(appsResult.data ?? []);

      if (titlesResult.error) setTitlesError(titlesResult.error.message);
      else setTitles(titlesResult.data ?? []);

      setLoading(false);
    }

    void load();
  }, [router]);

  const totalApplications = applications.length;
  const totalNftsIssued = titles.length;
  const totalRevocations = titles.filter((t) => t.status === 'revoked').length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Registry Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Land Administrator overview of all applications and issued titles.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
        </div>
      )}

      {!loading && (
        <>
          {/* Stats cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total Applications" value={totalApplications} color="blue" />
            <StatCard label="NFT Titles Issued" value={totalNftsIssued} color="green" />
            <StatCard label="Total Revocations" value={totalRevocations} color="red" />
          </div>

          {/* All Applications */}
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-medium text-gray-900">All Applications</h2>

            {appsError && (
              <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                Failed to load applications: {appsError}
              </div>
            )}

            {applications.length === 0 && !appsError && (
              <p className="text-sm text-gray-500">No applications yet.</p>
            )}

            {applications.length > 0 && (
              <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Application ID', 'Owner', 'Parcel Ref', 'Status', 'Submitted', 'Audit'].map(
                        (col) => (
                          <th
                            key={col}
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                          >
                            {col}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-600">
                          {app.id.slice(0, 8)}…
                        </td>
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
                          {new Date(app.created_at).toLocaleDateString('en-NG', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
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
          </section>

          {/* Issued Titles */}
          <section>
            <h2 className="mb-4 text-lg font-medium text-gray-900">Issued Land Titles (NFTs)</h2>

            {titlesError && (
              <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                Failed to load titles: {titlesError}
              </div>
            )}

            {titles.length === 0 && !titlesError && (
              <p className="text-sm text-gray-500">No titles issued yet.</p>
            )}

            {titles.length > 0 && (
              <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Token ID', 'Status', 'Issued At', 'Audit'].map((col) => (
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
                    {titles.map((title) => (
                      <tr key={title.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-900">
                          #{title.token_id}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <StatusBadge status={title.status} />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {new Date(title.issued_at).toLocaleDateString('en-NG', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <Link
                            href={`/audit/${title.token_id}`}
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
          </section>
        </>
      )}
    </main>
  );
}

// ── Helper component ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}
