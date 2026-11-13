'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { StatusBadge } from '@/components/status-badge';
import { PortalHeader } from '@/components/portal-header';

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
        setApplications((data as unknown as Application[]) ?? []);
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB]">
      <PortalHeader currentRoleTitle="Citizen / Landholder Portal" />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Page header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1E293B]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#F4F7FB]">My Land Applications</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                STATUTORY CADASTRE
              </span>
            </div>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Track the verification status of your land titles, Certificates of Occupancy, and deeds.
            </p>
          </div>
          <Link
            href="/citizen/submit"
            className="rounded-lg bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-[#020305] shadow-sm hover:bg-[#67E8F9] transition-all flex items-center gap-1.5"
          >
            <span>+ Submit new title</span>
          </Link>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
          </div>
        )}

        {/* Error state */}
        {fetchError && (
          <div className="mb-6 rounded-lg bg-rose-950/30 border border-rose-500/40 p-4 text-xs text-rose-300">
            Failed to load applications: {fetchError}
          </div>
        )}

        {/* Empty state */}
        {!loading && applications.length === 0 && !fetchError && (
          <div className="rounded-xl bg-[#0A0F16] p-12 text-center border border-[#1E293B]">
            <p className="text-sm text-[#94A3B8]">
              You have not submitted any land title applications yet.
            </p>
            <Link
              href="/citizen/submit"
              className="mt-4 inline-block rounded-lg bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-[#020305] hover:bg-[#67E8F9] transition-all"
            >
              Submit your first application
            </Link>
          </div>
        )}

        {/* Applications table */}
        {!loading && applications.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-[#0A0F16] border border-[#1E293B] shadow-xl">
            <table className="min-w-full divide-y divide-[#1E293B]">
              <thead className="bg-[#05080D]">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                  >
                    Application ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                  >
                    Parcel Ref
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                  >
                    Submitted
                  </th>
                  <th scope="col" className="relative px-6 py-3.5 text-right text-[11px] font-mono uppercase tracking-wider text-[#64748B]">
                    Audit Record
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 bg-[#0A0F16]">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-[#1E293B]/30 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-[#38BDF8]">
                      {app.id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-[#F4F7FB]">
                      {app.parcel_ref}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-[#94A3B8]">
                      {new Date(app.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-xs">
                      <Link
                        href={`/audit/${app.id}`}
                        className="text-[#38BDF8] hover:text-[#67E8F9] hover:underline font-mono"
                      >
                        Inspect Trail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
