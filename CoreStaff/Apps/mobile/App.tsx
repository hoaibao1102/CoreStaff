import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from './src/config';

interface HealthResponse {
  status: string;
  service: string;
  mongo: 'configured' | 'missing';
  timezone: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/healthz`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CoreStaff</Text>
      <Text style={styles.subtitle}>Employee App — SHOULD (Sprint 8)</Text>

      <View style={styles.card}>
        <Text style={styles.label}>API health</Text>
        {error && <Text style={styles.bad}>Không kết nối được: {error}</Text>}
        {!error && !health && <ActivityIndicator color="#174ea6" />}
        {health && (
          <>
            <Text style={styles.row}>Service: {health.service}</Text>
            <Text style={styles.row}>Status: {health.status}</Text>
            <Text style={styles.row}>MongoDB: {health.mongo}</Text>
            <Text style={styles.row}>Timezone: {health.timezone}</Text>
          </>
        )}
      </View>

      <Text style={styles.foot}>
        Attendance/leave/OT flows sẽ đổ vào Sprint 4–5. Employee self-profile ở Sprint 2–3.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#122036',
  },
  subtitle: {
    color: '#66758b',
    marginBottom: 20,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 14,
    padding: 20,
    gap: 6,
  },
  label: {
    fontWeight: '700',
    color: '#122036',
    marginBottom: 4,
  },
  row: {
    color: '#122036',
  },
  bad: {
    color: '#b3261e',
  },
  foot: {
    color: '#9aabc0',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
});