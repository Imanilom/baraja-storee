import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class CreateMarketlistScreen extends StatefulWidget {
  const CreateMarketlistScreen({super.key});

  @override
  State<CreateMarketlistScreen> createState() => _CreateMarketlistScreenState();
}

class _MarketlistFormItem {
  String? productId;
  String? productName;
  String? unitName;
  String? categoryId;
  String? categoryName;
  double qty = 1;
  double price = 0;
  String notes = '';

  double get subtotal => qty * price;
}

class _CreateMarketlistScreenState extends State<CreateMarketlistScreen> {
  DateTime _date = DateTime.now();
  DateTime _requiredDate = DateTime.now().add(const Duration(days: 1));
  final _notesController = TextEditingController();

  List<dynamic> _products = [];
  List<Map<String, String>> _categories = [];
  bool _isLoadingMaster = true;
  bool _isSubmitting = false;

  final List<_MarketlistFormItem> _items = [_MarketlistFormItem()];

  @override
  void initState() {
    super.initState();
    _loadMasterData();
  }

  Future<void> _loadMasterData() async {
    setState(() => _isLoadingMaster = true);
    try {
      final pRes = await ApiService.get('/products?limit=100').catchError((_) => {'data': []});
      final cRes = await ApiService.get('/products/categories').catchError((_) => {'data': []});

      final products = (pRes['data'] is List) ? (pRes['data'] as List) : [];

      // Extract unique categories
      final catMap = <String, String>{};
      if (cRes['data'] is List) {
        for (var c in cRes['data']) {
          final id = c['_id']?.toString() ?? '';
          final name = c['name']?.toString() ?? '';
          if (id.isNotEmpty && name.isNotEmpty) {
            catMap[id] = name;
          }
        }
      }
      for (var p in products) {
        if (p['category_id'] is Map) {
          final id = p['category_id']['_id']?.toString() ?? '';
          final name = p['category_id']['name']?.toString() ?? '';
          if (id.isNotEmpty && name.isNotEmpty) {
            catMap[id] = name;
          }
        }
      }

      final categoryList = catMap.entries
          .map((e) => {'id': e.key, 'name': e.value})
          .toList()
        ..sort((a, b) => a['name']!.compareTo(b['name']!));

      if (mounted) {
        setState(() {
          _products = products;
          _categories = categoryList;
        });
      }
    } catch (_) {}
    finally {
      if (mounted) setState(() => _isLoadingMaster = false);
    }
  }

  double get _totalEstimate {
    return _items.fold(0, (sum, it) => sum + it.subtotal);
  }

  void _addItem() {
    setState(() {
      _items.add(_MarketlistFormItem());
    });
  }

  void _removeItem(int index) {
    if (_items.length <= 1) return;
    setState(() {
      _items.removeAt(index);
    });
  }

  void _applyProductToItem(_MarketlistFormItem item, dynamic p) {
    item.productId = p['_id']?.toString();
    item.productName = p['name'];
    item.unitName = p['unit_id'] is Map ? p['unit_id']['name'] : 'Satuan';
    if (p['category_id'] is Map) {
      item.categoryId = p['category_id']['_id']?.toString();
      item.categoryName = p['category_id']['name']?.toString();
    }

    // Price strictly follows last transaction purchase price
    if (p['last_purchase_price'] != null && (p['last_purchase_price'] as num) > 0) {
      item.price = (p['last_purchase_price'] as num).toDouble();
    } else {
      item.price = 0.0;
    }
  }

  void _openProductCategoryPicker({int? targetIndex}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        String selectedCategory = 'ALL';
        String searchQuery = '';

        return StatefulBuilder(
          builder: (context, setSheetState) {
            final filtered = _products.filterCategory(selectedCategory, searchQuery);

            return Container(
              height: MediaQuery.of(context).size.height * 0.85,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                children: [
                  // Handle bar
                  Center(
                    child: Container(
                      margin: const EdgeInsets.only(top: 10, bottom: 8),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),

                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.category_outlined, color: Color(0xFFD97706), size: 20),
                            const SizedBox(width: 8),
                            Text(
                              targetIndex != null
                                  ? 'Pilih Barang (#${targetIndex + 1})'
                                  : 'Katalog Barang per Kategori',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 20),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ),

                  // Search input
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: 'Cari nama barang...',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                      ),
                      onChanged: (val) {
                        setSheetState(() => searchQuery = val);
                      },
                    ),
                  ),

                  // Horizontal Category Chips
                  Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text('Semua (${_products.length})'),
                            selected: selectedCategory == 'ALL',
                            selectedColor: const Color(0xFFD97706),
                            labelStyle: TextStyle(
                              color: selectedCategory == 'ALL' ? Colors.white : const Color(0xFF475569),
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                            onSelected: (_) {
                              setSheetState(() => selectedCategory = 'ALL');
                            },
                          ),
                        ),
                        ..._categories.map((cat) {
                          final count = _products.where((p) {
                            if (p['category_id'] is Map) {
                              return p['category_id']['_id'] == cat['id'] ||
                                  p['category_id']['name'] == cat['name'];
                            }
                            return false;
                          }).length;

                          final isSelected = selectedCategory == cat['id'];
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text('${cat['name']} ($count)'),
                              selected: isSelected,
                              selectedColor: const Color(0xFFD97706),
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : const Color(0xFF475569),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                              onSelected: (_) {
                                setSheetState(() => selectedCategory = cat['id']!);
                              },
                            ),
                          );
                        }),
                      ],
                    ),
                  ),

                  const Divider(height: 1),

                  // Product list
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text(
                              'Tidak ada barang ditemukan di kategori ini.',
                              style: TextStyle(color: Colors.grey, fontSize: 13),
                            ),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (context, i) {
                              final p = filtered[i];
                              final pName = p['name'] ?? 'Barang';
                              final catName = p['category_id'] is Map
                                  ? p['category_id']['name']
                                  : 'Tanpa Kategori';
                              final uName = p['unit_id'] is Map
                                  ? p['unit_id']['name']
                                  : 'Satuan';
                              final price = (p['last_purchase_price'] != null)
                                  ? (p['last_purchase_price'] as num).toDouble()
                                  : 0.0;

                              return ListTile(
                                dense: true,
                                leading: CircleAvatar(
                                  backgroundColor: const Color(0xFFFEF3C7),
                                  child: const Icon(
                                    Icons.inventory_2_outlined,
                                    color: Color(0xFFD97706),
                                    size: 18,
                                  ),
                                ),
                                title: Text(
                                  pName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 2),
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            catName,
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: Color(0xFF475569),
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Satuan: $uName',
                                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                                        ),
                                      ],
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.lock_outline, size: 11, color: Color(0xFFB45309)),
                                          const SizedBox(width: 3),
                                          Text(
                                            price > 0
                                                ? 'Harga Terakhir: Rp ${NumberFormat.currency(locale: 'id_ID', symbol: '', decimalDigits: 0).format(price)}'
                                                : 'Harga Terakhir: Rp 0 (Belum ada transaksi)',
                                            style: const TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFFB45309),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                trailing: ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFD97706),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      if (targetIndex != null) {
                                        _applyProductToItem(_items[targetIndex], p);
                                      } else {
                                        if (_items.length == 1 && _items[0].productId == null) {
                                          _applyProductToItem(_items[0], p);
                                        } else {
                                          final newItem = _MarketlistFormItem();
                                          _applyProductToItem(newItem, p);
                                          _items.add(newItem);
                                        }
                                      }
                                    });
                                    Navigator.pop(context);
                                    ScaffoldMessenger.of(this.context).showSnackBar(
                                      SnackBar(
                                        duration: const Duration(seconds: 1),
                                        content: Text('✅ $pName ditambahkan'),
                                      ),
                                    );
                                  },
                                  child: const Text('Pilih', style: TextStyle(fontSize: 11)),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _handleSubmit(bool submitDirectlyToAdmin) async {
    for (int i = 0; i < _items.length; i++) {
      if (_items[i].productId == null || _items[i].qty <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Pilih nama barang dan kuantitas > 0 pada baris ke-${i + 1}')),
        );
        return;
      }
    }

    setState(() => _isSubmitting = true);
    try {
      final payload = {
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'required_date': DateFormat('yyyy-MM-dd').format(_requiredDate),
        'location_id': '663673f8e538ef94b0000001',
        'items': _items.map((it) => {
          'product_id': it.productId,
          'requested_qty': it.qty,
          'unit_price': it.price,
          'notes': it.notes,
        }).toList(),
        'notes': _notesController.text.trim(),
      };

      final res = await ApiService.post('/marketlists', payload);
      final mlId = res['data']['_id'];

      if (submitDirectlyToAdmin && mlId != null) {
        await ApiService.post('/marketlists/$mlId/submit', {});
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF16A34A),
            content: Text(
              submitDirectlyToAdmin
                  ? '✅ Marketlist berhasil dibuat dan diajukan ke Admin!'
                  : '✅ Marketlist disimpan sebagai Draft.',
            ),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red,
            content: Text('Gagal membuat Marketlist: ${e.toString().replaceAll('Exception:', '')}'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
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
        title: const Text(
          'Buat Marketlist Baru',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E293B),
          ),
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total Estimasi Belanja:',
                    style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                  ),
                  Text(
                    currencyFormat.format(_totalEstimate),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFD97706),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isSubmitting ? null : () => _handleSubmit(false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        side: const BorderSide(color: Color(0xFF94A3B8)),
                      ),
                      child: const Text('Simpan Draft'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : () => _handleSubmit(true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Submit ke Admin',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      body: _isLoadingMaster
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Form header: Tanggal & Dibutuhkan
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Informasi Pengajuan',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _buildDatePicker(
                                'Tanggal Dibuat',
                                _date,
                                (picked) => setState(() => _date = picked),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildDatePicker(
                                'Tanggal Dibutuhkan',
                                _requiredDate,
                                (picked) => setState(() => _requiredDate = picked),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _notesController,
                          decoration: const InputDecoration(
                            labelText: 'Catatan Pengajuan (Opsional)',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Info Supplier & Harga Terkunci Notice
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Icon(Icons.info_outline, color: Color(0xFF2563EB), size: 18),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Supplier akan ditentukan oleh Tim Purchasing saat transaksi belanja. Harga satuan otomatis terkunci mengikuti transaksi terakhir.',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFF1E40AF),
                              height: 1.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Quick Category Catalog Banner
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFEF3C7), Color(0xFFFDE68A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFCD34D)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD97706),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.category, color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text(
                                'Pilih Barang per Kategori',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: Color(0xFF78350F),
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Kelompokkan barang per kategori agar cepat ditemukan.',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF92400E),
                                ),
                              ),
                            ],
                          ),
                        ),
                        ElevatedButton.icon(
                          onPressed: () => _openProductCategoryPicker(),
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Katalog'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFD97706),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Section Title & Add Item Button
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Daftar Barang Belanja (${_items.length})',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: _addItem,
                        icon: const Icon(Icons.add_circle_outline, size: 18),
                        label: const Text('+ Baris Baru'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Item Cards
                  ..._items.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final it = entry.value;

                    // Filter products for this item if categoryId is set
                    final availableProds = (it.categoryId == null || it.categoryId!.isEmpty)
                        ? _products
                        : _products.where((p) {
                            if (p['category_id'] is Map) {
                              return p['category_id']['_id'] == it.categoryId;
                            }
                            return false;
                          }).toList();

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
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
                                  Text(
                                    'Barang #${idx + 1}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF475569),
                                    ),
                                  ),
                                  if (it.categoryName != null) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF3C7),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        it.categoryName!,
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFFB45309),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              Row(
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.search, color: Color(0xFFD97706), size: 20),
                                    tooltip: 'Cari dari Katalog Kategori',
                                    onPressed: () => _openProductCategoryPicker(targetIndex: idx),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(),
                                  ),
                                  if (_items.length > 1) ...[
                                    const SizedBox(width: 8),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                      onPressed: () => _removeItem(idx),
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),

                          // Dropdown Filter Kategori Baris Ini
                          DropdownButtonFormField<String>(
                            value: it.categoryId,
                            isExpanded: true,
                            hint: const Text('Semua Kategori (Filter)'),
                            decoration: const InputDecoration(
                              labelText: 'Filter Kategori',
                              border: OutlineInputBorder(),
                              isDense: true,
                              prefixIcon: Icon(Icons.filter_list, size: 18),
                            ),
                            items: [
                              const DropdownMenuItem<String>(
                                value: null,
                                child: Text('Semua Kategori'),
                              ),
                              ..._categories.map((c) {
                                return DropdownMenuItem<String>(
                                  value: c['id'],
                                  child: Text(c['name']!),
                                );
                              }),
                            ],
                            onChanged: (val) {
                              setState(() {
                                it.categoryId = val;
                                if (val != null) {
                                  final matchCat = _categories.firstWhere(
                                    (c) => c['id'] == val,
                                    orElse: () => {'name': ''},
                                  );
                                  it.categoryName = matchCat['name'];
                                } else {
                                  it.categoryName = null;
                                }
                                // Reset selected product if not in this category
                                if (it.productId != null) {
                                  final exists = availableProds.any((p) => p['_id'] == it.productId);
                                  if (!exists) {
                                    it.productId = null;
                                    it.price = 0;
                                  }
                                }
                              });
                            },
                          ),
                          const SizedBox(height: 10),

                          // Dropdown Produk
                          DropdownButtonFormField<String>(
                            value: it.productId,
                            isExpanded: true,
                            hint: const Text('Pilih Nama Barang'),
                            decoration: const InputDecoration(
                              labelText: 'Nama Produk',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            items: availableProds.map((p) {
                              final pId = p['_id']?.toString() ?? '';
                              final pName = p['name'] ?? 'Item';
                              final uName = p['unit_id'] is Map ? p['unit_id']['name'] : 'Satuan';
                              final cName = p['category_id'] is Map ? p['category_id']['name'] : '';
                              final label = cName.isNotEmpty ? '[$cName] $pName ($uName)' : '$pName ($uName)';
                              return DropdownMenuItem<String>(
                                value: pId,
                                child: Text(
                                  label,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }).toList(),
                            onChanged: (val) {
                              setState(() {
                                final p = _products.firstWhere((prod) => prod['_id'] == val, orElse: () => null);
                                if (p != null) {
                                  _applyProductToItem(it, p);
                                }
                              });
                            },
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              // Kuantitas
                              Expanded(
                                flex: 2,
                                child: TextFormField(
                                  key: ValueKey('qty_${idx}_${it.productId}'),
                                  initialValue: it.qty.toString(),
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Kuantitas',
                                    border: OutlineInputBorder(),
                                    isDense: true,
                                  ),
                                  onChanged: (val) {
                                    setState(() {
                                      it.qty = double.tryParse(val) ?? 0;
                                    });
                                  },
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Harga Satuan Terakhir (Read-Only / Terkunci)
                              Expanded(
                                flex: 3,
                                child: InputDecorator(
                                  decoration: const InputDecoration(
                                    labelText: 'Harga Satuan Terakhir',
                                    helperText: 'Terkunci dari transaksi',
                                    border: OutlineInputBorder(),
                                    isDense: true,
                                    filled: true,
                                    fillColor: Color(0xFFF1F5F9),
                                    suffixIcon: Icon(Icons.lock, size: 16, color: Colors.grey),
                                  ),
                                  child: Text(
                                    it.price > 0 ? currencyFormat.format(it.price) : 'Rp 0',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF334155),
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Text(
                                'Subtotal: ${currencyFormat.format(it.subtotal)}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }

  Widget _buildDatePicker(String label, DateTime selectedDate, Function(DateTime) onSelect) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: selectedDate,
          firstDate: DateTime(2025),
          lastDate: DateTime(2030),
        );
        if (picked != null) onSelect(picked);
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              DateFormat('dd/MM/yyyy').format(selectedDate),
              style: const TextStyle(fontSize: 13),
            ),
            const Icon(Icons.calendar_today, size: 16, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}

extension ProductListFilter on List<dynamic> {
  List<dynamic> filterCategory(String categoryId, String query) {
    return where((p) {
      bool catMatch = true;
      if (categoryId != 'ALL') {
        if (p['category_id'] is Map) {
          catMatch = p['category_id']['_id'] == categoryId ||
              p['category_id']['name'] == categoryId;
        } else {
          catMatch = false;
        }
      }

      bool queryMatch = true;
      if (query.trim().isNotEmpty) {
        final name = (p['name'] ?? '').toString().toLowerCase();
        final sku = (p['sku'] ?? '').toString().toLowerCase();
        final q = query.toLowerCase().trim();
        queryMatch = name.contains(q) || sku.contains(q);
      }

      return catMatch && queryMatch;
    }).toList();
  }
}
