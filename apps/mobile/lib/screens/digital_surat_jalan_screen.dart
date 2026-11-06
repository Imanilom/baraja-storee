import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../services/api_service.dart';
import '../services/offline_service.dart';

class DigitalSuratJalanScreen extends StatefulWidget {
  final dynamic marketlist;

  const DigitalSuratJalanScreen({super.key, required this.marketlist});

  @override
  State<DigitalSuratJalanScreen> createState() => _DigitalSuratJalanScreenState();
}

class _ItemReceivingState {
  final String itemId;
  final String productName;
  final String unitName;
  final double requestedQty;
  final String? supplierId;
  double receivedQty;
  double acceptedQty;
  double rejectedQty;
  String condition;
  bool isChecked;

  _ItemReceivingState({
    required this.itemId,
    required this.productName,
    required this.unitName,
    required this.requestedQty,
    this.supplierId,
    required this.receivedQty,
    required this.acceptedQty,
    required this.rejectedQty,
    this.condition = 'good',
    this.isChecked = false,
  });
}

class _DigitalSuratJalanScreenState extends State<DigitalSuratJalanScreen> {
  final List<_ItemReceivingState> _checkItems = [];
  final _noteController = TextEditingController();
  final _photoRefController = TextEditingController();

  bool _isLoadingNote = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _initItems();
    if (_checkItems.isEmpty) {
      _loadMarketlistDetail();
    }
    _loadMarketlistNote();
  }

  Future<void> _loadMarketlistDetail() async {
    final mlId = widget.marketlist['_id'];
    try {
      final res = await ApiService.get('/marketlists/$mlId');
      final data = res['data'] ?? res;
      if (data != null && data['items'] is List && (data['items'] as List).isNotEmpty) {
        setState(() {
          _checkItems.clear();
          for (final it in (data['items'] as List)) {
            final p = it['product_id'];
            final pName = p is Map ? p['name'] : (it['product_snapshot']?['name'] ?? it['product_name'] ?? 'Barang');
            final uName = p is Map && p['unit_id'] is Map
                ? p['unit_id']['name']
                : (it['product_snapshot']?['unit_name'] ?? 'Satuan');
            final reqQty = (it['requested_qty'] as num?)?.toDouble() ?? 1.0;

            _checkItems.add(_ItemReceivingState(
              itemId: it['_id']?.toString() ?? '',
              productName: pName,
              unitName: uName,
              requestedQty: reqQty,
              supplierId: it['supplier_id'] is Map
                  ? it['supplier_id']['_id']
                  : it['supplier_id']?.toString(),
              receivedQty: reqQty,
              acceptedQty: reqQty,
              rejectedQty: 0,
              condition: 'good',
              isChecked: true,
            ));
          }
        });
      }
    } catch (_) {}
  }

  void _initItems() {
    final rawItems = widget.marketlist['items'] is List
        ? widget.marketlist['items'] as List
        : [];

    for (final it in rawItems) {
      final p = it['product_id'];
      final pName = p is Map ? p['name'] : (it['product_name'] ?? 'Barang');
      final uName = p is Map && p['unit_id'] is Map ? p['unit_id']['name'] : 'Satuan';
      final reqQty = (it['requested_qty'] as num?)?.toDouble() ?? 1.0;

      _checkItems.add(_ItemReceivingState(
        itemId: it['_id']?.toString() ?? '',
        productName: pName,
        unitName: uName,
        requestedQty: reqQty,
        supplierId: it['supplier_id'] is Map
            ? it['supplier_id']['_id']
            : it['supplier_id']?.toString(),
        receivedQty: reqQty,
        acceptedQty: reqQty,
        rejectedQty: 0,
        condition: 'good',
        isChecked: true,
      ));
    }
  }

  Future<void> _loadMarketlistNote() async {
    final mlId = widget.marketlist['_id'];
    try {
      final res = await ApiService.get('/marketlists/$mlId/notes');
      if (res['data'] != null && res['data']['content'] != null) {
        _noteController.text = res['data']['content'];
      }
    } catch (_) {}
    finally {
      if (mounted) setState(() => _isLoadingNote = false);
    }
  }

  Future<void> _handleSaveReceipt() async {
    final mlId = widget.marketlist['_id'];
    setState(() => _isSaving = true);

    final payload = {
      'client_request_id': const Uuid().v4(),
      'supplier_id': _checkItems.first.supplierId,
      'items': _checkItems.map((ci) => {
        'marketlist_item_id': ci.itemId,
        'received_qty': ci.receivedQty,
        'accepted_qty': ci.acceptedQty,
        'rejected_qty': ci.rejectedQty,
        'condition': ci.condition,
        'is_checked': ci.isChecked,
      }).toList(),
      'note': _noteController.text.trim(),
      'photos': _photoRefController.text.trim().isNotEmpty
          ? [_photoRefController.text.trim()]
          : [],
    };

    try {
      // 1. Update Marketlist note jika ada isi
      if (_noteController.text.trim().isNotEmpty) {
        await ApiService.put('/marketlists/$mlId/notes', {
          'content': _noteController.text.trim(),
        }).catchError((_) {});
      }

      // 2. Submit Goods Receipt
      await ApiService.post('/receiving/receipts/$mlId', payload);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF16A34A),
            content: Text('✅ Penerimaan barang berhasil diverifikasi & disimpan!'),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      // Jika jaringan gagal, simpan ke offline queue
      await OfflineService.enqueueReceipt(mlId, payload);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFFD97706),
            content: Text(
              '⚠️ Koneksi offline. Data surat jalan tersimpan di antrean lokal dan akan disinkronkan otomatis.',
            ),
            duration: Duration(seconds: 4),
          ),
        );
        Navigator.pop(context, true);
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ml = widget.marketlist;
    final code = ml['marketlist_number'] ?? ml['code'] ?? 'SURAT-JALAN';
    final dateStr = ml['date'] != null ? ml['date'].toString().split('T')[0] : '-';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Surat Jalan Digital',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
            Text(
              code,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF0284C7),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: ElevatedButton.icon(
            onPressed: _isSaving ? null : _handleSaveReceipt,
            icon: _isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_circle_outline),
            label: Text(
              _isSaving ? 'Menyimpan...' : 'Simpan Penerimaan Barang',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Info Dokumen
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'DOKUMEN PENERIMAAN FISIK',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF15803D),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'SIAP VERIFIKASI',
                          style: TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Marketlist: $code',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  Text(
                    'Tanggal Permintaan: $dateStr',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Item Checklist Section
            Text(
              'Pemeriksaan Fisik Barang (${_checkItems.length})',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 10),

            ..._checkItems.asMap().entries.map((entry) {
              final idx = entry.key;
              final ci = entry.value;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: ci.isChecked ? const Color(0xFF86EFAC) : const Color(0xFFE2E8F0),
                    width: ci.isChecked ? 1.5 : 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            '${idx + 1}. ${ci.productName}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ),
                        Checkbox(
                          value: ci.isChecked,
                          activeColor: const Color(0xFF16A34A),
                          onChanged: (val) {
                            setState(() => ci.isChecked = val ?? false);
                          },
                        ),
                      ],
                    ),
                    Text(
                      'Target Surat Jalan: ${ci.requestedQty} ${ci.unitName}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Inputs: Diterima, Baik, Rusak
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            initialValue: ci.receivedQty.toString(),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Diterima',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            onChanged: (val) {
                              setState(() {
                                ci.receivedQty = double.tryParse(val) ?? 0;
                              });
                            },
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: TextFormField(
                            initialValue: ci.acceptedQty.toString(),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Diterima Baik',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            onChanged: (val) {
                              setState(() {
                                ci.acceptedQty = double.tryParse(val) ?? 0;
                              });
                            },
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: TextFormField(
                            initialValue: ci.rejectedQty.toString(),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Ditolak/Rusak',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            onChanged: (val) {
                              setState(() {
                                ci.rejectedQty = double.tryParse(val) ?? 0;
                              });
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Dropdown Kondisi Barang
                    DropdownButtonFormField<String>(
                      value: ci.condition,
                      decoration: const InputDecoration(
                        labelText: 'Kondisi Fisik',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: const [
                        DropdownMenuItem(value: 'good', child: Text('✅ Baik & Sesuai')),
                        DropdownMenuItem(value: 'shortage', child: Text('⚠️ Kurang (Shortage)')),
                        DropdownMenuItem(value: 'overage', child: Text('➕ Lebih (Overage)')),
                        DropdownMenuItem(value: 'damaged', child: Text('❌ Rusak / Cacat')),
                      ],
                      onChanged: (val) {
                        setState(() => ci.condition = val ?? 'good');
                      },
                    ),
                  ],
                ),
              );
            }),

            const SizedBox(height: 16),

            // One Marketlist Note Section
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.notes, size: 18, color: Color(0xFFD97706)),
                      SizedBox(width: 6),
                      Text(
                        'One Marketlist Note (Catatan Tunggal)',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Catatan evaluasi terpusat untuk Surat Jalan ini (tercatat di audit log).',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 10),
                  _isLoadingNote
                      ? const Center(child: CircularProgressIndicator())
                      : TextField(
                          controller: _noteController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            hintText: 'Tuliskan catatan kondisi pengiriman atau keterangan penerimaan...',
                            border: OutlineInputBorder(),
                          ),
                        ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Lampiran / Ref Bukti Foto
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.camera_alt_outlined, size: 18, color: Color(0xFF0284C7)),
                      SizedBox(width: 6),
                      Text(
                        'Referensi Bukti Foto / Nota Fisik',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _photoRefController,
                    decoration: const InputDecoration(
                      hintText: 'Contoh: foto-nota-surat-jalan-01.jpg atau URL gambar',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}

