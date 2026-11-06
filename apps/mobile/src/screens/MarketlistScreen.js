import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import Header from '../components/Header';
import { fetchWithAuth } from '../config/api';
import offlineService from '../services/offline.service';

export default function MarketlistScreen({ onSelectMarketlist, onCreateMarketlist }) {
  const [marketlists, setMarketlists] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, draft_submitted, approved
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMarketlists = async () => {
    try {
      const res = await fetchWithAuth('/marketlists?limit=50');
      if (res?.data?.items) {
        setMarketlists(res.data.items);
        await offlineService.cacheMarketlists(res.data.items);
      }
    } catch (err) {
      const cached = await offlineService.getCachedMarketlists();
      setMarketlists(cached);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMarketlists();
  }, []);

  const handleSubmitDraftToAdmin = async (mlId) => {
    Alert.alert('Submit ke Admin', 'Kirim Marketlist ini ke Admin untuk approval?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Kirim',
        onPress: async () => {
          try {
            await fetchWithAuth(`/marketlists/${mlId}/submit`, { method: 'POST' });
            Alert.alert('Berhasil', 'Marketlist telah dikirim ke Admin untuk diperiksa.');
            loadMarketlists();
          } catch (err) {
            Alert.alert('Gagal', err.message);
          }
        }
      }
    ]);
  };

  const filtered = marketlists.filter((m) => {
    const matchesSearch =
      m.marketlist_number.toLowerCase().includes(search.toLowerCase()) ||
      (m.location_id?.name || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'draft_submitted') {
      return ['draft', 'submitted', 'revision'].includes(m.status);
    }
    if (statusFilter === 'approved') {
      return ['approved', 'in_progress', 'partially_received', 'received'].includes(m.status);
    }
    return true;
  });

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'approved':
        return { bg: '#dcfce7', text: '#15803d' };
      case 'submitted':
        return { bg: '#fef3c7', text: '#b45309' };
      case 'draft':
        return { bg: '#f1f5f9', text: '#475569' };
      case 'revision':
        return { bg: '#ffedd5', text: '#c2410c' };
      case 'in_progress':
      case 'partially_received':
        return { bg: '#e0e7ff', text: '#4338ca' };
      case 'received':
        return { bg: '#ccfbf1', text: '#0f766e' };
      default:
        return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Daftar Marketlist"
        subtitle="Rencana belanja dan dokumen surat jalan fisik"
      />

      {/* Top Action Bar: Create Marketlist Button */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.createBtn} onPress={onCreateMarketlist} activeOpacity={0.8}>
          <Text style={styles.createBtnText}>+ Buat Marketlist Baru</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nomor ML atau lokasi..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setStatusFilter('all')}
          style={[styles.filterPill, statusFilter === 'all' && styles.filterPillActive]}
        >
          <Text style={[styles.filterText, statusFilter === 'all' && styles.filterTextActive]}>
            Semua ({marketlists.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setStatusFilter('draft_submitted')}
          style={[styles.filterPill, statusFilter === 'draft_submitted' && styles.filterPillActive]}
        >
          <Text style={[styles.filterText, statusFilter === 'draft_submitted' && styles.filterTextActive]}>
            Draft / Submitted
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setStatusFilter('approved')}
          style={[styles.filterPill, statusFilter === 'approved' && styles.filterPillActive]}
        >
          <Text style={[styles.filterText, statusFilter === 'approved' && styles.filterTextActive]}>
            Approved / Receiving
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadMarketlists();
          }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada Marketlist dengan filter ini.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getBadgeStyle(item.status);
            const isApproved = ['approved', 'in_progress', 'partially_received', 'received'].includes(item.status);
            const canSubmit = ['draft', 'revision'].includes(item.status);

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.mlNumber}>{item.marketlist_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {item.status?.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dateText}>
                  Tanggal Kebutuhan: {new Date(item.required_date || item.date).toLocaleDateString('id-ID')}
                </Text>
                <Text style={styles.infoText}>
                  Total: <Text style={styles.bold}>{item.totals?.total_items || 0} item</Text> &bull; Rp {(item.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                </Text>

                {/* Actions */}
                <View style={styles.cardFooter}>
                  {isApproved ? (
                    <TouchableOpacity onPress={() => onSelectMarketlist(item._id)}>
                      <Text style={styles.actionBtn}>Buka Surat Jalan & Pemeriksaan &rarr;</Text>
                    </TouchableOpacity>
                  ) : canSubmit ? (
                    <TouchableOpacity onPress={() => handleSubmitDraftToAdmin(item._id)}>
                      <Text style={styles.submitDraftBtn}>✈️ Ajukan ke Admin untuk Approval &rarr;</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.waitingText}>⏳ Sedang menunggu review Admin...</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12
  },
  createBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a'
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#e2e8f0'
  },
  filterPillActive: {
    backgroundColor: '#0f172a'
  },
  filterText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600'
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  listContent: {
    padding: 16,
    paddingTop: 6,
    paddingBottom: 30
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  mlNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  dateText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2
  },
  infoText: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 10
  },
  bold: {
    fontWeight: '700',
    color: '#0f172a'
  },
  cardFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  actionBtn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a'
  },
  submitDraftBtn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706'
  },
  waitingText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic'
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8'
  }
});
