import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useMqtt } from '../../hooks/useMqtt';

interface Application {
  id: string;
  parcel_ref: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#16A34A', in_review: '#D97706',
  rejected: '#DC2626', pending: '#6B7280', approved: '#2563EB',
};

export default function StatusScreen() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadApps();
  }, []);

  const loadApps = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('applications')
      .select('id, parcel_ref, status, created_at')
      .eq('citizen_id', user.id)
      .order('created_at', { ascending: false });
    setApps((data ?? []) as Application[]);
    setLoading(false);
  };

  const onMqttMessage = useCallback((_topic: string, payload: unknown) => {
    const msg = payload as { applicationId: string; status: string };
    if (msg?.applicationId && msg?.status) {
      setApps(prev => prev.map(a => a.id === msg.applicationId ? { ...a, status: msg.status } : a));
    }
  }, []);

  useMqtt('land/registration/status', onMqttMessage);

  if (loading) return <ActivityIndicator size="large" color="#2563EB" style={{ flex: 1, marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Applications</Text>
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
  parcel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  status: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  date: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});
