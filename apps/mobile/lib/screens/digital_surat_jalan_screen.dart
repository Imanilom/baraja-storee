import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import '../services/api_service.dart';
import '../services/offline_service.dart';

class DigitalSuratJalanScreen extends StatefulWidget {
  final dynamic marketlist;

  const DigitalSuratJalanScreen({super.key, required this.marketlist});

  @override
  State<DigitalSuratJalanScreen> createState() =>
      _DigitalSuratJalanScreenState();
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

  late final TextEditingController receivedController;
  late final TextEditingController acceptedController;
  late final TextEditingController rejectedController;

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
    this.isChecked = true,
  }) {
    receivedController = TextEditingController(text: _formatNum(receivedQty));
    acceptedController = TextEditingController(text: _formatNum(acceptedQty));
    rejectedController = TextEditingController(text: _formatNum(rejectedQty));
  }

  void updateReceived(double newQty, {bool updateInput = true}) {
    receivedQty = newQty < 0 ? 0 : newQty;
    acceptedQty = (receivedQty - rejectedQty) < 0
        ? 0
        : (receivedQty - rejectedQty);
    _autoSetCondition();
    if (updateInput) {
      syncControllers();
    } else {
      acceptedController.text = _formatNum(acceptedQty);
    }
  }

  void adjustReceived(double delta) {
    updateReceived(receivedQty + delta);
  }

  void updateRejected(double newRej, {bool updateInput = true}) {
    rejectedQty = newRej < 0 ? 0 : newRej;
    acceptedQty = (receivedQty - rejectedQty) < 0
        ? 0
        : (receivedQty - rejectedQty);
    _autoSetCondition();
    if (updateInput) {
      syncControllers();
    } else {
      acceptedController.text = _formatNum(acceptedQty);
    }
  }

  void _autoSetCondition() {
    if (rejectedQty > 0) {
      condition = 'damaged';
    } else if (receivedQty < requestedQty) {
      condition = 'shortage';
    } else if (receivedQty > requestedQty) {
      condition = 'overage';
    } else {
      condition = 'good';
    }
  }

  void syncControllers() {
    receivedController.text = _formatNum(receivedQty);
    acceptedController.text = _formatNum(acceptedQty);
    rejectedController.text = _formatNum(rejectedQty);
  }

  static String _formatNum(double val) {
    if (val % 1 == 0) return val.toInt().toString();
    return val
        .toStringAsFixed(6)
        .replaceFirst(RegExp(r'0+$'), '')
        .replaceFirst(RegExp(r'\.$'), '');
  }

  static double _parseQty(String value) {
    return double.tryParse(value.trim().replaceAll(',', '.')) ?? 0;
  }

  void dispose() {
    receivedController.dispose();
    acceptedController.dispose();
    rejectedController.dispose();
  }
}

class _DigitalSuratJalanScreenState extends State<DigitalSuratJalanScreen> {
  final List<_ItemReceivingState> _checkItems = [];
  final _noteController = TextEditingController();
  final List<String> _photos = [];

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

  @override
  void dispose() {
    for (final it in _checkItems) {
      it.dispose();
    }
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _loadMarketlistDetail() async {
    final mlId = widget.marketlist['_id'];
    try {
      final res = await ApiService.get('/marketlists/$mlId');
      final data = res['data'] ?? res;
      if (data != null &&
          data['items'] is List &&
          (data['items'] as List).isNotEmpty) {
        setState(() {
          for (final it in _checkItems) {
            it.dispose();
          }
          _checkItems.clear();
          for (final it in (data['items'] as List)) {
            final p = it['product_id'];
            final pName = p is Map
                ? p['name']
                : (it['product_snapshot']?['name'] ??
                      it['product_name'] ??
                      'Barang');
            final uName = p is Map && p['unit_id'] is Map
                ? p['unit_id']['name']
                : (it['product_snapshot']?['unit_name'] ?? 'Satuan');
            final reqQty =
                (it['expected_receipt_qty'] as num?)?.toDouble() ??
                (it['requested_qty'] as num?)?.toDouble() ??
                1.0;

            _checkItems.add(
              _ItemReceivingState(
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
                isChecked: reqQty > 0,
              ),
            );
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
      final uName = p is Map && p['unit_id'] is Map
          ? p['unit_id']['name']
          : 'Satuan';
      final reqQty =
          (it['expected_receipt_qty'] as num?)?.toDouble() ??
          (it['requested_qty'] as num?)?.toDouble() ??
          1.0;

      _checkItems.add(
        _ItemReceivingState(
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
          isChecked: reqQty > 0,
        ),
      );
    }
  }

  Future<void> _loadMarketlistNote() async {
    final mlId = widget.marketlist['_id'];
    try {
      final res = await ApiService.get('/marketlists/$mlId/notes');
      if (res['data'] != null && res['data']['content'] != null) {
        _noteController.text = res['data']['content'];
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoadingNote = false);
    }
  }

  void _showAddPhotoDialog() {
    final customUrlController = TextEditingController();

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Tambah Bukti Penerimaan',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.camera_alt, color: Color(0xFF0284C7)),
              ),
              title: const Text('Foto Surat Jalan / Faktur Fisik'),
              subtitle: const Text('Dokumentasikan surat jalan bertandatangan'),
              onTap: () {
                final timestamp = DateFormat(
                  'yyyyMMdd_HHmmss',
                ).format(DateTime.now());
                setState(() {
                  _photos.add('surat_jalan_$timestamp.jpg');
                });
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.inventory_outlined,
                  color: Color(0xFF15803D),
                ),
              ),
              title: const Text('Foto Kondisi Fisik Barang'),
              subtitle: const Text('Dokumentasikan barang saat tiba di outlet'),
              onTap: () {
                final timestamp = DateFormat(
                  'yyyyMMdd_HHmmss',
                ).format(DateTime.now());
                setState(() {
                  _photos.add('kondisi_barang_$timestamp.jpg');
                });
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.scale_outlined,
                  color: Color(0xFFD97706),
                ),
              ),
              title: const Text('Foto Timbangan / Label Supplier'),
              subtitle: const Text(
                'Dokumentasikan bukti berat timbangan fisik',
              ),
              onTap: () {
                final timestamp = DateFormat(
                  'yyyyMMdd_HHmmss',
                ).format(DateTime.now());
                setState(() {
                  _photos.add('timbangan_$timestamp.jpg');
                });
                Navigator.pop(ctx);
              },
            ),
            const Divider(),
            TextField(
              controller: customUrlController,
              decoration: InputDecoration(
                hintText: 'Atau masukkan nama file / link foto...',
                suffixIcon: IconButton(
                  icon: const Icon(
                    Icons.add_photo_alternate,
                    color: Color(0xFFD97706),
                  ),
                  onPressed: () {
                    final text = customUrlController.text.trim();
                    if (text.isNotEmpty) {
                      setState(() => _photos.add(text));
                      Navigator.pop(ctx);
                    }
                  },
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                isDense: true,
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSaveReceipt() async {
    final mlId = widget.marketlist['_id'];
    setState(() => _isSaving = true);

    final firstSuppId = _checkItems.isNotEmpty
        ? _checkItems.first.supplierId
        : null;
    final payload = {
      'client_request_id': const Uuid().v4(),
      if (firstSuppId != null && firstSuppId.isNotEmpty)
        'supplier_id': firstSuppId,
      'items': _checkItems
          .map(
            (ci) => {
              'marketlist_item_id': ci.itemId,
              'received_qty': ci.receivedQty,
              'accepted_qty': ci.acceptedQty,
              'rejected_qty': ci.rejectedQty,
              'condition': ci.condition,
              'is_checked': ci.isChecked,
            },
          )
          .toList(),
      'note': _noteController.text.trim(),
      'photos': _photos,
      'attachments': _photos.map((p) => {'url': p, 'type': 'photo'}).toList(),
    };

    try {
      // 1. Update Marketlist note jika ada isi
      if (_noteController.text.trim().isNotEmpty) {
        await ApiService.put('/marketlists/$mlId/notes', {
          'content': _noteController.text.trim(),
        }).catchError((_) {});
      }

      // 2. Submit Goods Receipt
      await ApiService.post('/marketlists/$mlId/receipts', payload);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF16A34A),
            content: Text(
              '✅ Penerimaan barang berhasil diverifikasi & disimpan!',
            ),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (e is ApiException) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFFDC2626),
              content: Text(
                'Server menolak penerimaan (HTTP ${e.statusCode}): ${e.message}',
              ),
              duration: const Duration(seconds: 8),
            ),
          );
        }
        return;
      }

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
    final dateStr = ml['date'] != null
        ? ml['date'].toString().split('T')[0]
        : '-';

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
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'SIAP VERIFIKASI',
                          style: TextStyle(
                            fontSize: 9,
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Marketlist: $code',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  Text(
                    'Tanggal Permintaan: $dateStr',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF475569),
                    ),
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
            const SizedBox(height: 4),
            const Text(
              'Gunakan tombol [-] / [+] atau opsi cepat jika barang yang dikirim kurang dari target.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 10),

            ..._checkItems.asMap().entries.map((entry) {
              final idx = entry.key;
              final ci = entry.value;

              final isShortage = ci.receivedQty < ci.requestedQty;
              final isExact = ci.receivedQty == ci.requestedQty;
              final isOverage = ci.receivedQty > ci.requestedQty;
              final diff = (ci.requestedQty - ci.receivedQty).abs();
              final diffStr = diff % 1 == 0
                  ? diff.toInt().toString()
                  : diff.toStringAsFixed(1);

              return Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isShortage
                        ? const Color(0xFFFBBF24)
                        : (ci.isChecked
                              ? const Color(0xFF86EFAC)
                              : const Color(0xFFE2E8F0)),
                    width: isShortage || ci.isChecked ? 1.5 : 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header Nama Barang & Checkbox
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

                    // Status Badge Target vs Aktual
                    Row(
                      children: [
                        Text(
                          'Target: ${_ItemReceivingState._formatNum(ci.requestedQty)} ${ci.unitName}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (isShortage)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: const Color(0xFFFCD34D),
                              ),
                            ),
                            child: Text(
                              '⚠️ Kurang $diffStr ${ci.unitName}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFB45309),
                              ),
                            ),
                          )
                        else if (isExact)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              '✅ Sesuai Target',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF15803D),
                              ),
                            ),
                          )
                        else if (isOverage)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE0F2FE),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '➕ Lebih $diffStr ${ci.unitName}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0369A1),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Input Row: Stepper Diterima, Diterima Baik, Ditolak
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Kolom Diterima dengan tombol - dan +
                        Expanded(
                          flex: 5,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Diterima Fisik',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF475569),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  IconButton(
                                    onPressed: () {
                                      setState(() {
                                        ci.adjustReceived(-1);
                                      });
                                    },
                                    icon: const Icon(
                                      Icons.remove_circle_outline,
                                      color: Color(0xFFDC2626),
                                    ),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(
                                      minWidth: 32,
                                      minHeight: 32,
                                    ),
                                    iconSize: 24,
                                    tooltip: 'Kurangi 1',
                                  ),
                                  Expanded(
                                    child: TextFormField(
                                      controller: ci.receivedController,
                                      keyboardType:
                                          const TextInputType.numberWithOptions(
                                            decimal: true,
                                          ),
                                      textAlign: TextAlign.center,
                                      decoration: InputDecoration(
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 8,
                                            ),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                        ),
                                        isDense: true,
                                      ),
                                      onChanged: (val) {
                                        setState(() {
                                          ci.updateReceived(
                                            _ItemReceivingState._parseQty(val),
                                            updateInput: false,
                                          );
                                        });
                                      },
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: () {
                                      setState(() {
                                        ci.adjustReceived(1);
                                      });
                                    },
                                    icon: const Icon(
                                      Icons.add_circle_outline,
                                      color: Color(0xFF16A34A),
                                    ),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(
                                      minWidth: 32,
                                      minHeight: 32,
                                    ),
                                    iconSize: 24,
                                    tooltip: 'Tambah 1',
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Kolom Diterima Baik
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Baik',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF15803D),
                                ),
                              ),
                              const SizedBox(height: 4),
                              TextFormField(
                                controller: ci.acceptedController,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                textAlign: TextAlign.center,
                                decoration: InputDecoration(
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 8,
                                  ),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  isDense: true,
                                ),
                                onChanged: (val) {
                                  setState(() {
                                    ci.acceptedQty =
                                        _ItemReceivingState._parseQty(val);
                                  });
                                },
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),

                        // Kolom Ditolak / Rusak
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Rusak',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFB91C1C),
                                ),
                              ),
                              const SizedBox(height: 4),
                              TextFormField(
                                controller: ci.rejectedController,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                textAlign: TextAlign.center,
                                decoration: InputDecoration(
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 8,
                                  ),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  isDense: true,
                                ),
                                onChanged: (val) {
                                  setState(() {
                                    ci.updateRejected(
                                      _ItemReceivingState._parseQty(val),
                                      updateInput: false,
                                    );
                                  });
                                },
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Quick Action Buttons (Shortcut Kurangi / Pas)
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          OutlinedButton(
                            onPressed: () {
                              setState(() {
                                ci.updateReceived(ci.requestedQty);
                              });
                            },
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              minimumSize: const Size(50, 26),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                            ),
                            child: Text(
                              'Pas (${_ItemReceivingState._formatNum(ci.requestedQty)})',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          OutlinedButton(
                            onPressed: () {
                              setState(() {
                                ci.adjustReceived(-1);
                              });
                            },
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              minimumSize: const Size(40, 26),
                              side: const BorderSide(color: Color(0xFFFCA5A5)),
                            ),
                            child: const Text(
                              '-1',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFFDC2626),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          OutlinedButton(
                            onPressed: () {
                              setState(() {
                                ci.adjustReceived(-5);
                              });
                            },
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              minimumSize: const Size(40, 26),
                              side: const BorderSide(color: Color(0xFFFCA5A5)),
                            ),
                            child: const Text(
                              '-5',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFFDC2626),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          OutlinedButton(
                            onPressed: () {
                              setState(() {
                                ci.updateReceived(0);
                              });
                            },
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              minimumSize: const Size(45, 26),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                            ),
                            child: const Text(
                              '0 (Kosong)',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Dropdown Kondisi Barang
                    DropdownButtonFormField<String>(
                      value: ci.condition,
                      decoration: const InputDecoration(
                        labelText: 'Kondisi Fisik Barang',
                        border: OutlineInputBorder(),
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'good',
                          child: Text('✅ Baik & Sesuai'),
                        ),
                        DropdownMenuItem(
                          value: 'shortage',
                          child: Text('⚠️ Kurang (Shortage)'),
                        ),
                        DropdownMenuItem(
                          value: 'overage',
                          child: Text('➕ Lebih (Overage)'),
                        ),
                        DropdownMenuItem(
                          value: 'damaged',
                          child: Text('❌ Rusak / Cacat'),
                        ),
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

            // Lampiran & Bukti Foto Penerimaan
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.camera_alt_outlined,
                            size: 20,
                            color: Color(0xFF0284C7),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Bukti Foto / Nota (${_photos.length})',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                        ],
                      ),
                      ElevatedButton.icon(
                        onPressed: _showAddPhotoDialog,
                        icon: const Icon(Icons.add_a_photo, size: 16),
                        label: const Text(
                          '+ Foto',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Upload foto nota, surat jalan fisik tertandatangan, atau kondisi fisik barang tiba.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 10),

                  if (_photos.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: const Color(0xFFE2E8F0),
                          style: BorderStyle.solid,
                        ),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            Icons.photo_camera_back_outlined,
                            size: 36,
                            color: Colors.grey[400],
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Belum ada bukti foto ditambahkan',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Column(
                      children: _photos.asMap().entries.map((entry) {
                        final pIdx = entry.key;
                        final pUrl = entry.value;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Icon(
                                  Icons.image,
                                  size: 20,
                                  color: Color(0xFF0284C7),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  pUrl,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF1E293B),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.delete_outline,
                                  color: Colors.red,
                                  size: 20,
                                ),
                                onPressed: () {
                                  setState(() => _photos.removeAt(pIdx));
                                },
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
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
                        'One Marketlist Note (Catatan Penerima)',
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
                    'Catatan terpusat untuk Surat Jalan ini (tercatat di log audit penerimaan).',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 10),
                  _isLoadingNote
                      ? const Center(child: CircularProgressIndicator())
                      : TextField(
                          controller: _noteController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            hintText:
                                'Tuliskan catatan kondisi pengiriman atau alasan selisih kuantitas...',
                            border: OutlineInputBorder(),
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
