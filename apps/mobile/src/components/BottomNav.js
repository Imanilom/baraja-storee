import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const tabs = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'marketlist', label: 'Marketlist', icon: '📋' },
  { id: 'receiving', label: 'Receiving', icon: '📦' },
  { id: 'history', label: 'History', icon: '📑' },
  { id: 'profile', label: 'Profile', icon: '👤' }
];

export default function BottomNav({ activeTab, onSelectTab }) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <Text style={[styles.icon, isActive && styles.activeIcon]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingBottom: 16,
    justifyContent: 'space-around',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    position: 'relative'
  },
  icon: {
    fontSize: 18,
    marginBottom: 2
  },
  activeIcon: {
    transform: [{ scale: 1.1 }]
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },
  activeLabel: {
    color: '#16a34a',
    fontWeight: '700'
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 16,
    height: 3,
    backgroundColor: '#16a34a',
    borderRadius: 2
  }
});

