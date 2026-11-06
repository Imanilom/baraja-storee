import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import Header from '../components/Header';
import authService from '../services/auth.service';
import offlineService from '../services/offline.service';

export default function ProfileScreen({ user, onLogout }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const checkQueue = async () => {
    const queue = await offlineService.getPendingQueue();
    setPendingCount(queue.length);
  };

  useEffect(() => {
    checkQueue();
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await offlineService.syncPendingQueue();
      Alert.alert(
        'Sinkronisasi Selesai',
        `Berhasil menyinkronkan ${res.syncedCount} dokumen surat jalan ke server backend.`
      );
      checkQueue();
    } catch (err) {
      Alert.alert('Gagal Sinkronisasi', err.message || 'Koneksi ke backend gagal.');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Konfirmasi Keluar', 'Apakah Anda yakin ingin keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          onLogout();
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <Header title="Profil Petugas" subtitle="Pengaturan Akun & Sinkronisasi" />

      <View style={styles.content}>
        {/* User Badge Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name ? user.name[0].toUpperCase() : 'P'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'Petugas Gudang'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'receiver@baraja.com'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'RECEIVER'}</Text>
          </View>
        </View>

        {/* Offline Sync Box */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Status Sinkronisasi Offline</Text>
          <Text style={styles.sectionDesc}>
            Dokumen surat jalan tersimpan di memori perangkat saat berada di area gudang tanpa internet:
          </Text>

          <View style={styles.queueRow}>
            <Text style={styles.queueLabel}>Antrean Dokumen Offline:</Text>
            <Text style={styles.queueValue}>{pendingCount} Dokumen</Text>
          </View>

          <TouchableOpacity
            style={[styles.syncBtn, pendingCount === 0 && styles.syncBtnDisabled]}
            disabled={pendingCount === 0 || syncing}
            onPress={handleSyncNow}
            activeOpacity={0.8}
          >
            {syncing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.syncBtnText}>🔄 Sinkronkan Antrean ke Server</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  content: {
    padding: 20
  },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800'
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10
  },
  roleBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20
  },
  roleText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '800'
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14
  },
  queueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  queueLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500'
  },
  queueValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  syncBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  syncBtnDisabled: {
    backgroundColor: '#cbd5e1'
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700'
  }
});
