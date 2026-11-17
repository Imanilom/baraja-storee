import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import 'create_marketlist_screen.dart';
import 'digital_surat_jalan_screen.dart';
import 'marketlist_aggregate_screen.dart';
import 'price_history_screen.dart';
import 'waste_screen.dart';
import '../theme/app_theme.dart';

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
      final res = await ApiService.get(
        '/marketlists?status=approved,partial_rejection,in_progress,partially_received&limit=20',
      );
      final allRes = await ApiService.get('/marketlists?limit=1&all=true');
      if (mounted) {
        setState(() {
          _approvedMarketlists = _parseMarketlists(res);
          int total = 0;
          if (allRes != null &&
              allRes['data'] is Map &&
              allRes['data']['pagination'] != null) {
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
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: BarajaPalette.forest,
                borderRadius: BorderRadius.circular(13),
              ),
              child: const Icon(
                Icons.shopping_bag_outlined,
                color: Colors.white,
                size: 19,
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Baraja Store',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: BarajaPalette.ink,
                    ),
                  ),
                  Text(
                    'Hai, ${widget.user.name}',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: BarajaPalette.muted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: IconButton.filledTonal(
              tooltip: 'Muat ulang dashboard',
              icon: const Icon(Icons.refresh_rounded),
              onPressed: _loadDashboardData,
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboardData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 960),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildMarketlistHero(context),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: _buildHomeMenuCard(
                          context,
                          title: 'Harga Terbaru',
                          subtitle: 'Tren harga produk',
                          icon: Icons.trending_up,
                          color: const Color(0xFF476D84),
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const PriceHistoryScreen(),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildHomeMenuCard(
                          context,
                          title: 'Waste',
                          subtitle: 'Catat waste & nilainya',
                          icon: Icons.delete_outline,
                          color: const Color(0xFFB65A4D),
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const WasteScreen(),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Operational Stats
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatCard(
                          'Surat Jalan Aktif',
                          '${_approvedMarketlists.length}',
                          'Siap Diterima',
                          Icons.local_shipping,
                          const Color(0xFF53798E),
                          const Color(0xFFEAF1F4),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildStatCard(
                          'Total Marketlist',
                          '$_totalMarketlists',
                          'Semua Siklus',
                          Icons.format_list_bulleted,
                          BarajaPalette.forest,
                          BarajaPalette.mint,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Rekap Agregat Barang Banner
                  InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (ctx) => const MarketlistAggregateScreen(),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: BarajaPalette.outline),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: BarajaPalette.mint,
                              borderRadius: BorderRadius.circular(13),
                            ),
                            child: const Icon(
                              Icons.analytics_outlined,
                              color: BarajaPalette.forest,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Rekap Agregat Kebutuhan Barang',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: BarajaPalette.ink,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Lihat total belanja per hari & per minggu (Perishable & Groceries)',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: BarajaPalette.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right,
                            color: Color(0xFF94A3B8),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

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
                            Icon(
                              Icons.check_circle_outline,
                              size: 40,
                              color: Colors.green,
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Tidak ada Surat Jalan yang menunggu penerimaan.',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 13,
                              ),
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
                        final itemsCount =
                            ml['totals'] != null &&
                                ml['totals']['total_items'] != null
                            ? ml['totals']['total_items']
                            : (ml['items'] is List
                                  ? (ml['items'] as List).length
                                  : 0);
                        final totalVal =
                            ml['totals'] != null &&
                                ml['totals']['estimated_amount'] != null
                            ? ml['totals']['estimated_amount']
                            : (ml['estimated_total'] ?? 0);
                        final totalEst = currencyFormat.format(totalVal);
                        final code =
                            ml['marketlist_number'] ??
                            ml['code'] ??
                            'ML-UNTITLED';

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
                                  builder: (ctx) =>
                                      DigitalSuratJalanScreen(marketlist: ml),
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
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
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
                                          borderRadius: BorderRadius.circular(
                                            6,
                                          ),
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
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
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
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Total: $totalEst',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF059669),
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
        ),
      ),
    );
  }

  Widget _buildMarketlistHero(BuildContext context) {
    return Container(
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [BarajaPalette.forest, BarajaPalette.forestDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: BarajaPalette.forest.withValues(alpha: 0.18),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -44,
            top: -64,
            child: Container(
              width: 190,
              height: 190,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.06),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            right: 12,
            bottom: -96,
            child: Container(
              width: 170,
              height: 170,
              decoration: BoxDecoration(
                color: BarajaPalette.honey.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'PENGADAAN · OPERASIONAL',
                    style: TextStyle(
                      color: Color(0xFFE2EFE7),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                    ),
                  ),
                ),
                const SizedBox(height: 17),
                const Text(
                  'Belanja lebih\nterencana.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 25,
                    height: 1.12,
                    letterSpacing: -0.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Buat kebutuhan outlet dan pantau proses penerimaan dalam satu tempat.',
                  style: TextStyle(
                    color: Color(0xFFD4E3D9),
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: () async {
                    final created = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const CreateMarketlistScreen(),
                      ),
                    );
                    if (created == true) _loadDashboardData();
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: BarajaPalette.forest,
                    minimumSize: const Size(0, 46),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13),
                    ),
                  ),
                  icon: const Icon(Icons.add_rounded, size: 19),
                  label: const Text('Buat marketlist'),
                ),
              ],
            ),
          ),
        ],
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
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: BarajaPalette.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  color: BarajaPalette.muted,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: color),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: BarajaPalette.ink,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 11, color: BarajaPalette.muted),
          ),
        ],
      ),
    );
  }

  Widget _buildHomeMenuCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: BarajaPalette.outline),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: color, size: 21),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                      color: BarajaPalette.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: BarajaPalette.muted,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
