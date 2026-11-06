import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import 'create_marketlist_screen.dart';
import 'digital_surat_jalan_screen.dart';

class HomeScreen extends StatefulWidget {
  final UserModel user;
  final VoidCallback onNavigateToMarketlist;
  final VoidCallback onNavigateToHistory;

  const HomeScreen({
    super.key,
    required this.user,
    required this.onNavigateToMarketlist,
    required this.onNavigateToHistory,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  List<dynamic> _approvedMarketlists = [];
  int _totalMarketlists = 0;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  List<dynamic> _parseMarketlists(dynamic res) {
    if (res == null) return [];
    if (res['data'] is List) {
      return res['data'] as List<dynamic>;
    }
    if (res['data'] is Map && res['data']['items'] is List) {
      return res['data']['items'] as List<dynamic>;
    }
    if (res['items'] is List) {
      return res['items'] as List<dynamic>;
    }
    return [];
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.get('/marketlists?status=approved&limit=20');
      final allRes = await ApiService.get('/marketlists?limit=1&all=true');
      if (mounted) {
        setState(() {
          _approvedMarketlists = _parseMarketlists(res);
          int total = 0;
          if (allRes != null && allRes['data'] is Map && allRes['data']['pagination'] != null) {
            total = allRes['data']['pagination']['total'] ?? 0;
          } else if (allRes != null && allRes['total'] != null) {
            total = allRes['total'];
          } else {
            total = _approvedMarketlists.length;
          }
          _totalMarketlists = total;
        });
      }
    } catch (_) {
      // Fallback or offline
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      locale: 'id_ID',
      symbol: 'Rp ',
      decimalDigits: 0,
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFD97706),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.coffee, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.user.name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B),
                  ),
                ),
                Text(
                  widget.user.role.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFD97706),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
            onPressed: _loadDashboardData,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboardData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // CTA Banner: Buat Marketlist Baru
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFD97706), Color(0xFFB45309)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFD97706).withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.edit_note, color: Colors.white, size: 28),
                        SizedBox(width: 8),
                        Text(
                          'Buat Marketlist Baru',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Rencanakan kebutuhan belanja bahan baku outlet langsung dari HP Anda.',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton.icon(
                      onPressed: () async {
                        final created = await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (ctx) => const CreateMarketlistScreen(),
                          ),
                        );
                        if (created == true) {
                          _loadDashboardData();
                        }
                      },
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text(
                        '+ Tambah Marketlist',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFFD97706),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Operational Stats
              Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      'Surat Jalan Aktif',
                      '${_approvedMarketlists.length}',
                      'Siap Diterima',
                      Icons.local_shipping,
                      const Color(0xFF0284C7),
                      const Color(0xFFE0F2FE),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      'Total Marketlist',
                      '$_totalMarketlists',
                      'Semua Siklus',
                      Icons.format_list_bulleted,
                      const Color(0xFF16A34A),
                      const Color(0xFFDCFCE7),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Section: Surat Jalan Digital yang Harus Diperiksa
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Surat Jalan Digital (Approved)',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  TextButton(
                    onPressed: widget.onNavigateToMarketlist,
                    child: const Text('Lihat Semua'),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_approvedMarketlists.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Center(
                    child: Column(
                      children: [
                        Icon(Icons.check_circle_outline, size: 40, color: Colors.green),
                        SizedBox(height: 8),
                        Text(
                          'Tidak ada Surat Jalan yang menunggu penerimaan.',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _approvedMarketlists.length,
                  itemBuilder: (ctx, idx) {
                    final ml = _approvedMarketlists[idx];
                    final dateStr = ml['date'] != null
                        ? ml['date'].toString().split('T')[0]
                        : '-';
                    final itemsCount = ml['totals'] != null && ml['totals']['total_items'] != null
                        ? ml['totals']['total_items']
                        : (ml['items'] is List ? (ml['items'] as List).length : 0);
                    final totalVal = ml['totals'] != null && ml['totals']['estimated_amount'] != null
                        ? ml['totals']['estimated_amount']
                        : (ml['estimated_total'] ?? 0);
                    final totalEst = currencyFormat.format(totalVal);
                    final code = ml['marketlist_number'] ?? ml['code'] ?? 'ML-UNTITLED';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      elevation: 0,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () async {
                          final res = await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (ctx) => DigitalSuratJalanScreen(marketlist: ml),
                            ),
                          );
                          if (res == true) {
                            _loadDashboardData();
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.description,
                                        size: 18,
                                        color: Color(0xFF0284C7),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        code,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFDCFCE7),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text(
                                      'APPROVED',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF16A34A),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const Divider(height: 18),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Tanggal: $dateStr',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                  Text(
                                    '$itemsCount Barang',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF334155),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Total: $totalEst',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFFD97706),
                                    ),
                                  ),
                                  const Row(
                                    children: [
                                      Text(
                                        'Periksa Barang',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFF0284C7),
                                          fontWeight: FontWeight.bold,
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
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard(
    String title,
    String value,
    String subtitle,
    IconData icon,
    Color color,
    Color bgColor,
  ) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: color),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }
}

