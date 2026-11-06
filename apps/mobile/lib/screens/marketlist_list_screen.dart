import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'create_marketlist_screen.dart';
import 'digital_surat_jalan_screen.dart';

class MarketlistListScreen extends StatefulWidget {
  const MarketlistListScreen({super.key});

  @override
  State<MarketlistListScreen> createState() => _MarketlistListScreenState();
}

class _MarketlistListScreenState extends State<MarketlistListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<dynamic> _allMarketlists = [];
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() {
          if (_tabController.index == 0) _filter = 'all';
          if (_tabController.index == 1) _filter = 'pending';
          if (_tabController.index == 2) _filter = 'approved';
        });
      }
    });
    _fetchMarketlists();
  }

  Future<void> _fetchMarketlists() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.get('/marketlists?limit=50');
      if (mounted) {
        setState(() {
          _allMarketlists = res['data'] ?? [];
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal memuat: ${e.toString().replaceAll('Exception:', '')}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> get _filteredList {
    if (_filter == 'approved') {
      return _allMarketlists.where((m) => m['status'] == 'approved' || m['status'] == 'in_receiving' || m['status'] == 'completed').toList();
    } else if (_filter == 'pending') {
      return _allMarketlists.where((m) => m['status'] == 'draft' || m['status'] == 'submitted' || m['status'] == 'revision').toList();
    }
    return _allMarketlists;
  }

  Color _getStatusColor(String? status) {
    switch (status) {
      case 'approved':
      case 'completed':
        return const Color(0xFF16A34A);
      case 'submitted':
        return const Color(0xFF2563EB);
      case 'draft':
        return const Color(0xFF64748B);
      case 'revision':
      case 'rejected':
        return const Color(0xFFDC2626);
      default:
        return const Color(0xFFD97706);
    }
  }

  Color _getStatusBg(String? status) {
    switch (status) {
      case 'approved':
      case 'completed':
        return const Color(0xFFDCFCE7);
      case 'submitted':
        return const Color(0xFFDBEAFE);
      case 'draft':
        return const Color(0xFFF1F5F9);
      case 'revision':
      case 'rejected':
        return const Color(0xFFFEE2E2);
      default:
        return const Color(0xFFFEF3C7);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      locale: 'id_ID',
      symbol: 'Rp ',
      decimalDigits: 0,
    );

    final list = _filteredList;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        title: const Text(
          'Daftar Marketlist',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E293B),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
            onPressed: _fetchMarketlists,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFFD97706),
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: const Color(0xFFD97706),
          tabs: const [
            Tab(text: 'Semua'),
            Tab(text: 'Draft / Diajukan'),
            Tab(text: 'Disetujui'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final res = await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (ctx) => const CreateMarketlistScreen(),
            ),
          );
          if (res == true) {
            _fetchMarketlists();
          }
        },
        backgroundColor: const Color(0xFFD97706),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text(
          'Buat Marketlist',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchMarketlists,
              child: list.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.receipt_long_outlined,
                            size: 64,
                            color: Colors.grey[400],
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Belum ada Marketlist pada tab ini.',
                            style: TextStyle(color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.only(
                        left: 16,
                        right: 16,
                        top: 16,
                        bottom: 80,
                      ),
                      itemCount: list.length,
                      itemBuilder: (ctx, idx) {
                        final ml = list[idx];
                        final status = ml['status']?.toString() ?? 'draft';
                        final dateStr = ml['date'] != null
                            ? ml['date'].toString().split('T')[0]
                            : '-';
                        final reqDateStr = ml['required_date'] != null
                            ? ml['required_date'].toString().split('T')[0]
                            : '-';
                        final items = ml['items'] is List ? (ml['items'] as List) : [];
                        final total = ml['estimated_total'] != null
                            ? currencyFormat.format(ml['estimated_total'])
                            : 'Rp 0';
                        final isApproved = status == 'approved' ||
                            status == 'in_receiving' ||
                            status == 'completed';

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          elevation: 0,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: isApproved
                                ? () async {
                                    final res = await Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (ctx) =>
                                            DigitalSuratJalanScreen(marketlist: ml),
                                      ),
                                    );
                                    if (res == true) _fetchMarketlists();
                                  }
                                : () {
                                    _showDetailModal(context, ml, currencyFormat);
                                  },
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        ml['code'] ?? 'ML-UNTITLED',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color: _getStatusBg(status),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          status.toUpperCase(),
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: _getStatusColor(status),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Dibutuhkan: $reqDateStr • Tanggal Buat: $dateStr',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        '${items.length} Item Barang',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF334155),
                                        ),
                                      ),
                                      Text(
                                        total,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFFD97706),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (isApproved) ...[
                                    const Divider(height: 16),
                                    const Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Icon(
                                          Icons.local_shipping,
                                          size: 14,
                                          color: Color(0xFF0284C7),
                                        ),
                                        SizedBox(width: 4),
                                        Text(
                                          'Buka Surat Jalan & Penerimaan',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF0284C7),
                                          ),
                                        ),
                                        Icon(
                                          Icons.arrow_forward_ios,
                                          size: 12,
                                          color: Color(0xFF0284C7),
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }

  void _showDetailModal(BuildContext context, dynamic ml, NumberFormat fmt) {
    final items = ml['items'] is List ? (ml['items'] as List) : [];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (ctx2, scrollCtrl) => Padding(
          padding: const EdgeInsets.all(20),
          child: ListView(
            controller: scrollCtrl,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    ml['code'] ?? 'Detail Marketlist',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              Text(
                'Status: ${(ml['status'] ?? '').toString().toUpperCase()}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: _getStatusColor(ml['status']),
                ),
              ),
              const Divider(height: 24),
              const Text(
                'Daftar Barang yang Diajukan:',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              const SizedBox(height: 10),
              ...items.map((it) {
                final pName = it['product_name'] ??
                    (it['product_id'] is Map
                        ? it['product_id']['name']
                        : 'Barang');
                final qty = it['requested_qty'] ?? 0;
                final price = it['unit_price'] ?? 0;
                final sub = qty * price;
                return Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: const BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: Color(0xFFF1F5F9)),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              pName,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            Text(
                              '$qty x ${fmt.format(price)}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        fmt.format(sub),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }
}

