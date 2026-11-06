import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import Header from '../components/Header';
import { fetchWithAuth } from '../config/api';
import offlineService from '../services/offline.service';

export default function MarketlistScreen({ onSelectMarketlist }) {
  const [marketlists, setMarketlists] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMarketlists = async () => {
    try {
      const res = await fetchWithAuth('/marketlists?limit=30');
      if (res?.data?.items) {
        const approvedOnly = res.data.items.filter((m) =>
          ['approved', 'in_progress', 'partially_received', 'received'].includes(m.status)
        );
        setMarketlists(approvedOnly);
        await offlineService.cacheMarketlists(approvedOnly);
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

  const filtered = marketlists.filter(
    (m) =>
      m.marketlist_number.toLowerCase().includes(search.toLowerCase()) ||
      (m.location_id?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Header
        title="Daftar Surat Jalan / Marketlist"
        subtitle="Hanya menampilkan dokumen yang telah disetujui Admin"
      />

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nomor ML atau lokasi..."
          value={search}
          onChangeText={setSearch}
        />
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
              <Text style={styles.emptyText}>Tidak ada Marketlist approved ditemukan.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectMarketlist(item._id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.mlNumber}>{item.marketlist_number}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{item.status?.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.dateText}>
                Tanggal Kebutuhan: {new Date(item.required_date || item.date).toLocaleDateString('id-ID')}
              </Text>
              <Text style={styles.infoText}>
                Lokasi: {item.location_id?.name || 'Gudang Pusat'} &bull; {item.totals?.total_items || 0} item
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.actionBtn}>Buka Surat Jalan & Pemeriksaan &rarr;</Text>
              </View>
            </TouchableOpacity>
          )}
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a'
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
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
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534'
  },
  dateText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2
  },
  infoText: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 12
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
  emptyContainer: {
    padding: 32,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8'
  }
});
