'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { StatusBadge } from '@/components/status-badge';
import { PortalHeader } from '@/components/portal-header';
import { Layers, FileCheck, ShieldAlert } from 'lucide-react';

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
      else setApplications((appsResult.data as unknown as Application[]) ?? []);

      if (titlesResult.error) setTitlesError(titlesResult.error.message);
      else setTitles((titlesResult.data as unknown as LandTitle[]) ?? []);

      setLoading(false);
    }

    void load();
  }, [router]);

  const totalApplications = applications.length;
  const totalNftsIssued = titles.length;
  const totalRevocations = titles.filter((t) => t.status === 'revoked').length;

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB]">
      <PortalHeader currentRoleTitle="Cadastre Administrator" />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#F4F7FB]">
              State Land Registry Administration
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
              DIRECTORATE LEVEL
            </span>
          </div>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Comprehensive executive oversight across all statutory applications, minted ERC-721 deeds, and revocations.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
          </div>
        )}

        {!loading && (
          <>
            {/* Stats cards */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Total Applications"
                value={totalApplications}
                color="blue"
                icon={Layers}
              />
              <StatCard
                label="NFT Titles Issued"
                value={totalNftsIssued}
                color="green"
                icon={FileCheck}
              />
              <StatCard
                label="Statutory Revocations"
                value={totalRevocations}
                color="red"
                icon={ShieldAlert}
              />
            </div>

            {/* All Applications */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#F4F7FB]">
                  All Cadastral Applications ({applications.length})
                </h2>
              </div>

              {appsError && (
                <div className="mb-4 rounded-lg bg-rose-950/30 border border-rose-500/40 p-4 text-xs text-rose-300">
                  Failed to load applications: {appsError}
                </div>
              )}

              {applications.length === 0 && !appsError && (
                <div className="rounded-xl bg-[#0A0F16] p-8 text-center border border-[#1E293B]">
                  <p className="text-xs text-[#94A3B8]">No applications recorded in registry yet.</p>
                </div>
              )}

              {applications.length > 0 && (
                <div className="overflow-hidden rounded-xl bg-[#0A0F16] border border-[#1E293B] shadow-xl">
                  <table className="min-w-full divide-y divide-[#1E293B]">
                    <thead className="bg-[#05080D]">
                      <tr>
                        {['Application ID', 'Owner', 'Parcel Ref', 'Status', 'Submitted', 'Audit'].map(
                          (col) => (
                            <th
                              key={col}
                              scope="col"
                              className="px-6 py-3.5 text-left text-[11px] font-mono uppercase tracking-wider text-[#64748B]"
                            >
                              {col}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]/60 bg-[#0A0F16]">
                      {applications.map((app) => (
                        <tr key={app.id} className="hover:bg-[#1E293B]/30 transition-colors">
                          <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-[#38BDF8]">
                            {app.id}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-xs font-semibold text-[#F4F7FB]">
                            {app.owner_name}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-[#94A3B8]">
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
                          <td className="whitespace-nowrap px-6 py-4 text-xs">
                            <Link
                              href={`/audit/${app.id}`}
                              className="text-[#38BDF8] hover:underline font-mono"
                            >
                              Audit trail →
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
              <h2 className="mb-4 text-sm font-semibold text-[#F4F7FB]">
                Issued Land Titles (ERC-721 Deeds)
              </h2>

              {titlesError && (
                <div className="mb-4 rounded-lg bg-rose-950/30 border border-rose-500/40 p-4 text-xs text-rose-300">
                  Failed to load titles: {titlesError}
                </div>
              )}

              {titles.length === 0 && !titlesError && (
                <div className="rounded-xl bg-[#0A0F16] p-8 text-center border border-[#1E293B]">
                  <p className="text-xs text-[#94A3B8]">No titles issued yet.</p>
                </div>
              )}

              {titles.length > 0 && (
                <div className="overflow-hidden rounded-xl bg-[#0A0F16] border border-[#1E293B] shadow-xl">
                  <table className="min-w-full divide-y divide-[#1E293B]">
                    <thead className="bg-[#05080D]">
                      <tr>
                        {['Token ID', 'Status', 'Issued At', 'Audit Record'].map((col) => (
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
                      {titles.map((title) => (
                        <tr key={title.id} className="hover:bg-[#1E293B]/30 transition-colors">
                          <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-[#38BDF8]">
                            #{title.token_id}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <StatusBadge status={title.status} />
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-[#94A3B8]">
                            {new Date(title.issued_at).toLocaleDateString('en-NG', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-xs">
                            <Link
                              href={`/audit/${title.token_id}`}
                              className="text-[#38BDF8] hover:underline font-mono"
                            >
                              Verify chain trail →
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
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const colorMap = {
    blue: 'border-[#38BDF8]/30 text-[#38BDF8]',
    green: 'border-emerald-500/30 text-emerald-400',
    red: 'border-rose-500/30 text-rose-400',
  };

  return (
    <div className={`rounded-xl bg-[#0A0F16] p-5 border ${colorMap[color]} shadow-lg flex items-center justify-between`}>
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">{label}</p>
        <p className="mt-1 text-2xl font-bold font-mono text-[#F4F7FB]">{value}</p>
      </div>
      <div className={`p-3 rounded-xl bg-[#020305] border ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
