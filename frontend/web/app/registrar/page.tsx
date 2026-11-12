'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { StatusBadge } from '@/components/status-badge';
import { PortalHeader } from '@/components/portal-header';
import { RegistrarActions } from './registrar-actions';
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

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
 * Lists all applications with status `pending`, `legal_pending`, or `in_review`.
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
      .in('status', ['pending', 'legal_pending', 'in_review'])
      .order('created_at', { ascending: true });

    if (error) {
      setFetchError(error.message);
    } else {
      setApplications((data as unknown as Application[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB]">
      <PortalHeader currentRoleTitle="Land Registrar Adjudication Queue" />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#F4F7FB]">
              Cadastral Applications Adjudication Queue
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
              MINISTRY OF LANDS BUREAU
            </span>
          </div>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Review pending applications, inspect PostGIS spatial collision proofs, and adjudicate ERC-721 deed minting.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
          </div>
        )}

        {fetchError && (
          <div className="mb-6 rounded-lg bg-rose-950/30 border border-rose-500/40 p-4 text-xs text-rose-300">
            Failed to load applications: {fetchError}
          </div>
        )}

        {!loading && applications.length === 0 && !fetchError && (
          <div className="rounded-xl bg-[#0A0F16] p-12 text-center border border-[#1E293B]">
            <p className="text-sm text-[#94A3B8]">No applications pending registrar review at this time.</p>
          </div>
        )}

        {!loading && applications.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-[#0A0F16] border border-[#1E293B] shadow-xl">
            <table className="min-w-full divide-y divide-[#1E293B]">
              <thead className="bg-[#05080D]">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                  >
                    Applicant
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
                    Spatial Proof
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                  >
                    Oracle Verification
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                  >
                    Submitted
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-right text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                  >
                    Adjudication
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 bg-[#0A0F16]">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-[#1E293B]/30 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-semibold text-[#F4F7FB]">
                      {app.owner_name}
                      <span className="block font-mono text-[10px] text-[#64748B]">{app.id}</span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-[#38BDF8]">
                      {app.parcel_ref}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-mono">
                      {app.spatial_hash ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>{app.spatial_hash.slice(0, 10)}…</span>
                        </span>
                      ) : (
                        <span className="text-[#64748B]">Pending PostGIS</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-mono">
                      {app.status === 'in_review' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Dual-Oracle Passed</span>
                        </span>
                      ) : app.status === 'legal_pending' ? (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Legal Hold</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#64748B]">
                          <Clock className="h-3.5 w-3.5" />
                          <span>In Pipeline</span>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-[#94A3B8]">
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
                          className="text-xs font-mono text-[#38BDF8] hover:underline"
                        >
                          Audit
                        </Link>
                        {app.status === 'in_review' && (
                          <RegistrarActions
                            applicationId={app.id}
                            onActionComplete={() => void loadApplications()}
                          />
                        )}
                      </div>
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
