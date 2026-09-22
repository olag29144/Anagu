import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { supabase } from '../../lib/supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

interface SpatialResult {
  outcome: string;
  diagnosticCode?: string;
  conflictingParcelId?: string;
  bufferMetres?: number;
  checkedAt?: string;
}

export default function ParcelScreen() {
  const [applicationId, setApplicationId] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [result, setResult] = useState<SpatialResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      let parsedCoords: [number, number][];
      try {
        parsedCoords = JSON.parse(coordinates) as [number, number][];
      } catch {
        setError('Invalid JSON. Example: [[3.0,6.0],[4.0,6.0],[4.0,7.0],[3.0,7.0]]');
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      const res = await fetch(`${BACKEND_URL}/parcels/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ applicationId, parcelRing: { coordinates: parsedCoords } }),
      });

      const json = await res.json() as SpatialResult;
      setResult(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const outcomeColor = result?.outcome === 'approved' ? '#16A34A' : '#DC2626';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Parcel Coordinate Validation</Text>

      <Text style={styles.label}>Application ID</Text>
      <TextInput
        style={styles.input}
        value={applicationId}
        onChangeText={setApplicationId}
        placeholder="UUID of the application"
      />

      <Text style={styles.label}>Parcel Coordinates (JSON array)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={coordinates}
        onChangeText={setCoordinates}
        multiline
        numberOfLines={5}
        placeholder='[[3.0,6.0],[4.0,6.0],[4.0,7.0],[3.0,7.0]]'
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading
        ? <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 20 }} />
        : <TouchableOpacity style={styles.btn} onPress={() => void handleValidate()}>
            <Text style={styles.btnText}>Validate Parcel</Text>
          </TouchableOpacity>
      }

      {result && (
        <View style={[styles.resultBox, { borderColor: outcomeColor }]}>
          <Text style={[styles.outcome, { color: outcomeColor }]}>
            {result.outcome === 'approved' ? '✅ Approved' : '❌ Rejected'}
          </Text>
          {result.diagnosticCode === 'GEOM_INVALID' && (
            <Text style={styles.detail}>Invalid geometry — check coordinate format</Text>
          )}
          {result.diagnosticCode === 'PARCEL_OVERLAP' && (
            <Text style={styles.detail}>Overlaps existing parcel ID: {result.conflictingParcelId ?? 'unknown'}</Text>
          )}
          {result.checkedAt && (
            <Text style={styles.time}>Checked: {new Date(result.checkedAt).toLocaleTimeString()}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#F9FAFB' },
  title: { fontSize: 22, fontWeight: '700', color: '#1E3A5F', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, backgroundColor: '#fff', fontSize: 14 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  btn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  resultBox: { marginTop: 20, padding: 16, borderWidth: 2, borderRadius: 10, backgroundColor: '#fff' },
  outcome: { fontSize: 18, fontWeight: '700' },
  detail: { fontSize: 14, color: '#374151', marginTop: 6 },
  time: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
});
