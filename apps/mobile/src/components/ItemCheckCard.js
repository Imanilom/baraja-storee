import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const conditions = [
  { id: 'good', label: 'Bagus' },
  { id: 'damaged', label: 'Rusak' },
  { id: 'incomplete', label: 'Kurang' },
  { id: 'expired', label: 'Kadaluwarsa' }
];

export default function ItemCheckCard({ item, state, onChange }) {
  const requestedQty = item.requested_qty || 0;
  const unit = item.product_snapshot?.unit_name || 'KG';
  const name = item.product_snapshot?.name || item.product_id?.name || 'Barang';

  const isChecked = state?.is_checked || false;
  const receivedQty = state?.received_qty !== undefined ? state.received_qty : requestedQty;
  const acceptedQty = state?.accepted_qty !== undefined ? state.accepted_qty : receivedQty;
  const rejectedQty = state?.rejected_qty !== undefined ? state.rejected_qty : Math.max(0, receivedQty - acceptedQty);
  const condition = state?.condition || 'good';
  const itemNote = state?.item_note || '';

  // Determine computed status
  let statusText = 'Belum Diperiksa';
  let statusColor = '#94a3b8';
  let statusBg = '#f1f5f9';

  if (isChecked) {
    if (acceptedQty === 0 && rejectedQty > 0) {
      statusText = 'Ditolak / Rusak Total';
      statusColor = '#ef4444';
      statusBg = '#fee2e2';
    } else if (acceptedQty === requestedQty && rejectedQty === 0) {
      statusText = 'Sesuai Kebutuhan (Complete)';
      statusColor = '#16a34a';
      statusBg = '#dcfce7';
    } else if (acceptedQty < requestedQty) {
      statusText = `Selisih Kurang (${requestedQty - acceptedQty} ${unit})`;
      statusColor = '#d97706';
      statusBg = '#fef3c7';
    } else if (acceptedQty > requestedQty) {
      statusText = `Lebih (${acceptedQty - requestedQty} ${unit})`;
      statusColor = '#2563eb';
      statusBg = '#dbeafe';
    }
  }

  return (
    <View style={[styles.card, isChecked && styles.cardChecked]}>
      {/* Header Info */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.itemName}>{name}</Text>
          <Text style={styles.requestedText}>
            Diminta di Marketlist: <Text style={styles.bold}>{requestedQty} {unit}</Text>
          </Text>
        </View>

        {/* Checkbox */}
        <TouchableOpacity
          onPress={() => onChange('is_checked', !isChecked)}
          style={[styles.checkbox, isChecked && styles.checkboxActive]}
          activeOpacity={0.8}
        >
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
      </View>

      {/* Calculated Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
      </View>

      {/* Inputs Section */}
      <View style={styles.inputGrid}>
        {/* Received Qty */}
        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Fisik Datang ({unit}):</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(receivedQty)}
            onChangeText={(val) => {
              const num = parseFloat(val) || 0;
              onChange('received_qty', num);
              onChange('accepted_qty', num);
              onChange('rejected_qty', 0);
            }}
          />
        </View>

        {/* Accepted Qty */}
        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Layak Diterima:</Text>
          <TextInput
            style={[styles.input, styles.inputAccepted]}
            keyboardType="numeric"
            value={String(acceptedQty)}
            onChangeText={(val) => {
              const num = parseFloat(val) || 0;
              onChange('accepted_qty', num);
              onChange('rejected_qty', Math.max(0, receivedQty - num));
            }}
          />
        </View>

        {/* Rejected Qty */}
        <View style={styles.inputCol}>
          <Text style={styles.inputLabel}>Ditolak / Rusak:</Text>
          <TextInput
            style={[styles.input, styles.inputRejected]}
            keyboardType="numeric"
            value={String(rejectedQty)}
            onChangeText={(val) => {
              const num = parseFloat(val) || 0;
              onChange('rejected_qty', num);
            }}
          />
        </View>
      </View>

      {/* Condition Pills */}
      <View style={styles.conditionSection}>
        <Text style={styles.subLabel}>Kondisi Barang:</Text>
        <View style={styles.conditionRow}>
          {conditions.map((c) => {
            const isSelected = condition === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => onChange('condition', c.id)}
                style={[styles.condPill, isSelected && styles.condPillActive]}
              >
                <Text style={[styles.condText, isSelected && styles.condTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Notes per item */}
      {(rejectedQty > 0 || condition !== 'good') && (
        <View style={styles.noteSection}>
          <Text style={styles.subLabel}>Keterangan Masalah / Rusak:</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Misal: Kemasan sobek, ayam berbau, dll."
            value={itemNote}
            onChangeText={(val) => onChange('item_note', val)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3
  },
  cardChecked: {
    borderColor: '#22c55e',
    backgroundColor: '#fbfdfb'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  titleContainer: {
    flex: 1,
    paddingRight: 10
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2
  },
  requestedText: {
    fontSize: 12,
    color: '#64748b'
  },
  bold: {
    fontWeight: '700',
    color: '#0f172a'
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc'
  },
  checkboxActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a'
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900'
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 12
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  inputCol: {
    flex: 1
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center'
  },
  inputAccepted: {
    color: '#15803d',
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4'
  },
  inputRejected: {
    color: '#b91c1c',
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2'
  },
  conditionSection: {
    marginBottom: 8
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 6
  },
  condPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  condPillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  condText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500'
  },
  condTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  noteSection: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  noteInput: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#7f1d1d'
  }
});
