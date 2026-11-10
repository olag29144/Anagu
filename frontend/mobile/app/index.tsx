import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

type UserRole =
  | 'citizen'
  | 'surveyor'
  | 'registrar'
  | 'land_admin'
  | 'governor'
  | null;

const ADMIN_ROLES: UserRole[] = ['registrar', 'land_admin', 'governor'];

/**
 * Entry point — resolves the current Supabase session and routes the user to
 * the appropriate screen based on the role stored in `user_roles`.
 *
 * Route map:
 *   no session       → /login
 *   citizen          → /(citizen)/submit
 *   surveyor         → /(surveyor)/parcel
 *   registrar /
 *   land_admin /
 *   governor         → admin notice screen (rendered inline)
 */
export default function IndexScreen() {
  const [loading, setLoading] = useState(true);
  const [adminRole, setAdminRole] = useState<UserRole>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      setLoading(true);
      setAdminRole(null);
      setMessage(null);
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = data.session;

      if (!session) {
        router.replace('/login');
        return;
      }

      const appMetadata = session.user.app_metadata as Record<string, unknown> | undefined;
      const userMetadata = session.user.user_metadata as Record<string, unknown> | undefined;
      const metadataRole =
        (appMetadata?.role as string | undefined) ??
        (appMetadata?.user_role as string | undefined) ??
        (userMetadata?.role as string | undefined) ??
        (userMetadata?.user_role as string | undefined);

      let role = metadataRole?.toLowerCase();

      if (!role) {
        const { data: roleRow, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (roleError) throw roleError;
        role = roleRow?.role?.toLowerCase() ?? null;
      }

      if (cancelled) return;

      if (role === 'citizen') {
        router.replace('/(citizen)/submit');
      } else if (role === 'surveyor') {
        router.replace('/(surveyor)/parcel');
      } else if (role && ADMIN_ROLES.includes(role as UserRole)) {
        // Stay on this screen and show the admin notice
        setAdminRole(role as UserRole);
        setLoading(false);
      } else {
        setMessage(
          role
            ? `Unknown account role "${role}". Contact your Land Administration office.`
            : 'Your account is awaiting role assignment. Contact your Land Administration office.',
        );
        setLoading(false);
      }
    }

    resolveSession().catch((error: unknown) => {
      if (!cancelled) {
        setMessage(
          error instanceof Error
            ? `Unable to load your account role: ${error.message}`
            : 'Unable to load your account role. Check your connection and retry.',
        );
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/login');
    } catch (error) {
      setMessage(
        `Sign out failed: ${
          error instanceof Error ? error.message : 'Please try again.'
        }`,
      );
    }
  }

  if (loading && adminRole === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (message) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Anagu Land Administration</Text>
        <Text style={styles.notice}>{message}</Text>
        <Text
          style={styles.signOut}
          onPress={() => {
            setRetryCount((count) => count + 1);
          }}
        >
          Retry
        </Text>
        <Text
          style={styles.signOut}
          onPress={() => void handleSignOut()}
        >
          Sign out
        </Text>
      </View>
    );
  }

  // Admin notice — rendered while the user waits or decides to sign out
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Anagu Land Administration</Text>
      <Text style={styles.notice}>
        Admin access is available via the web portal.
      </Text>
      <Text style={styles.roleLabel}>
        Signed in as{' '}
        <Text style={styles.roleBadge}>{adminRole ?? 'unknown'}</Text>
      </Text>
      <Text
        style={styles.signOut}
        onPress={() => void handleSignOut()}
      >
        Sign out
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#15803d',
    marginBottom: 16,
  },
  notice: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 12,
  },
  roleLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 32,
  },
  roleBadge: {
    fontWeight: '600',
    color: '#15803d',
  },
  signOut: {
    fontSize: 14,
    color: '#dc2626',
    textDecorationLine: 'underline',
  },
});
