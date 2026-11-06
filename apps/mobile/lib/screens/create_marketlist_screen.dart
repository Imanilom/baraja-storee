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
  String? supplierId;
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
  List<dynamic> _suppliers = [];
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
      final pRes = await ApiService.get('/products?limit=50').catchError((_) => {'data': []});
      final sRes = await ApiService.get('/suppliers?limit=50').catchError((_) => {'data': []});
      if (mounted) {
        setState(() {
          _products = pRes['data'] ?? [];
          _suppliers = sRes['data'] ?? [];
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
          'supplier_id': it.supplierId,
          'notes': it.notes,
        }).toList(),
        'notes': _notesController.text.trim(),
      };

      final res = await ApiService.post('/marketlists', payload);
      final mlId = res['data']['_id'];

      if (submitDirectlyToAdmin && mlId != null) {
        await ApiService.put('/marketlists/$mlId/submit', {});
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
                  const SizedBox(height: 20),

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
                        label: const Text('+ Tambah Baris'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Item Cards
                  ..._items.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final it = entry.value;
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
                              Text(
                                'Barang #${idx + 1}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF475569),
                                ),
                              ),
                              if (_items.length > 1)
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                  onPressed: () => _removeItem(idx),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),
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
                            items: _products.map((p) {
                              final pId = p['_id']?.toString() ?? '';
                              final pName = p['name'] ?? 'Item';
                              final uName = p['unit_id'] is Map ? p['unit_id']['name'] : 'Satuan';
                              return DropdownMenuItem<String>(
                                value: pId,
                                child: Text(
                                  '$pName ($uName)',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }).toList(),
                            onChanged: (val) {
                              setState(() {
                                it.productId = val;
                                final p = _products.firstWhere((prod) => prod['_id'] == val, orElse: () => null);
                                if (p != null) {
                                  it.productName = p['name'];
                                  it.unitName = p['unit_id'] is Map ? p['unit_id']['name'] : '';
                                  if (p['last_purchase_price'] != null && it.price == 0) {
                                    it.price = (p['last_purchase_price'] as num).toDouble();
                                  }
                                }
                              });
                            },
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: TextFormField(
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
                              Expanded(
                                flex: 3,
                                child: TextFormField(
                                  initialValue: it.price.toInt().toString(),
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Harga Satuan (Rp)',
                                    border: OutlineInputBorder(),
                                    isDense: true,
                                  ),
                                  onChanged: (val) {
                                    setState(() {
                                      it.price = double.tryParse(val) ?? 0;
                                    });
                                  },
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          // Dropdown Supplier
                          DropdownButtonFormField<String>(
                            value: it.supplierId,
                            isExpanded: true,
                            hint: const Text('Pilih Supplier (Opsional)'),
                            decoration: const InputDecoration(
                              labelText: 'Pemasok / Supplier',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            items: _suppliers.map((s) {
                              final sId = s['_id']?.toString() ?? '';
                              final sName = s['name'] ?? 'Supplier';
                              return DropdownMenuItem<String>(
                                value: sId,
                                child: Text(sName, overflow: TextOverflow.ellipsis),
                              );
                            }).toList(),
                            onChanged: (val) {
                              setState(() => it.supplierId = val);
                            },
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

