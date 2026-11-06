import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import Header from '../components/Header';
import { fetchWithAuth } from '../config/api';
import offlineService from '../services/offline.service';

export default function HomeScreen({ user, onNavigateToReceiving, onNavigateToMarketlist, onCreateMarketlist }) {
  const [marketlists, setMarketlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetchWithAuth('/marketlists?limit=15');
      if (res?.data?.items) {
        // Filter to approved & active receiving
        const active = res.data.items.filter((m) =>
          ['approved', 'in_progress', 'partially_received', 'received'].includes(m.status)
        );
        setMarketlists(active);
        await offlineService.cacheMarketlists(active);
        setIsOffline(false);
      }
    } catch (err) {
      console.warn('Network error, loading from local cache:', err.message);
      const cached = await offlineService.getCachedMarketlists();
      setMarketlists(cached);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const countApproved = marketlists.filter((m) => m.status === 'approved').length;
  const countInProgress = marketlists.filter((m) =>
    ['in_progress', 'partially_received'].includes(m.status)
  ).length;

  return (
    <View style={styles.container}>
      <Header
        title={`Halo, ${user?.name || 'Petugas'} 👋`}
        subtitle="Pos Penerimaan Gudang & Surat Jalan Digital"
        isOffline={isOffline}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Banner Quick Notice */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>📦 Aturan Penerimaan Barang</Text>
          <Text style={styles.bannerText}>
            Aplikasi ini berfungsi sebagai Surat Jalan Digital. Periksa kuantitas fisik barang yang datang sesuai Marketlist yang telah disetujui Admin.
          </Text>
        </View>

        {/* Quick Action Button */}
        <TouchableOpacity
          style={styles.createMarketlistActionBtn}
          onPress={onCreateMarketlist}
          activeOpacity={0.8}
        >
          <Text style={styles.createMarketlistActionBtnText}>📝 + Buat Marketlist Belanja Baru</Text>
        </TouchableOpacity>

        {/* 2 Big Stat Cards */}
        <View style={styles.statGrid}>
          <TouchableOpacity
            style={[styles.statCard, styles.statCardGreen]}
            onPress={onNavigateToMarketlist}
            activeOpacity={0.8}
          >
            <Text style={styles.statNumber}>{countApproved}</Text>
            <Text style={styles.statLabel}>Barang Siap Masuk (Approved)</Text>
            <Text style={styles.statAction}>Buka Daftar &rarr;</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, styles.statCardAmber]}
            onPress={onNavigateToMarketlist}
            activeOpacity={0.8}
          >
            <Text style={styles.statNumber}>{countInProgress}</Text>
            <Text style={styles.statLabel}>Penerimaan Bertahap Aktif</Text>
            <Text style={styles.statAction}>Lanjutkan Cek &rarr;</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Ready Marketlist */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Antrean Surat Jalan Terdekat</Text>
          <TouchableOpacity onPress={onNavigateToMarketlist}>
            <Text style={styles.seeAllText}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 20 }} />
        ) : marketlists.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚚</Text>
            <Text style={styles.emptyText}>Tidak ada jadwal pengiriman barang saat ini.</Text>
          </View>
        ) : (
          marketlists.slice(0, 5).map((ml) => (
            <TouchableOpacity
              key={ml._id}
              style={styles.deliveryCard}
              onPress={() => onNavigateToReceiving(ml._id)}
              activeOpacity={0.7}
            >
              <View style={styles.deliveryCardHeader}>
                <Text style={styles.deliveryMlNumber}>{ml.marketlist_number}</Text>
                <View
                  style={[
                    styles.statusPill,
                    ml.status === 'approved' ? styles.statusApproved : styles.statusProgress
                  ]}
                >
                  <Text style={styles.statusPillText}>{ml.status?.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.deliveryDate}>
                Tanggal Kebutuhan: {new Date(ml.required_date || ml.date).toLocaleDateString('id-ID')}
              </Text>
              <Text style={styles.deliveryItems}>
                Total: <Text style={styles.bold}>{ml.totals?.total_items || 0} item barang</Text> &bull; Lokasi: {ml.location_id?.name || 'Gudang Pusat'}
              </Text>

              <View style={styles.deliveryFooter}>
                <Text style={styles.openReceiptText}>Buka Surat Jalan Digital &rarr;</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  banner: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16
  },
  bannerTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  bannerText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18
  },
  createMarketlistActionBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  createMarketlistActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  statGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1
  },
  statCardGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0'
  },
  statCardAmber: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a'
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a'
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 4,
    marginBottom: 8
  },
  statAction: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a'
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b'
  },
  deliveryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2
  },
  deliveryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  deliveryMlNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusApproved: {
    backgroundColor: '#dcfce7'
  },
  statusProgress: {
    backgroundColor: '#fef3c7'
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a'
  },
  deliveryDate: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2
  },
  deliveryItems: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 10
  },
  bold: {
    fontWeight: '700',
    color: '#0f172a'
  },
  deliveryFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  openReceiptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a'
  }
});

