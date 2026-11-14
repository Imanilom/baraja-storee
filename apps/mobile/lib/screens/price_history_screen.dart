import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class PriceHistoryScreen extends StatefulWidget {
  const PriceHistoryScreen({super.key});

  @override
  State<PriceHistoryScreen> createState() => _PriceHistoryScreenState();
}

class _PriceHistoryScreenState extends State<PriceHistoryScreen> {
  bool _loading = true;
  bool _historyLoading = false;
  String? _error;
  List<dynamic> _prices = [];
  List<dynamic> _history = [];
  Map<String, dynamic>? _selected;

  final _currency = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _loadPrices();
  }

  Future<void> _loadPrices() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ApiService.get('/prices/overview');
      final data = response is Map ? response['data'] : null;
      if (mounted) {
        setState(() => _prices = data is List ? data : []);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString().replaceFirst('Exception:', '').trim());
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadHistory(Map<String, dynamic> price) async {
    final product = price['product'];
    final productId = product is Map ? product['_id']?.toString() : null;
    if (productId == null || productId.isEmpty) return;
    setState(() {
      _selected = price;
      _historyLoading = true;
      _error = null;
    });
    try {
      final response = await ApiService.get('/prices/products/$productId');
      final data = response is Map ? response['data'] : null;
      if (mounted) setState(() => _history = data is List ? data : []);
    } catch (error) {
      if (mounted) {
        setState(() {
          _history = [];
          _error = error.toString().replaceFirst('Exception:', '').trim();
        });
      }
    } finally {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  String _date(dynamic value) {
    final parsed = DateTime.tryParse(value?.toString() ?? '');
    return parsed == null ? '-' : DateFormat('dd MMM yyyy').format(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final selectedProduct = _selected?['product'];
    final selectedName = selectedProduct is Map
        ? (selectedProduct['name'] ?? 'Tren harga produk').toString()
        : 'Tren harga produk';
    final newestPrice = _history.isNotEmpty
        ? (_history.first is Map ? num.tryParse('${_history.first['price']}') : null)
        : null;
    final priorPrice = _history.length > 1
        ? (_history[1] is Map ? num.tryParse('${_history[1]['price']}') : null)
        : null;
    final difference = newestPrice != null && priorPrice != null
        ? newestPrice - priorPrice
        : null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text('Harga Terbaru & Tren'),
        backgroundColor: Colors.white,
        actions: [IconButton(onPressed: _loadPrices, icon: const Icon(Icons.refresh))],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _prices.isEmpty
              ? Center(child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(_error!, textAlign: TextAlign.center),
                ))
              : RefreshIndicator(
                  onRefresh: _loadPrices,
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 960),
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(_error!, style: const TextStyle(color: Colors.red)),
                        ),
                      const Text(
                        'Harga beli terakhir',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const SizedBox(height: 8),
                      if (_prices.isEmpty)
                        const Card(child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('Belum ada riwayat harga produk.'),
                        ))
                      else
                        ..._prices.map((dynamic entry) {
                          if (entry is! Map) return const SizedBox.shrink();
                          final product = entry['product'];
                          final unit = entry['product_unit'] is Map
                              ? (entry['product_unit']['abbreviation'] ??
                                  entry['product_unit']['name'] ??
                                  'unit')
                              : 'unit';
                          final supplier = entry['supplier'];
                          return Card(
                            child: ListTile(
                              onTap: () => _loadHistory(Map<String, dynamic>.from(entry)),
                              title: Text(
                                product is Map ? (product['name'] ?? '-').toString() : '-',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                '${_date(entry['recorded_at'])} · ${supplier is Map ? supplier['name'] ?? 'Supplier' : 'Pembelian'}',
                              ),
                              trailing: Text(
                                '${_currency.format(num.tryParse('${entry['latest_price']}') ?? 0)} / $unit',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF047857),
                                ),
                              ),
                            ),
                          );
                        }),
                      if (_selected != null) ...[
                        const SizedBox(height: 20),
                        Text(selectedName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 8),
                        if (_historyLoading)
                          const Center(child: Padding(
                            padding: EdgeInsets.all(16),
                            child: CircularProgressIndicator(),
                          ))
                        else if (_history.isEmpty)
                          const Card(child: Padding(
                            padding: EdgeInsets.all(16),
                            child: Text('Belum ada tren harga.'),
                          ))
                        else ...[
                          Card(
                            child: ListTile(
                              title: const Text('Perubahan dari harga sebelumnya'),
                              trailing: difference == null
                                  ? const Text('Data tunggal')
                                  : Text(
                                      '${difference > 0 ? '+' : ''}${_currency.format(difference)}',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: difference > 0
                                            ? Colors.red
                                            : difference < 0
                                                ? Colors.green
                                                : Colors.grey,
                                      ),
                                    ),
                            ),
                          ),
                          ..._history.map((dynamic entry) {
                            if (entry is! Map) return const SizedBox.shrink();
                            final value = num.tryParse('${entry['price']}') ?? 0;
                            return Card(
                              child: ListTile(
                                dense: true,
                                title: Text(_currency.format(value)),
                                subtitle: Text(
                                  '${_date(entry['recorded_at'])} · ${entry['supplier_id'] is Map ? entry['supplier_id']['name'] ?? 'Pembelian' : entry['source'] ?? '-'}',
                                ),
                              ),
                            );
                          }),
                        ],
                      ],
                        ],
                      ),
                    ),
                  ),
                ),
    );
  }
}
