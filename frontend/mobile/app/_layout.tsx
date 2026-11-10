import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { submitApplication } from '@/lib/applications-api';
import { registerConnectivityListener } from '@/store/offline-queue';
import type { SubmissionApiClient } from '@/store/offline-queue';
import type { Session } from '@supabase/supabase-js';

const apiClient: SubmissionApiClient = { submitApplication };

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        setSession(data.session);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setSessionError(
          error instanceof Error ? error.message : 'Unable to restore your session.',
        );
        setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setSessionError(null);
      },
    );

    const unsubscribeNetwork = registerConnectivityListener(apiClient);

    return () => {
      authListener.subscription.unsubscribe();
      unsubscribeNetwork();
    };
  }, []);

  useEffect(() => {
    if (!loading && !session && !sessionError) {
      router.replace('/login');
    }
  }, [loading, session, sessionError]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#15803d" />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (sessionError) {
    return (
      <View style={styles.loader}>
        <Text style={styles.error} accessibilityRole="alert">
          Unable to restore your session: {sessionError}
        </Text>
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
  error: {
    color: '#b91c1c',
    textAlign: 'center',
    padding: 24,
  },
});
