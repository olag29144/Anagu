'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getActiveDemoAccount } from '@/lib/supabase';

/**
 * Dashboard — Client Component role router.
 *
 * Reads active session/role and routes the user to their role-appropriate page.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Resolving cadastral credentials & permissions…');

  useEffect(() => {
    async function route() {
      const activeDemo = getActiveDemoAccount();
      if (activeDemo) {
        router.replace(activeDemo.defaultPath);
        return;
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const appMetadata = session.user.app_metadata as Record<string, unknown> | undefined;
      const userMetadata = session.user.user_metadata as Record<string, unknown> | undefined;
      const roleFromMetadata =
        (appMetadata?.role as string | undefined) ??
        (appMetadata?.user_role as string | undefined) ??
        (userMetadata?.role as string | undefined) ??
        (userMetadata?.user_role as string | undefined);

      let role = roleFromMetadata?.toLowerCase();

      if (!role) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        role = ((roleRow as { role?: string } | null)?.role ?? '').toLowerCase();
      }

      switch (role) {
        case 'citizen':
        case 'surveyor':
          router.replace('/citizen');
          break;
        case 'registrar':
          router.replace('/registrar');
          break;
        case 'land_admin':
          router.replace('/admin');
          break;
        case 'governor':
          router.replace('/governor');
          break;
        default:
          router.replace('/citizen');
          break;
      }
    }

    void route();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020305] text-[#F4F7FB]">
      <div className="text-center p-6 rounded-xl bg-[#0A0F16] border border-[#1E293B] shadow-2xl max-w-sm">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        <p className="text-xs font-mono text-[#94A3B8]">{status}</p>
      </div>
    </main>
  );
}
