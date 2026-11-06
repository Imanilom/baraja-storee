import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import Header from '../components/Header';
import { fetchWithAuth } from '../config/api';

export default function CreateMarketlistScreen({ onBack, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [date, setDate] = useState(todayStr);
  const [requiredDate, setRequiredDate] = useState(tomorrowStr);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState([
    { product_id: '', requested_qty: '1', unit_price: '0', supplier_id: '', notes: '' }
  ]);

  useEffect(() => {
    async function loadMasterData() {
      try {
        const [prodRes, suppRes] = await Promise.all([
          fetchWithAuth('/products?limit=50').catch(() => ({ data: [] })),
          fetchWithAuth('/suppliers?limit=50').catch(() => ({ data: [] }))
        ]);
        if (prodRes?.data) setProducts(prodRes.data);
        if (suppRes?.data) setSuppliers(suppRes.data);
      } catch (err) {
        console.warn('Failed to load master data', err);
      } finally {
        setLoadingMaster(false);
      }
    }
    loadMasterData();
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      { product_id: '', requested_qty: '1', unit_price: '0', supplier_id: '', notes: '' }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const calculateTotal = () => {
    return items.reduce((sum, it) => {
      const q = parseFloat(it.requested_qty) || 0;
      const p = parseFloat(it.unit_price) || 0;
      return sum + q * p;
    }, 0);
  };

  const handleSubmit = async (submitDirectlyToAdmin = false) => {
    const invalid = items.find((i) => !i.product_id || parseFloat(i.requested_qty) <= 0);
    if (invalid) {
      Alert.alert('Perhatian', 'Pilih nama barang dan isi kuantitas > 0 untuk semua baris.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date,
        required_date: requiredDate,
        location_id: '663673f8e538ef94b0000001', // Fallback location
        items: items.map((i) => ({
          product_id: i.product_id,
          requested_qty: Number(i.requested_qty),
          unit_price: Number(i.unit_price) || 0,
          supplier_id: i.supplier_id || undefined,
          notes: i.notes
        })),
        notes
      };

      const res = await fetchWithAuth('/marketlists', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const newMl = res.data;

      if (submitDirectlyToAdmin && newMl?._id) {
        await fetchWithAuth(`/marketlists/${newMl._id}/submit`, {
          method: 'POST'
        });
        Alert.alert(
          'Berhasil Diajukan',
          `Marketlist ${newMl.marketlist_number} berhasil dibuat dan langsung diajukan kepada Admin untuk approval!`
        );
      } else {
        Alert.alert(
          'Draft Tersimpan',
          `Marketlist ${newMl.marketlist_number} berhasil disimpan sebagai Draft.`
        );
      }

      onSuccess();
    } catch (err) {
      Alert.alert('Gagal Membuat Marketlist', err.message || 'Periksa input atau hak akses.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMaster) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Memuat katalog barang master...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Buat Marketlist Baru"
        subtitle="Rencana Kebutuhan Belanja Pengadaan Barang"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>&larr; Kembali ke Daftar</Text>
        </TouchableOpacity>

        {/* Date Inputs */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Informasi Rencana Belanja</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>Tanggal Permintaan:</Text>
              <TextInput
                style={styles.fieldInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>Dibutuhkan Pada:</Text>
              <TextInput
                style={styles.fieldInput}
                value={requiredDate}
                onChangeText={setRequiredDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        </View>

        {/* Item Rows */}
        <View style={styles.itemsHeader}>
          <Text style={styles.sectionTitle}>Daftar Kebutuhan Barang ({items.length} item):</Text>
          <TouchableOpacity onPress={handleAddItem} style={styles.addItemBtn}>
            <Text style={styles.addItemBtnText}>+ Tambah Baris</Text>
          </TouchableOpacity>
        </View>

        {items.map((row, idx) => {
          const selectedProd = products.find((p) => p._id === row.product_id);
          const unit = selectedProd?.unit_id?.abbreviation || 'KG';

          return (
            <View key={idx} style={styles.itemRowCard}>
              <View style={styles.itemRowHeader}>
                <Text style={styles.itemRowIndex}>Item #{idx + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => handleRemoveItem(idx)}>
                    <Text style={styles.removeItemText}>Hapus ✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Product Selector */}
              <Text style={styles.fieldLabel}>Pilih Barang Master:</Text>
              <View style={styles.pickerBox}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {products.map((p) => {
                    const isSelected = row.product_id === p._id;
                    return (
                      <TouchableOpacity
                        key={p._id}
                        onPress={() => handleItemChange(idx, 'product_id', p._id)}
                        style={[styles.prodPill, isSelected && styles.prodPillActive]}
                      >
                        <Text style={[styles.prodPillText, isSelected && styles.prodPillTextActive]}>
                          {p.name} ({p.unit_id?.abbreviation || 'KG'})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Qty & Price */}
              <View style={[styles.inputRow, { marginTop: 10 }]}>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabel}>Kuantitas ({unit}):</Text>
                  <TextInput
                    style={styles.fieldInput}
                    keyboardType="numeric"
                    value={row.requested_qty}
                    onChangeText={(val) => handleItemChange(idx, 'requested_qty', val)}
                  />
                </View>

                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabel}>Harga Diajukan (Rp):</Text>
                  <TextInput
                    style={styles.fieldInput}
                    keyboardType="numeric"
                    value={row.unit_price}
                    onChangeText={(val) => handleItemChange(idx, 'unit_price', val)}
                  />
                </View>
              </View>

              {/* Supplier Selector */}
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Supplier Pilihan (Opsional):</Text>
              <View style={styles.pickerBox}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {suppliers.map((s) => {
                    const isSelected = row.supplier_id === s._id;
                    return (
                      <TouchableOpacity
                        key={s._id}
                        onPress={() => handleItemChange(idx, 'supplier_id', isSelected ? '' : s._id)}
                        style={[styles.suppPill, isSelected && styles.suppPillActive]}
                      >
                        <Text style={[styles.suppPillText, isSelected && styles.suppPillTextActive]}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Subtotal preview */}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal Item:</Text>
                <Text style={styles.subtotalValue}>
                  Rp {((parseFloat(row.requested_qty) || 0) * (parseFloat(row.unit_price) || 0)).toLocaleString('id-ID')}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Total Estimated Banner */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Estimasi Total Belanja Marketlist:</Text>
          <Text style={styles.totalAmount}>Rp {calculateTotal().toLocaleString('id-ID')}</Text>
        </View>

        {/* Initial Note */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Catatan Kebutuhan Awal (Opsional):</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            numberOfLines={2}
            placeholder="Misal: Kebutuhan persiapan weekend cabang pusat."
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.saveDraftBtn}
            onPress={() => handleSubmit(false)}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.saveDraftText}>Simpan Draft</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.submitAdminBtn}
            onPress={() => handleSubmit(true)}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitAdminText}>Kirim ke Admin ➔</Text>
            )}
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13
  },
  backBtn: {
    marginBottom: 12
  },
  backBtnText: {
    color: '#16a34a',
    fontSize: 13,
    fontWeight: '700'
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10
  },
  inputCol: {
    flex: 1
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4
  },
  fieldInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a'
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  addItemBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  addItemBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a'
  },
  itemRowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  itemRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  itemRowIndex: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16a34a'
  },
  removeItemText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444'
  },
  pickerBox: {
    marginVertical: 4
  },
  prodPill: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 6
  },
  prodPillActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a'
  },
  prodPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155'
  },
  prodPillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  suppPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6
  },
  suppPillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  suppPillText: {
    fontSize: 10,
    color: '#64748b'
  },
  suppPillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  subtotalLabel: {
    fontSize: 11,
    color: '#64748b'
  },
  subtotalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  totalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center'
  },
  totalLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4
  },
  totalAmount: {
    color: '#4ade80',
    fontSize: 22,
    fontWeight: '900'
  },
  noteInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#0f172a',
    textAlignVertical: 'top'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  saveDraftBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveDraftText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700'
  },
  submitAdminBtn: {
    flex: 1.3,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 2
  },
  submitAdminText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  }
});
