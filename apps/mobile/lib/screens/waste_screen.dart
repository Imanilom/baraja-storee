import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../widgets/responsive_content.dart';

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
  final _productSearchController = TextEditingController();
  final _currency = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  bool _loading = true;
  bool _saving = false;
  String? _syncingWasteId;
  String? _error;
  List<dynamic> _products = [];
  List<dynamic> _marketlists = [];
  List<dynamic> _receipts = [];
  List<dynamic> _locations = [];
  List<dynamic> _marketlistPurchases = [];
  List<dynamic> _latestPrices = [];
  List<dynamic> _records = [];
  String? _productId;
  String? _marketlistId;
  String? _receiptId;
  String? _locationId;
  String _stage = 'received';
  DateTime _wastedAt = DateTime.now();

  static const _stages = <String, String>{
    'received': 'Saat diterima',
    'processing': 'Saat diolah',
    'finished_product': 'Produk jadi',
    'spoiled': 'Busuk / rusak',
    'other': 'Lainnya',
  };
  static const _indigo = Color(0xFF3730A3);
  static const _primary = Color(0xFF059669);

  bool get _isReceivingStage => _stage == 'received';

  String _marketlistStatus(dynamic value) {
    final status = value?.toString().replaceAll('_', ' ') ?? 'status tidak ada';
    return status.toUpperCase();
  }

  List<String> _marketlistProductNames(Map marketlist) {
    final items = marketlist['items'];
    if (items is! List) return [];
    return items
        .whereType<Map>()
        .where((item) => item['item_status'] != 'rejected')
        .map((item) {
          final product = item['product_id'];
          if (product is Map) return product['name']?.toString();
          return item['product_snapshot'] is Map
              ? item['product_snapshot']['name']?.toString()
              : item['product_name']?.toString();
        })
        .whereType<String>()
        .where((name) => name.isNotEmpty)
        .toList();
  }

  Map<String, dynamic>? get _selectedMarketlist {
    for (final marketlist in _marketlists) {
      if (marketlist is Map && marketlist['_id']?.toString() == _marketlistId) {
        return Map<String, dynamic>.from(marketlist);
      }
    }
    return null;
  }

  Map<String, dynamic>? get _selectedReceipt {
    for (final receipt in _receipts) {
      if (receipt is Map && receipt['_id']?.toString() == _receiptId) {
        return Map<String, dynamic>.from(receipt);
      }
    }
    return null;
  }

  List<Map<String, dynamic>> get _availableProducts {
    final marketlist = _selectedMarketlist;
    if (marketlist == null) {
      if (_isReceivingStage) return [];
      return _products
          .whereType<Map>()
          .map((product) => Map<String, dynamic>.from(product))
          .toList();
    }

    final receiptItems = _selectedReceipt?['items'];
    final marketlistItems = marketlist['items'];
    if (receiptItems is! List || marketlistItems is! List) return [];
    return receiptItems
        .whereType<Map>()
        .map((receiptItem) {
          final marketlistItemRef = receiptItem['marketlist_item_id'];
          final marketlistItemId = marketlistItemRef is Map
              ? marketlistItemRef['_id']?.toString()
              : marketlistItemRef?.toString();
          Map? marketlistItem;
          for (final item in marketlistItems.whereType<Map>()) {
            if (item['_id']?.toString() == marketlistItemId) {
              marketlistItem = item;
              break;
            }
          }
          final product = marketlistItem?['product_id'];
          if (product is! Map) return null;
          return <String, dynamic>{
            ...Map<String, dynamic>.from(product),
            'marketlistItemId': marketlistItemId,
            'receiptItemId': receiptItem['_id']?.toString(),
          };
        })
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Map<String, dynamic>? get _selectedProduct {
    for (final product in _availableProducts) {
      if (product['_id']?.toString() == _productId) {
        return product;
      }
    }
    return null;
  }

  List<Map<String, dynamic>> get _matchingAvailableProducts {
    final query = _productSearchController.text.trim().toLowerCase();
    return _availableProducts.where((product) {
      final name = product['name']?.toString().toLowerCase() ?? '';
      final sku = product['sku']?.toString().toLowerCase() ?? '';
      return query.isEmpty || name.contains(query) || sku.contains(query);
    }).toList();
  }

  List<Map<String, dynamic>> get _filteredAvailableProducts {
    final matches = _matchingAvailableProducts;
    final selected = _availableProducts.where(
      (product) => product['_id']?.toString() == _productId,
    );
    return [
      ...matches,
      ...selected.where(
        (product) => !matches.any(
          (match) => match['_id']?.toString() == product['_id']?.toString(),
        ),
      ),
    ];
  }

  Map<String, dynamic>? get _selectedPurchaseItem {
    final marketlistItemId = _selectedProduct?['marketlistItemId']?.toString();
    if (marketlistItemId == null) return null;
    for (final purchase in _marketlistPurchases.whereType<Map>()) {
      final items = purchase['items'];
      if (items is! List) continue;
      for (final item in items.whereType<Map>()) {
        final itemRef = item['marketlist_item_id'];
        final itemId = itemRef is Map
            ? itemRef['_id']?.toString()
            : itemRef?.toString();
        if (itemId == marketlistItemId) {
          return Map<String, dynamic>.from(item);
        }
      }
    }
    return null;
  }

  String get _unitName {
    final purchaseUnit = _selectedPurchaseItem?['unit_name']?.toString();
    if (_isReceivingStage && purchaseUnit != null && purchaseUnit.isNotEmpty) {
      return purchaseUnit;
    }
    final unit = _selectedProduct?['unit_id'];
    if (unit is Map) {
      return unit['abbreviation']?.toString() ??
          unit['name']?.toString() ??
          'unit';
    }
    return 'unit';
  }

  double get _unitPrice => _latestPurchasePrice().toDouble();

  num _latestPurchasePrice() {
    final marketlistPrice = num.tryParse(
      '${_selectedPurchaseItem?['actual_unit_price'] ?? 0}',
    );
    if (marketlistPrice != null && marketlistPrice > 0) return marketlistPrice;
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
    _productSearchController.dispose();
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
        ApiService.get(
          '/marketlists?status=approved,partial_rejection,in_progress,partially_received,received,completed&limit=500',
        ),
        ApiService.get('/waste'),
        ApiService.get('/prices/overview'),
        ApiService.get('/locations'),
      ]);
      final productsData = responses[0] is Map ? responses[0]['data'] : null;
      final marketlistsData = responses[1] is Map
          ? (responses[1]['data'] is Map
                ? responses[1]['data']['items']
                : responses[1]['items'])
          : null;
      final recordsData = responses[2] is Map ? responses[2]['data'] : null;
      final pricesData = responses[3] is Map ? responses[3]['data'] : null;
      final locationsData = responses[4] is Map ? responses[4]['data'] : null;
      if (mounted) {
        setState(() {
          _products = productsData is List ? productsData : [];
          _marketlists = marketlistsData is List
              ? marketlistsData.whereType<Map>().toList()
              : [];
          _records = recordsData is List ? recordsData : [];
          _latestPrices = pricesData is List ? pricesData : [];
          _locations = locationsData is List
              ? locationsData.whereType<Map>().toList()
              : [];
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
    if (_isReceivingStage &&
        (_marketlistId == null ||
            _receiptId == null ||
            _selectedProduct?['receiptItemId'] == null)) {
      setState(
        () => _error = 'Pilih Marketlist, penerimaan, dan item penerimaan.',
      );
      return;
    }
    if (!_isReceivingStage && _locationId == null) {
      setState(
        () => _error =
            'Pilih lokasi stok untuk menyinkronkan waste ke Baraja Coffee.',
      );
      return;
    }
    if (_selectedProduct == null) {
      setState(() => _error = 'Pilih produk yang valid.');
      return;
    }
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
      final response = await ApiService.post('/waste', {
        'product_id': _productId,
        'unit_name': _unitName,
        if (_isReceivingStage) 'marketlist_id': _marketlistId,
        if (_isReceivingStage) 'goods_receipt_id': _receiptId,
        if (_isReceivingStage)
          'goods_receipt_item_id': _selectedProduct?['receiptItemId'],
        if (!_isReceivingStage) 'location_id': _locationId,
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
        final wasteData = response is Map ? response['data'] : null;
        final integrationStatus = wasteData is Map
            ? wasteData['integration_status']?.toString()
            : null;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              integrationStatus == 'sync_failed'
                  ? 'Waste tercatat, tetapi sinkronisasi Coffee gagal. Periksa riwayat waste.'
                  : 'Waste dicatat dengan harga beli terakhir.',
            ),
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

  Future<void> _retryWasteSync(Map record) async {
    final wasteId = record['_id']?.toString();
    if (wasteId == null) return;
    setState(() {
      _syncingWasteId = wasteId;
      _error = null;
    });
    try {
      await ApiService.post('/waste/$wasteId/sync', {});
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sinkronisasi waste dikirim ulang.')),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception:', '').trim(),
        );
      }
    } finally {
      if (mounted) setState(() => _syncingWasteId = null);
    }
  }

  String _formatDate(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '');
    return date == null ? '-' : DateFormat('dd MMM yyyy').format(date);
  }

  Future<void> _chooseMarketlist() async {
    var marketlistSearch = '';
    final selectedId = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.75,
        minChildSize: 0.45,
        maxChildSize: 0.95,
        builder: (context, scrollController) => StatefulBuilder(
          builder: (context, setSheetState) {
            final query = marketlistSearch.trim().toLowerCase();
            final filteredMarketlists = _marketlists.where((marketlist) {
              if (marketlist is! Map) return false;
              final names = _marketlistProductNames(marketlist);
              final searchable = [
                marketlist['marketlist_number'],
                marketlist['status'],
                marketlist['date'],
                marketlist['required_date'],
                ...names,
              ].join(' ').toLowerCase();
              return query.isEmpty || searchable.contains(query);
            }).toList();
            return Container(
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 12, 12),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Pilih Marketlist penerimaan',
                            style: TextStyle(
                              color: Color(0xFF0F172A),
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: TextField(
                      onChanged: (value) =>
                          setSheetState(() => marketlistSearch = value),
                      decoration: InputDecoration(
                        hintText: 'Cari nomor PO, barang, atau status...',
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: marketlistSearch.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Hapus pencarian',
                                onPressed: () =>
                                    setSheetState(() => marketlistSearch = ''),
                                icon: const Icon(Icons.close_rounded),
                              ),
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                            color: Color(0xFFE2E8F0),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: _marketlists.isEmpty
                        ? const Center(
                            child: Text(
                              'Belum ada Marketlist yang bisa dipilih.',
                            ),
                          )
                        : filteredMarketlists.isEmpty
                        ? const Center(
                            child: Text('Marketlist tidak ditemukan.'),
                          )
                        : ListView.separated(
                            controller: scrollController,
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                            itemCount: filteredMarketlists.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final marketlist = Map<String, dynamic>.from(
                                filteredMarketlists[index],
                              );
                              final names = _marketlistProductNames(marketlist);
                              final selected =
                                  marketlist['_id']?.toString() ==
                                  _marketlistId;
                              return Card(
                                margin: EdgeInsets.zero,
                                color: selected
                                    ? const Color(0xFFEEF2FF)
                                    : Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: BorderSide(
                                    color: selected
                                        ? const Color(0xFFA5B4FC)
                                        : const Color(0xFFE2E8F0),
                                  ),
                                ),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 6,
                                  ),
                                  onTap: () => Navigator.pop(
                                    context,
                                    marketlist['_id']?.toString(),
                                  ),
                                  title: Text(
                                    'PO ${marketlist['marketlist_number'] ?? 'Marketlist'}',
                                    style: const TextStyle(
                                      color: _indigo,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  subtitle: Padding(
                                    padding: const EdgeInsets.only(top: 5),
                                    child: Text(
                                      'Tanggal PO: ${_formatDate(marketlist['date'])} · Dibutuhkan: ${_formatDate(marketlist['required_date'])}\n'
                                      'Status: ${_marketlistStatus(marketlist['status'])}\n'
                                      'Barang: ${names.isEmpty ? 'Belum ada item' : names.join(', ')}',
                                      maxLines: 3,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  trailing: Icon(
                                    selected
                                        ? Icons.radio_button_checked
                                        : Icons.chevron_right,
                                    color: _indigo,
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
    if (selectedId != null && mounted) {
      setState(() {
        _marketlistId = selectedId;
        _receiptId = null;
        _receipts = [];
        _marketlistPurchases = [];
        _productId = null;
        _productSearchController.clear();
        _error = null;
      });
      try {
        final responses = await Future.wait([
          ApiService.get('/marketlists/$selectedId/receipts'),
          ApiService.get('/purchases?marketlist_id=$selectedId&limit=500'),
        ]);
        final data = responses[0] is Map ? responses[0]['data'] : null;
        final purchaseData = responses[1] is Map ? responses[1]['data'] : null;
        if (mounted) {
          setState(() {
            _receipts = data is List
                ? data
                      .whereType<Map>()
                      .where(
                        (receipt) =>
                            receipt['status'] != 'cancelled' &&
                            ![
                              'verified',
                              'pending_approval',
                              'approved',
                              'posted',
                              'reversed',
                            ].contains(receipt['amphitheater_status']),
                      )
                      .toList()
                : [];
            _marketlistPurchases = purchaseData is List ? purchaseData : [];
          });
        }
      } catch (error) {
        if (mounted) {
          setState(
            () =>
                _error = error.toString().replaceFirst('Exception:', '').trim(),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: _primary, size: 22),
            SizedBox(width: 8),
            Text('Pencatatan Waste'),
          ],
        ),
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
                child: ResponsiveContent(
                  maxWidth: 1000,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
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
                                  key: ValueKey(_stage),
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
                                  onChanged: (value) => setState(() {
                                    _stage = value ?? 'received';
                                    _marketlistId = null;
                                    _receiptId = null;
                                    _receipts = [];
                                    _marketlistPurchases = [];
                                    _productId = null;
                                    _productSearchController.clear();
                                    _error = null;
                                  }),
                                ),
                                const SizedBox(height: 12),
                                if (_isReceivingStage) ...[
                                  OutlinedButton.icon(
                                    onPressed: _chooseMarketlist,
                                    icon: const Icon(
                                      Icons.receipt_long_outlined,
                                    ),
                                    label: Text(
                                      _selectedMarketlist == null
                                          ? 'Pilih Marketlist / PO'
                                          : 'Ganti Marketlist',
                                    ),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: _indigo,
                                      side: const BorderSide(
                                        color: Color(0xFFA5B4FC),
                                      ),
                                      alignment: Alignment.centerLeft,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 14,
                                      ),
                                    ),
                                  ),
                                  if (_selectedMarketlist
                                      case final marketlist?) ...[
                                    const SizedBox(height: 8),
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEEF2FF),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: const Color(0xFFC7D2FE),
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'PO / Marketlist ${marketlist['marketlist_number'] ?? ''}',
                                            style: const TextStyle(
                                              color: Color(0xFF1E1B4B),
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            'Tanggal PO: ${_formatDate(marketlist['date'])} · Dibutuhkan: ${_formatDate(marketlist['required_date'])}',
                                            style: const TextStyle(
                                              color: Color(0xFF3730A3),
                                              fontSize: 12,
                                            ),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            'Barang: ${_marketlistProductNames(marketlist).join(', ')}',
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: Color(0xFF312E81),
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                  DropdownButtonFormField<String>(
                                    key: ValueKey(
                                      'receipt-$_marketlistId-$_receiptId',
                                    ),
                                    initialValue: _receiptId,
                                    isExpanded: true,
                                    decoration: const InputDecoration(
                                      labelText: 'Penerimaan',
                                      border: OutlineInputBorder(),
                                    ),
                                    items: _receipts.map((receipt) {
                                      final data = Map<String, dynamic>.from(
                                        receipt as Map,
                                      );
                                      return DropdownMenuItem<String>(
                                        value: data['_id'].toString(),
                                        child: Text(
                                          '${data['receipt_number'] ?? 'Penerimaan'} · ${_formatDate(data['received_at'])}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      );
                                    }).toList(),
                                    onChanged: (value) => setState(() {
                                      _receiptId = value;
                                      _productId = null;
                                      _productSearchController.clear();
                                    }),
                                    validator: (value) =>
                                        _isReceivingStage && value == null
                                        ? 'Pilih penerimaan'
                                        : null,
                                  ),
                                  if (_marketlistId != null &&
                                      _receipts.isEmpty)
                                    const Padding(
                                      padding: EdgeInsets.only(top: 6),
                                      child: Text(
                                        'Tidak ada penerimaan yang masih dapat diubah. Jika sudah diposting di Coffee, catat sebagai waste stok.',
                                        style: TextStyle(
                                          color: Colors.orange,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: 12),
                                ] else ...[
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFFBEB),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: const Color(0xFFFDE68A),
                                      ),
                                    ),
                                    child: const Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Icon(
                                          Icons.inventory_2_outlined,
                                          color: Color(0xFF047857),
                                          size: 19,
                                        ),
                                        SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            'Waste akan dikurangi dari stok Baraja Coffee pada lokasi yang dipilih. Stok lokal tidak dikurangi agar tidak terjadi pengurangan ganda.',
                                            style: TextStyle(
                                              color: Color(0xFF92400E),
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  DropdownButtonFormField<String>(
                                    key: ValueKey('location-$_locationId'),
                                    initialValue: _locationId,
                                    isExpanded: true,
                                    decoration: const InputDecoration(
                                      labelText: 'Lokasi stok',
                                      border: OutlineInputBorder(),
                                    ),
                                    items: _locations
                                        .where(
                                          (location) =>
                                              location['is_active'] != false,
                                        )
                                        .map((location) {
                                          final data =
                                              Map<String, dynamic>.from(
                                                location as Map,
                                              );
                                          return DropdownMenuItem<String>(
                                            value: data['_id'].toString(),
                                            child: Text(
                                              data['name']?.toString() ?? '-',
                                            ),
                                          );
                                        })
                                        .toList(),
                                    onChanged: (value) => setState(() {
                                      _locationId = value;
                                    }),
                                    validator: (value) =>
                                        !_isReceivingStage && value == null
                                        ? 'Pilih lokasi stok'
                                        : null,
                                  ),
                                  const SizedBox(height: 12),
                                ],
                                TextField(
                                  controller: _productSearchController,
                                  onChanged: (_) => setState(() {}),
                                  decoration: InputDecoration(
                                    hintText: 'Cari nama atau SKU produk...',
                                    prefixIcon: const Icon(
                                      Icons.search_rounded,
                                    ),
                                    suffixIcon:
                                        _productSearchController.text.isEmpty
                                        ? null
                                        : IconButton(
                                            tooltip: 'Hapus pencarian',
                                            onPressed: () {
                                              _productSearchController.clear();
                                              setState(() {});
                                            },
                                            icon: const Icon(
                                              Icons.close_rounded,
                                            ),
                                          ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                DropdownButtonFormField<String>(
                                  key: ValueKey('$_marketlistId-$_productId'),
                                  initialValue: _productId,
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Produk',
                                    border: OutlineInputBorder(),
                                  ),
                                  items: _filteredAvailableProducts.map((
                                    product,
                                  ) {
                                    return DropdownMenuItem<String>(
                                      value: product['_id'].toString(),
                                      child: Text(
                                        product['name']?.toString() ?? '-',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    );
                                  }).toList(),
                                  hint: Text(
                                    _isReceivingStage &&
                                            _selectedReceipt == null
                                        ? 'Pilih penerimaan terlebih dahulu'
                                        : _availableProducts.isEmpty
                                        ? 'Tidak ada produk untuk dipilih'
                                        : _matchingAvailableProducts.isEmpty
                                        ? 'Produk tidak ditemukan'
                                        : 'Pilih produk',
                                  ),
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
                                  decoration: InputDecoration(
                                    labelText: 'Jumlah waste ($_unitName)',
                                    border: OutlineInputBorder(),
                                  ),
                                  validator: (value) {
                                    final quantity = double.tryParse(
                                      value ?? '',
                                    );
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
                                    'Harga beli: ${_currency.format(_unitPrice)} per $_unitName\nNilai waste: ${_currency.format(_wasteValue)}',
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
                                    hintText:
                                        'Jelaskan kondisi atau tindak lanjut',
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
                                  style: FilledButton.styleFrom(
                                    backgroundColor: _primary,
                                    foregroundColor: Colors.white,
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
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
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
                          final qty =
                              num.tryParse('${record['quantity']}') ?? 0;
                          final unit = record['unit_name']?.toString() ?? '';
                          final price =
                              num.tryParse(
                                '${record['unit_purchase_price']}',
                              ) ??
                              0;
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
                                  ?marketlistText,
                                  'Sinkronisasi Coffee: ${record['integration_status'] ?? 'belum disinkronkan'}',
                                  if ((record['integration_error']
                                              ?.toString() ??
                                          '')
                                      .isNotEmpty)
                                    record['integration_error'].toString(),
                                  '$qty $unit × ${_currency.format(price)}',
                                  record['reason']?.toString() ?? '',
                                  if ((record['notes']?.toString() ?? '')
                                      .isNotEmpty)
                                    {record['notes'].toString()},
                                ].join('\n'),
                              ),
                              isThreeLine: true,
                              trailing: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _currency.format(total),
                                    maxLines: 2,
                                    textAlign: TextAlign.end,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.red,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  if (record['integration_status'] ==
                                      'sync_failed')
                                    IconButton(
                                      tooltip: 'Coba sinkronisasi lagi',
                                      visualDensity: VisualDensity.compact,
                                      onPressed:
                                          _syncingWasteId ==
                                              record['_id']?.toString()
                                          ? null
                                          : () => _retryWasteSync(record),
                                      icon: const Icon(
                                        Icons.sync,
                                        color: _indigo,
                                      ),
                                    ),
                                ],
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
