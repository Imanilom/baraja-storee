import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class WasteScreen extends StatefulWidget {
  const WasteScreen({super.key});

  @override
  State<WasteScreen> createState() => _WasteScreenState();
}

class _WasteScreenState extends State<WasteScreen> {
  final _formKey = GlobalKey<FormState>();
  final _quantityController = TextEditingController();
  final _reasonController = TextEditingController();
  final _notesController = TextEditingController();
  final _currency = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<dynamic> _products = [];
  List<dynamic> _marketlists = [];
  List<dynamic> _latestPrices = [];
  List<dynamic> _records = [];
  String? _productId;
  String? _marketlistId;
  String _stage = 'received';
  DateTime _wastedAt = DateTime.now();

  static const _stages = <String, String>{
    'received': 'Saat diterima',
    'processing': 'Saat diolah',
    'finished_product': 'Produk jadi',
    'spoiled': 'Busuk / rusak',
    'other': 'Lainnya',
  };

  Map<String, dynamic>? get _selectedMarketlist {
    for (final marketlist in _marketlists) {
      if (marketlist is Map &&
          marketlist['_id']?.toString() == _marketlistId) {
        return Map<String, dynamic>.from(marketlist);
      }
    }
    return null;
  }

  List<Map<String, dynamic>> get _availableProducts {
    final marketlist = _selectedMarketlist;
    if (marketlist == null) {
      return _products
          .whereType<Map>()
          .map((product) => Map<String, dynamic>.from(product))
          .toList();
    }

    final items = marketlist['items'];
    if (items is! List) return [];
    return items
        .whereType<Map>()
        .where((item) => item['item_status'] != 'rejected')
        .where((item) => item['product_id'] is Map)
        .map(
          (item) => Map<String, dynamic>.from(item['product_id'] as Map),
        )
        .toList();
  }

  Map<String, dynamic>? get _selectedProduct {
    for (final product in _availableProducts) {
      if (product is Map && product['_id']?.toString() == _productId) {
        return product;
      }
    }
    return null;
  }

  double get _unitPrice => _latestPurchasePrice().toDouble();

  num _latestPurchasePrice() {
    for (final entry in _latestPrices) {
      if (entry is Map &&
          entry['product'] is Map &&
          entry['product']['_id']?.toString() == _productId &&
          entry['source'] == 'purchase') {
        return num.tryParse('${entry['latest_price']}') ?? 0;
      }
    }
    return num.tryParse('${_selectedProduct?['last_purchase_price'] ?? 0}') ??
        0;
  }

  double get _wasteValue =>
      (double.tryParse(_quantityController.text) ?? 0) * _unitPrice;

  @override
  void initState() {
    super.initState();
    _load();
    _quantityController.addListener(_refreshValue);
  }

  @override
  void dispose() {
    _quantityController.removeListener(_refreshValue);
    _quantityController.dispose();
    _reasonController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _refreshValue() {
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final responses = await Future.wait([
        ApiService.get('/products?include_inactive=true'),
        ApiService.get('/marketlists?limit=100'),
        ApiService.get('/waste'),
        ApiService.get('/prices/overview'),
      ]);
      final productsData = responses[0] is Map ? responses[0]['data'] : null;
      final marketlistsData = responses[1] is Map
          ? (responses[1]['data'] is Map
                ? responses[1]['data']['items']
                : responses[1]['items'])
          : null;
      final recordsData = responses[2] is Map ? responses[2]['data'] : null;
      final pricesData = responses[3] is Map ? responses[3]['data'] : null;
      if (mounted) {
        setState(() {
          _products = productsData is List ? productsData : [];
          _marketlists = marketlistsData is List ? marketlistsData : [];
          _records = recordsData is List ? recordsData : [];
          _latestPrices = pricesData is List ? pricesData : [];
          if (_marketlistId != null &&
              !_marketlists.any(
                (marketlist) =>
                    marketlist is Map &&
                    marketlist['_id']?.toString() == _marketlistId,
              )) {
            _marketlistId = null;
            _productId = null;
          }
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception:', '').trim(),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_unitPrice <= 0) {
      setState(
        () => _error = 'Produk belum memiliki harga pembelian terakhir.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ApiService.post('/waste', {
        'product_id': _productId,
        if (_marketlistId != null) 'marketlist_id': _marketlistId,
        'quantity': double.parse(_quantityController.text),
        'stage': _stage,
        'reason': _reasonController.text.trim(),
        'notes': _notesController.text.trim(),
        'wasted_at': _wastedAt.toIso8601String(),
      });
      _quantityController.clear();
      _reasonController.clear();
      _notesController.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Waste dicatat dengan harga beli terakhir.'),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception:', '').trim(),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _formatDate(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '');
    return date == null ? '-' : DateFormat('dd MMM yyyy').format(date);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text('Waste'),
        backgroundColor: Colors.white,
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                  if (_error != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Catat waste produk',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String>(
                              initialValue: _marketlistId,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Marketlist / PO (opsional)',
                                border: OutlineInputBorder(),
                              ),
                              hint: const Text('Semua produk'),
                              items: _marketlists.whereType<Map>().map((
                                marketlist,
                              ) {
                                final date = _formatDate(marketlist['date']);
                                return DropdownMenuItem<String>(
                                  value: marketlist['_id'].toString(),
                                  child: Text(
                                    '${marketlist['marketlist_number'] ?? 'Marketlist'} · $date',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                );
                              }).toList(),
                              onChanged: (value) => setState(() {
                                _marketlistId = value;
                                _productId = null;
                              }),
                            ),
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String>(
                              key: ValueKey(_marketlistId),
                              initialValue: _productId,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Produk',
                                border: OutlineInputBorder(),
                              ),
                              items: _availableProducts.map((product) {
                                return DropdownMenuItem<String>(
                                  value: product['_id'].toString(),
                                  child: Text(
                                    product['name']?.toString() ?? '-',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                );
                              }).toList(),
                              hint: Text(
                                _selectedMarketlist == null
                                    ? 'Pilih produk'
                                    : 'Tidak ada produk pada Marketlist',
                              ),
                              onChanged: (value) =>
                                  setState(() => _productId = value),
                              validator: (value) =>
                                  value == null ? 'Pilih produk' : null,
                            ),
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String>(
                              initialValue: _stage,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Tahap pencatatan',
                                border: OutlineInputBorder(),
                              ),
                              items: _stages.entries
                                  .map(
                                    (stage) => DropdownMenuItem<String>(
                                      value: stage.key,
                                      child: Text(stage.value),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) => setState(
                                () => _stage = value ?? 'received',
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _quantityController,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              decoration: const InputDecoration(
                                labelText: 'Jumlah waste',
                                border: OutlineInputBorder(),
                              ),
                              validator: (value) {
                                final quantity = double.tryParse(value ?? '');
                                return quantity == null || quantity <= 0
                                    ? 'Jumlah harus lebih besar dari 0'
                                    : null;
                              },
                            ),
                            const SizedBox(height: 12),
                            OutlinedButton.icon(
                              onPressed: () async {
                                final date = await showDatePicker(
                                  context: context,
                                  initialDate: _wastedAt,
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime.now(),
                                );
                                if (date != null) {
                                  setState(() => _wastedAt = date);
                                }
                              },
                              icon: const Icon(Icons.calendar_today),
                              label: Text(
                                DateFormat('dd MMM yyyy').format(_wastedAt),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFFBEB),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                'Harga beli: ${_currency.format(_unitPrice)} per unit\nNilai waste: ${_currency.format(_wasteValue)}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _reasonController,
                              maxLength: 500,
                              maxLines: 1,
                              decoration: const InputDecoration(
                                labelText: 'Jenis waste',
                                hintText: 'Susut, tumpah, salah olah, dll.',
                                border: OutlineInputBorder(),
                              ),
                              validator: (value) =>
                                  value == null || value.trim().isEmpty
                                  ? 'Jenis waste wajib diisi'
                                  : null,
                            ),
                            const SizedBox(height: 8),
                            TextFormField(
                              controller: _notesController,
                              maxLength: 1000,
                              maxLines: 2,
                              decoration: const InputDecoration(
                                labelText: 'Catatan (opsional)',
                                hintText: 'Jelaskan kondisi atau tindak lanjut',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 8),
                            FilledButton.icon(
                              onPressed: _saving ? null : _save,
                              icon: const Icon(Icons.add),
                              label: Text(
                                _saving ? 'Menyimpan...' : 'Simpan Waste',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Riwayat Waste',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  if (_records.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('Belum ada waste yang dicatat.'),
                      ),
                    )
                  else
                    ..._records.whereType<Map>().map((record) {
                      final qty = num.tryParse('${record['quantity']}') ?? 0;
                      final unit = record['unit_name']?.toString() ?? '';
                      final price =
                          num.tryParse('${record['unit_purchase_price']}') ?? 0;
                      final total =
                          num.tryParse('${record['total_cost']}') ?? 0;
                      final marketlist = record['marketlist_id'];
                      final marketlistText = marketlist is Map
                          ? '${marketlist['marketlist_number'] ?? 'Marketlist'} · ${_formatDate(marketlist['date'])}'
                          : null;
                      return Card(
                        child: ListTile(
                          title: Text(
                            record['product_name']?.toString() ?? 'Produk',
                          ),
                          subtitle: Text(
                            [
                              '${_stages[record['stage']] ?? _stages['other']} · ${_formatDate(record['wasted_at'])}',
                              if (marketlistText != null) marketlistText,
                              '$qty $unit × ${_currency.format(price)}',
                              record['reason']?.toString() ?? '',
                              if ((record['notes']?.toString() ?? '').isNotEmpty)
                                record['notes'].toString(),
                            ].join('\n'),
                          ),
                          isThreeLine: true,
                          trailing: Text(
                            _currency.format(total),
                            style: const TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      );
                    }),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}
