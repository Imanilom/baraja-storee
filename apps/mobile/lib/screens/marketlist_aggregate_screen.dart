import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class MarketlistAggregateScreen extends StatefulWidget {
  const MarketlistAggregateScreen({super.key});

  @override
  State<MarketlistAggregateScreen> createState() => _MarketlistAggregateScreenState();
}

class _MarketlistAggregateScreenState extends State<MarketlistAggregateScreen> {
  String _period = 'day'; // 'day' or 'week'
  String _itemTypeFilter = 'all'; // 'all', 'perishable', 'groceries'
  String _searchQuery = '';

  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _aggregateData;

  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadAggregate();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadAggregate() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.get('/marketlists/aggregate?period=$_period');
      final data = res['data'] ?? res;
      if (mounted) {
        setState(() {
          _aggregateData = data is Map<String, dynamic> ? data : null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'id_ID',
      symbol: 'Rp ',
      decimalDigits: 0,
    );

    final allItems = (_aggregateData != null && _aggregateData!['items'] is List)
        ? (_aggregateData!['items'] as List)
        : [];

    final filteredItems = allItems.where((item) {
      final itemType = (item['item_type'] ?? 'groceries').toString().toLowerCase();
      if (_itemTypeFilter != 'all' && itemType != _itemTypeFilter) {
        return false;
      }
      if (_searchQuery.isNotEmpty) {
        final name = (item['name'] ?? '').toString().toLowerCase();
        final cat = (item['category'] ?? '').toString().toLowerCase();
        if (!name.contains(_searchQuery) && !cat.contains(_searchQuery)) {
          return false;
        }
      }
      return true;
    }).toList();

    final totalMarketlists = _aggregateData?['total_marketlists'] ?? 0;
    final totalItemsCount = _aggregateData?['total_items'] ?? 0;
    final totalEstAmount = (_aggregateData?['total_estimated_amount'] as num?)?.toDouble() ?? 0.0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        title: const Text(
          'Rekap Kebutuhan Barang',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E293B),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
            onPressed: _loadAggregate,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Periode (1 Hari vs 1 Minggu)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        label: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.today, size: 16),
                            SizedBox(width: 6),
                            Text('Hari Ini (24 Jam)'),
                          ],
                        ),
                        selected: _period == 'day',
                        selectedColor: const Color(0xFFFEF3C7),
                        labelStyle: TextStyle(
                          color: _period == 'day' ? const Color(0xFFB45309) : const Color(0xFF475569),
                          fontWeight: _period == 'day' ? FontWeight.bold : FontWeight.normal,
                          fontSize: 13,
                        ),
                        side: BorderSide(
                          color: _period == 'day' ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
                        ),
                        onSelected: (selected) {
                          if (selected && _period != 'day') {
                            setState(() => _period = 'day');
                            _loadAggregate();
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ChoiceChip(
                        label: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.date_range, size: 16),
                            SizedBox(width: 6),
                            Text('Seminggu (7 Hari)'),
                          ],
                        ),
                        selected: _period == 'week',
                        selectedColor: const Color(0xFFE0F2FE),
                        labelStyle: TextStyle(
                          color: _period == 'week' ? const Color(0xFF0369A1) : const Color(0xFF475569),
                          fontWeight: _period == 'week' ? FontWeight.bold : FontWeight.normal,
                          fontSize: 13,
                        ),
                        side: BorderSide(
                          color: _period == 'week' ? const Color(0xFF0284C7) : const Color(0xFFE2E8F0),
                        ),
                        onSelected: (selected) {
                          if (selected && _period != 'week') {
                            setState(() => _period = 'week');
                            _loadAggregate();
                          }
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Sub-filter Kategori: Semua / Perishable / Groceries
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildChipFilter('Semua', 'all', const Color(0xFF475569)),
                      const SizedBox(width: 8),
                      _buildChipFilter('🥩 Perishable / Basah', 'perishable', const Color(0xFF16A34A)),
                      const SizedBox(width: 8),
                      _buildChipFilter('📦 Groceries / Kering', 'groceries', const Color(0xFFD97706)),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Search Box
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Cari nama barang atau kategori...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    isDense: true,
                  ),
                  onChanged: (val) {
                    setState(() => _searchQuery = val.trim().toLowerCase());
                  },
                ),
              ],
            ),
          ),

          // Summary Metrics Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: const Color(0xFFF1F5F9),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Variasi',
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                      Text(
                        '$totalItemsCount Barang',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Marketlist',
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                      Text(
                        '$totalMarketlists Permintaan',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Estimasi Biaya',
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                      Text(
                        currencyFormatter.format(totalEstAmount),
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: Color(0xFFD97706),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Item List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 48, color: Colors.red),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Color(0xFF64748B)),
                              ),
                              const SizedBox(height: 12),
                              ElevatedButton(
                                onPressed: _loadAggregate,
                                child: const Text('Coba Lagi'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : filteredItems.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.inventory_2_outlined, size: 56, color: Colors.grey[400]),
                                const SizedBox(height: 12),
                                Text(
                                  _period == 'day'
                                      ? 'Belum ada permintaan barang hari ini'
                                      : 'Belum ada permintaan barang dalam seminggu terakhir',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'Buat marketlist baru untuk memulai rekap',
                                  style: TextStyle(fontSize: 12, color: Colors.grey),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: filteredItems.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final item = filteredItems[index];
                              final isPerishable = (item['item_type'] ?? '') == 'perishable';
                              final reqQty = (item['total_requested_qty'] as num?)?.toDouble() ?? 0.0;
                              final mlCount = item['marketlist_count'] ?? 1;
                              final estAmount = (item['estimated_amount'] as num?)?.toDouble() ?? 0.0;

                              return Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.02),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            item['name'] ?? 'Barang',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                              color: Color(0xFF0F172A),
                                            ),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: isPerishable
                                                ? const Color(0xFFDCFCE7)
                                                : const Color(0xFFFEF3C7),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            isPerishable ? '🥩 PERISHABLE' : '📦 GROCERIES',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: isPerishable
                                                  ? const Color(0xFF15803D)
                                                  : const Color(0xFFB45309),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        Text(
                                          item['category'] ?? 'Tanpa Kategori',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: Color(0xFF64748B),
                                          ),
                                        ),
                                        const Spacer(),
                                        Text(
                                          'Muncul di $mlCount Marketlist',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Color(0xFF0284C7),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const Divider(height: 16),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Text(
                                              'Total Diminta',
                                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                            ),
                                            Text(
                                              '${reqQty % 1 == 0 ? reqQty.toInt() : reqQty.toStringAsFixed(1)} ${item['unit'] ?? ''}',
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF1E293B),
                                              ),
                                            ),
                                          ],
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            const Text(
                                              'Estimasi Subtotal',
                                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                            ),
                                            Text(
                                              currencyFormatter.format(estAmount),
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFFD97706),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildChipFilter(String label, String value, Color color) {
    final isSelected = _itemTypeFilter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: color.withOpacity(0.15),
      labelStyle: TextStyle(
        color: isSelected ? color : const Color(0xFF64748B),
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
      side: BorderSide(
        color: isSelected ? color : const Color(0xFFE2E8F0),
      ),
      onSelected: (selected) {
        if (selected) {
          setState(() => _itemTypeFilter = value);
        }
      },
    );
  }
}
