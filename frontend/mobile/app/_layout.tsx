import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { registerConnectivityListener } from '@/store/offline-queue';
import type { SubmissionApiClient } from '@/store/offline-queue';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Minimal API client stub — replace with the real implementation in Task 4.7
// ---------------------------------------------------------------------------
const apiClient: SubmissionApiClient = {
  async submitApplication(payload: Record<string, unknown>): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

    const response = await fetch(`${backendUrl}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status}`);
    }
  },
};

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    // Auto-flush offline queue when connectivity is restored
    const unsubscribeNetwork = registerConnectivityListener(apiClient);

    return () => {
      authListener.subscription.unsubscribe();
      unsubscribeNetwork();
    };
  }, []);

  // Redirect to login when auth state is resolved and there is no session
  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login');
    }
  }, [loading, session]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#15803d" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#15803d' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Anagu' }} />
        <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
        <Stack.Screen name="(citizen)" options={{ headerShown: false }} />
        <Stack.Screen name="(surveyor)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
});
