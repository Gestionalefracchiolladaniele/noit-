import type { FallbackProps } from 'react-error-boundary';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * TEMP diagnostic fallback. Instead of the app silently crashing to the home
 * screen, this renders the actual error + stack on-screen (red text) so we can
 * read what's failing on the device without USB/adb. Remove once the post-auth
 * crash is diagnosed.
 */
export function CrashScreen({ error }: FallbackProps) {
  const err = error as Error;
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>⚠️ Crash caught</Text>
        <Text style={styles.label}>Message:</Text>
        <Text style={styles.msg}>{err?.message ?? String(error)}</Text>
        <Text style={styles.label}>Name:</Text>
        <Text style={styles.msg}>{err?.name ?? 'unknown'}</Text>
        <Text style={styles.label}>Stack:</Text>
        <Text style={styles.stack}>{err?.stack ?? 'no stack'}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A0B2E',
  },
  content: {
    padding: 24,
    paddingTop: 80,
  },
  title: {
    color: '#FF6B6B',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    color: '#FFD166',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  msg: {
    color: '#FF9F9F',
    fontSize: 15,
    lineHeight: 21,
  },
  stack: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
});
