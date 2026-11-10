import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../../lib/supabase';
import { useMqtt } from '../../hooks/useMqtt';
import {
  dequeue,
  flushQueue,
  retryFailedSubmission,
  subscribeToQueue,
} from '../../store/offline-queue';
import type { QueuedSubmission } from '../../store/offline-queue';
import { submitApplication } from '../../lib/applications-api';

interface Application {
  id: string;
  parcel_ref: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#16A34A', in_review: '#D97706',
  legal_pending: '#C2410C',
  rejected: '#DC2626', pending: '#6B7280', approved: '#2563EB',
};

export default function StatusScreen() {
  const [apps, setApps] = useState<Application[]>([]);
  const [queued, setQueued] = useState<QueuedSubmission[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadApps();
  }, []);

  const refreshQueue = useCallback(() => {
    setQueued(dequeue());
  }, []);

  useEffect(() => {
    refreshQueue();
    return subscribeToQueue(refreshQueue);
  }, [refreshQueue]);

  const loadApps = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('applications')
      .select('id, parcel_ref, status, created_at')
      .eq('citizen_id', user.id)
      .order('created_at', { ascending: false });
    setApps((data ?? []) as Application[]);
    setLoading(false);
    refreshQueue();
  };

  const onMqttMessage = useCallback((_topic: string, payload: unknown) => {
    const msg = payload as { applicationId: string; status: string };
    if (msg?.applicationId && msg?.status) {
      setApps(prev => prev.map(a => a.id === msg.applicationId ? { ...a, status: msg.status } : a));
    }
  }, []);

  useMqtt('land/registration/status', onMqttMessage);

  const handleRetry = async (item: QueuedSubmission) => {
    setRetryError(null);
    try {
      const network = await NetInfo.fetch();
      if (!network.isConnected) {
        setRetryError('Reconnect to the internet before retrying this submission.');
        return;
      }
      if (!retryFailedSubmission(item.id)) return;

      setRetryingId(item.id);
      await flushQueue({ submitApplication }, () => {});
    } catch (error) {
      setRetryError(
        error instanceof Error ? error.message : 'Unable to retry this submission.',
      );
    } finally {
      setRetryingId(null);
      refreshQueue();
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#2563EB" style={{ flex: 1, marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Applications</Text>
      {queued.length > 0 && (
        <View style={styles.queueSection}>
          <Text style={styles.sectionTitle}>Offline submissions</Text>
          {retryError && <Text style={styles.retryError}>{retryError}</Text>}
          {queued.map(item => {
            const parcelRef = item.payload.parcelRef;
            const label = typeof parcelRef === 'string' ? parcelRef : 'Land application';
            const failed = item.status === 'failed';
            return (
              <View key={item.id} style={styles.queueCard}>
                <View style={styles.queueCopy}>
                  <Text style={styles.parcel}>{label}</Text>
                  <Text style={[styles.status, { color: failed ? '#DC2626' : '#D97706' }]}>
                    {failed ? 'RETRY REQUIRED' : 'WAITING TO SYNC'}
                  </Text>
                  <Text style={styles.date}>
                    Saved {new Date(item.queuedAt).toLocaleString()}
                  </Text>
                </View>
                {failed && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={retryingId === item.id}
                    onPress={() => void handleRetry(item)}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryText}>
                      {retryingId === item.id ? 'Retrying…' : 'Retry'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
      <FlatList
        data={apps}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.parcel}>{item.parcel_ref}</Text>
            <Text style={[styles.status, { color: STATUS_COLORS[item.status] ?? '#6B7280' }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No applications yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1E3A5F', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  queueSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 8 },
  queueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff7ed', borderRadius: 10, padding: 14, marginBottom: 8 },
  queueCopy: { flex: 1 },
  retryButton: { backgroundColor: '#b91c1c', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, marginLeft: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  retryError: { color: '#b91c1c', marginBottom: 8 },
  parcel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  status: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  date: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});
