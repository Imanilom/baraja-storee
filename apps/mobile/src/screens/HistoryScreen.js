import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import Header from '../components/Header';
import offlineService from '../services/offline.service';

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [hist, queue] = await Promise.all([
        offlineService.getLocalHistory(),
        offlineService.getPendingQueue()
      ]);
      setHistory(hist);
      setPendingQueue(queue);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title="Riwayat Surat Jalan"
        subtitle="Dokumen penerimaan barang yang telah diperiksa"
      />

      <View style={styles.content}>
        {/* Pending Offline Sync Notice if any */}
        {pendingQueue.length > 0 && (
          <View style={styles.offlineAlert}>
            <Text style={styles.offlineAlertTitle}>
              ⚠️ {pendingQueue.length} Surat Jalan Belum Tersinkron ke Server
            </Text>
            <Text style={styles.offlineAlertDesc}>
              Buka menu Profile untuk menyinkronkan dokumen offline saat jaringan stabil.
            </Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 24 }} />
        ) : history.length === 0 && pendingQueue.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>Belum ada riwayat penerimaan barang.</Text>
          </View>
        ) : (
          <FlatList
            data={[
              ...pendingQueue.map((q, idx) => ({
                _id: 'pending-' + idx,
                isPending: true,
                receipt_number: 'GR-OFFLINE-PENDING',
                received_at: q.queued_at,
                items: q.payload.items,
                general_condition: q.payload.general_condition
              })),
              ...history
            ]}
            keyExtractor={(item) => item._id || item.receipt_number}
            renderItem={({ item }) => (
              <View style={[styles.card, item.isPending && styles.cardPending]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.receiptNumber}>{item.receipt_number}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      item.isPending ? styles.pillPending : styles.pillSynced
                    ]}
                  >
                    <Text style={styles.pillText}>
                      {item.isPending ? 'OFFLINE QUEUE' : 'TERVERIFIKASI'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dateText}>
                  Waktu: {new Date(item.received_at || Date.now()).toLocaleString('id-ID')}
                </Text>
                <Text style={styles.conditionText}>
                  Kondisi: <Text style={styles.bold}>{item.general_condition || 'Baik'}</Text>
                </Text>
                <Text style={styles.itemsSummary}>
                  {item.items?.length || 0} jenis barang diperiksa fisik
                </Text>
              </View>
            )}
          />
        )}
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
    flex: 1,
    padding: 16
  },
  offlineAlert: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  offlineAlertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 2
  },
  offlineAlertDesc: {
    fontSize: 11,
    color: '#b45309'
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  cardPending: {
    borderColor: '#fde68a',
    backgroundColor: '#fffdf5'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  receiptNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  pillSynced: {
    backgroundColor: '#dcfce7'
  },
  pillPending: {
    backgroundColor: '#fef3c7'
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a'
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4
  },
  conditionText: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 4
  },
  itemsSummary: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600'
  },
  bold: {
    fontWeight: '700'
  }
});

