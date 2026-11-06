import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import Header from '../components/Header';
import ItemCheckCard from '../components/ItemCheckCard';
import { fetchWithAuth } from '../config/api';
import offlineService from '../services/offline.service';

export default function ReceivingScreen({ marketlistId, user, onFinish }) {
  const [marketlist, setMarketlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [itemStates, setItemStates] = useState({});
  const [generalCondition, setGeneralCondition] = useState('Semua barang datang dalam kondisi baik');
  const [marketlistNote, setMarketlistNote] = useState('');
  const [evidenceList, setEvidenceList] = useState([]);

  useEffect(() => {
    async function loadDetail() {
      if (!marketlistId) {
        // If not selected, fetch first approved marketlist
        try {
          const res = await fetchWithAuth('/marketlists?status=approved&limit=1');
          if (res?.data?.items?.length > 0) {
            loadMl(res.data.items[0]._id);
          } else {
            setLoading(false);
          }
        } catch {
          setLoading(false);
        }
        return;
      }
      loadMl(marketlistId);
    }

    async function loadMl(id) {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`/marketlists/${id}`);
        if (res?.data) {
          setMarketlist(res.data);
          setMarketlistNote(res.data.note || '');

          // Initialize item inspection states
          const initial = {};
          (res.data.items || []).forEach((it) => {
            initial[it._id] = {
              is_checked: true,
              received_qty: it.requested_qty,
              accepted_qty: it.requested_qty,
              rejected_qty: 0,
              condition: 'good',
              item_note: ''
            };
          });
          setItemStates(initial);
        }
      } catch (err) {
        Alert.alert('Gagal Memuat', err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [marketlistId]);

  const handleItemChange = (itemId, field, value) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value
      }
    }));
  };

  const handleAddEvidenceMock = () => {
    const mockPhotos = [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=300',
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300'
    ];
    const newPhoto = mockPhotos[evidenceList.length % mockPhotos.length];
    setEvidenceList([...evidenceList, { url: newPhoto, uploaded_at: new Date().toISOString() }]);
    Alert.alert('Foto Terlampir', 'Foto bukti fisik berhasil ditambahkan ke surat jalan.');
  };

  const handleSubmitReceiving = async () => {
    if (!marketlist) return;

    // Check if at least one item is checked
    const itemsPayload = Object.entries(itemStates).map(([itemId, st]) => ({
      marketlist_item_id: itemId,
      received_qty: Number(st.received_qty) || 0,
      accepted_qty: Number(st.accepted_qty) || 0,
      rejected_qty: Number(st.rejected_qty) || 0,
      is_checked: Boolean(st.is_checked),
      condition: st.condition || 'good',
      item_note: st.item_note || '',
      evidence: evidenceList
    }));

    if (itemsPayload.length === 0) {
      Alert.alert('Perhatian', 'Tidak ada barang yang diperiksa.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        general_condition: generalCondition,
        attachments: evidenceList,
        items: itemsPayload
      };

      // 1. Submit goods receipt (supports offline fallback & idempotency)
      const receiptRes = await offlineService.submitGoodsReceipt(marketlist._id, payload);

      // 2. Update single marketlist note if modified
      if (marketlistNote) {
        try {
          await fetchWithAuth(`/marketlists/${marketlist._id}/notes`, {
            method: 'PUT',
            body: JSON.stringify({ note: marketlistNote })
          });
        } catch {}
      }

      if (receiptRes.isOffline) {
        Alert.alert(
          'Tersimpan Offline',
          'Koneksi internet tidak tersedia. Data surat jalan telah disimpan secara lokal di perangkat dan akan disinkronkan saat terhubung kembali.',
          [{ text: 'OK', onPress: onFinish }]
        );
      } else {
        Alert.alert(
          'Penerimaan Berhasil!',
          `Dokumen Surat Jalan ${receiptRes.data?.receipt_number || ''} telah tersimpan dan diverifikasi oleh sistem.`,
          [{ text: 'OK', onPress: onFinish }]
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Gagal menyimpan penerimaan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Memuat Surat Jalan Digital...</Text>
      </View>
    );
  }

  if (!marketlist) {
    return (
      <View style={styles.container}>
        <Header title="Surat Jalan Digital" subtitle="Penerimaan Barang" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Pilih Dokumen Marketlist</Text>
          <Text style={styles.emptyDesc}>
            Silakan pilih Marketlist berstatus Approved dari menu tab "Marketlist" terlebih dahulu.
          </Text>
        </View>
      </View>
    );
  }

  const items = marketlist.items || [];
  const checkedCount = Object.values(itemStates).filter((s) => s.is_checked).length;

  return (
    <View style={styles.container}>
      <Header
        title="Dokumen Surat Jalan Digital"
        subtitle={`${marketlist.marketlist_number} • ${marketlist.status?.toUpperCase()}`}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Document Header Card */}
        <View style={styles.docHeader}>
          <View style={styles.docRow}>
            <View>
              <Text style={styles.docLabel}>Nomor Dokumen:</Text>
              <Text style={styles.docValue}>{marketlist.marketlist_number}</Text>
            </View>
            <View style={styles.alignRight}>
              <Text style={styles.docLabel}>Status Marketlist:</Text>
              <Text style={styles.docStatus}>{marketlist.status?.toUpperCase()}</Text>
            </View>
          </View>

          <View style={[styles.docRow, { marginTop: 8 }]}>
            <View>
              <Text style={styles.docLabel}>Tanggal Kebutuhan:</Text>
              <Text style={styles.docSubValue}>
                {new Date(marketlist.required_date || marketlist.date).toLocaleDateString('id-ID')}
              </Text>
            </View>
            <View style={styles.alignRight}>
              <Text style={styles.docLabel}>Petugas Penerima:</Text>
              <Text style={styles.docSubValue}>{user?.name || 'Receiver A'}</Text>
            </View>
          </View>

          {/* Progress Pill */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Barang diperiksa: <Text style={styles.bold}>{checkedCount} dari {items.length} item</Text>
            </Text>
          </View>
        </View>

        {/* Item Cards Checklist */}
        <Text style={styles.sectionTitle}>Checklist Pemeriksaan Fisik:</Text>
        {items.map((it) => (
          <ItemCheckCard
            key={it._id}
            item={it}
            state={itemStates[it._id]}
            onChange={(field, val) => handleItemChange(it._id, field, val)}
          />
        ))}

        {/* Photo Evidence Section */}
        <View style={styles.evidenceSection}>
          <View style={styles.evidenceHeader}>
            <Text style={styles.sectionTitle}>Foto Bukti & Nota Fisik:</Text>
            <TouchableOpacity onPress={handleAddEvidenceMock} style={styles.addPhotoBtn}>
              <Text style={styles.addPhotoText}>+ Ambil / Lampirkan Foto</Text>
            </TouchableOpacity>
          </View>

          {evidenceList.length === 0 ? (
            <Text style={styles.evidencePlaceholder}>
              Belum ada foto bukti fisik atau nota yang dilampirkan.
            </Text>
          ) : (
            <View style={styles.evidenceBadgeList}>
              {evidenceList.map((ev, i) => (
                <View key={i} style={styles.evidenceBadge}>
                  <Text style={styles.evidenceBadgeText}>📸 Bukti #{i + 1} Terlampir</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Single Note Section */}
        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>Catatan Evaluasi / Kendala (Satu Catatan):</Text>
          <TextInput
            style={styles.noteTextArea}
            multiline
            numberOfLines={3}
            placeholder="Contoh: Pengiriman ayam kurang 5 KG, menunggu susulan. Bawang kondisi sangat segar."
            value={marketlistNote}
            onChangeText={setMarketlistNote}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmitReceiving}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>Simpan & Konfirmasi Penerimaan</Text>
          )}
        </TouchableOpacity>
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
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a'
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18
  },
  docHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  alignRight: {
    alignItems: 'flex-end'
  },
  docLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2
  },
  docValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  docSubValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  docStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  progressContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  progressText: {
    fontSize: 12,
    color: '#475569'
  },
  bold: {
    fontWeight: '700',
    color: '#0f172a'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10
  },
  evidenceSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  evidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  addPhotoBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  addPhotoText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '700'
  },
  evidencePlaceholder: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  evidenceBadgeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  evidenceBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  evidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155'
  },
  noteBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 6
  },
  noteTextArea: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#78350f',
    textAlignVertical: 'top'
  },
  submitBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  }
});
