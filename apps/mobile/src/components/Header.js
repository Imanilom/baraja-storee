import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Header({ title, subtitle, isOffline = false }) {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {isOffline && (
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineText}>OFFLINE MODE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    paddingTop: 45,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  textContainer: {
    flex: 1
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  offlineBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  offlineText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '700'
  }
});

