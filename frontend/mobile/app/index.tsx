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
 * the appropriate screen based on the role stored in `user_metadata.role`.
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

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace('/login');
        return;
      }

      const role: UserRole =
        (session.user.user_metadata?.role as UserRole) ?? null;

      if (cancelled) return;

      if (role === 'citizen') {
        router.replace('/(citizen)/submit');
      } else if (role === 'surveyor') {
        router.replace('/(surveyor)/parcel');
      } else if (ADMIN_ROLES.includes(role)) {
        // Stay on this screen and show the admin notice
        setAdminRole(role);
        setLoading(false);
      } else {
        // Unknown or missing role — fall back to login
        await supabase.auth.signOut();
        router.replace('/login');
      }
    }

    resolveSession().catch(() => {
      if (!cancelled) {
        router.replace('/login');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && adminRole === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#15803d" />
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
        onPress={() => {
          supabase.auth.signOut().then(() => router.replace('/login'));
        }}
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
