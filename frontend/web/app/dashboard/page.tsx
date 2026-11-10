'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

/**
 * Dashboard — Client Component role router.
 *
 * Reads the active session and routes the user to their role-appropriate page.
 * If no role is assigned yet, stays on this page and shows a holding message.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Checking your account…');

  useEffect(() => {
    async function route() {
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
          router.replace('/citizen');
          break;
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
          // Role not yet assigned — show message
          setStatus(
            role
              ? `Unknown role: ${role}. Contact your Land Administration office.`
              : 'Your account is pending role assignment. Contact your Land Administration office.',
          );
          break;
      }
    }

    void route();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
        <p className="text-gray-600">{status}</p>
      </div>
    </main>
  );
}
