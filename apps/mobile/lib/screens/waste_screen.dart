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
  final _currency = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<dynamic> _products = [];
  List<dynamic> _latestPrices = [];
  List<dynamic> _records = [];
  String? _productId;
  DateTime _wastedAt = DateTime.now();

  Map<String, dynamic>? get _selectedProduct {
    for (final product in _products) {
      if (product is Map && product['_id']?.toString() == _productId) {
        return Map<String, dynamic>.from(product);
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
        ApiService.get('/waste'),
        ApiService.get('/prices/overview'),
      ]);
      final productsData = responses[0] is Map ? responses[0]['data'] : null;
      final recordsData = responses[1] is Map ? responses[1]['data'] : null;
      final pricesData = responses[2] is Map ? responses[2]['data'] : null;
      if (mounted) {
        setState(() {
          _products = productsData is List ? productsData : [];
          _records = recordsData is List ? recordsData : [];
          _latestPrices = pricesData is List ? pricesData : [];
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
        'quantity': double.parse(_quantityController.text),
        'reason': _reasonController.text.trim(),
        'wasted_at': _wastedAt.toIso8601String(),
      });
      _quantityController.clear();
      _reasonController.clear();
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
                              initialValue: _productId,
                              decoration: const InputDecoration(
                                labelText: 'Produk',
                                border: OutlineInputBorder(),
                              ),
                              items: _products.whereType<Map>().map((product) {
                                return DropdownMenuItem<String>(
                                  value: product['_id'].toString(),
                                  child: Text(
                                    product['name']?.toString() ?? '-',
                                  ),
                                );
                              }).toList(),
                              onChanged: (value) =>
                                  setState(() => _productId = value),
                              validator: (value) =>
                                  value == null ? 'Pilih produk' : null,
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
                              maxLines: 2,
                              decoration: const InputDecoration(
                                labelText: 'Alasan waste',
                                hintText: 'Rusak, kedaluwarsa, tumpah, dll.',
                                border: OutlineInputBorder(),
                              ),
                              validator: (value) =>
                                  value == null || value.trim().isEmpty
                                  ? 'Alasan wajib diisi'
                                  : null,
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
                      return Card(
                        child: ListTile(
                          title: Text(
                            record['product_name']?.toString() ?? 'Produk',
                          ),
                          subtitle: Text(
                            '${_formatDate(record['wasted_at'])} · $qty $unit × ${_currency.format(price)}\n${record['reason'] ?? ''}',
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
    );
  }
}
