import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { enqueue } from '../../store/offline-queue';
import { supabase } from '../../lib/supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export default function SubmitScreen() {
  const [form, setForm] = useState({
    ownerName: '', documentNumber: '', documentType: '',
    issuingAuthority: '', parcelRef: '', ownerWalletAddress: '',
    parcelCoordinates: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'queued' | 'submitted' | 'error'>('idle');
  const [resultId, setResultId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      let parcelRing: { coordinates: [number, number][] };
      try {
        parcelRing = { coordinates: JSON.parse(form.parcelCoordinates) as [number, number][] };
      } catch {
        setErrorMsg('Invalid coordinate JSON. Example: [[3.0,6.0],[4.0,6.0],[4.0,7.0],[3.0,7.0]]');
        setStatus('error');
        return;
      }

      const payload = {
        ownerName: form.ownerName,
        ownerWalletAddress: form.ownerWalletAddress,
        documentNumber: form.documentNumber,
        documentType: form.documentType,
        issuingAuthority: form.issuingAuthority,
        parcelRef: form.parcelRef,
        parcelRing,
      };

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        enqueue(payload);
        setStatus('queued');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';

      const res = await fetch(`${BACKEND_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text();
        setErrorMsg(`Submission failed: ${body}`);
        setStatus('error');
        return;
      }

      const json = await res.json() as { id: string };
      setResultId(json.id);
      setStatus('submitted');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  const field = (label: string, key: keyof typeof form, multi = false) => (
    <View style={styles.fieldWrap} key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multi && styles.multiline]}
        value={form[key]}
        onChangeText={(v) => setForm(f => ({ ...f, [key]: v }))}
        multiline={multi}
        numberOfLines={multi ? 4 : 1}
        placeholder={multi ? 'Paste coordinate JSON array' : ''}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Submit Land Registration</Text>
      {field('Owner Name', 'ownerName')}
      {field('Document Number', 'documentNumber')}
      {field('Document Type', 'documentType')}
      {field('Issuing Authority', 'issuingAuthority')}
      {field('Parcel Reference', 'parcelRef')}
      {field('Owner Wallet Address', 'ownerWalletAddress')}
      {field('Parcel Coordinates (JSON)', 'parcelCoordinates', true)}

      {status === 'loading' && <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 16 }} />}
      {status === 'submitted' && <Text style={styles.success}>✅ Submitted — Application ID: {resultId}</Text>}
      {status === 'queued' && <Text style={styles.queued}>📶 Offline — Queued for submission when back online</Text>}
      {status === 'error' && <Text style={styles.error}>❌ {errorMsg}</Text>}

      {status !== 'loading' && (
        <TouchableOpacity style={styles.btn} onPress={() => void handleSubmit()}>
          <Text style={styles.btnText}>Submit Application</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#1E3A5F' },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, backgroundColor: '#fff', fontSize: 14 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  btn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  success: { color: '#16A34A', fontSize: 14, marginVertical: 8 },
  queued: { color: '#D97706', fontSize: 14, marginVertical: 8 },
  error: { color: '#DC2626', fontSize: 14, marginVertical: 8 },
});
