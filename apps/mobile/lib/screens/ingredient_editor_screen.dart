import 'package:flutter/material.dart';
import '../services/api_service.dart';

class IngredientEditorScreen extends StatefulWidget {
  final Map<String, dynamic>? ingredient;

  const IngredientEditorScreen({super.key, this.ingredient});

  @override
  State<IngredientEditorScreen> createState() => _IngredientEditorScreenState();
}

class _IngredientEditorScreenState extends State<IngredientEditorScreen> {
  static const _categories = <String, String>{
    'food': 'Makanan',
    'beverages': 'Minuman',
    'packaging': 'Kemasan',
    'instan': 'Instan',
    'perlengkapan': 'Perlengkapan',
  };

  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _skuController;
  late final TextEditingController _nameController;
  late final TextEditingController _unitController;
  late final TextEditingController _recipeUnitController;
  late final TextEditingController _recipeConversionController;
  late String _category;
  bool _isSaving = false;
  String? _error;

  bool get _isEditing => widget.ingredient != null;

  @override
  void initState() {
    super.initState();
    final ingredient = widget.ingredient;
    _skuController = TextEditingController(
      text: ingredient?['sku']?.toString() ?? '',
    );
    _nameController = TextEditingController(
      text: ingredient?['name']?.toString() ?? '',
    );
    _unitController = TextEditingController(
      text: ingredient?['unit']?.toString() ?? '',
    );
    _recipeUnitController = TextEditingController(
      text: ingredient?['recipe_unit']?.toString() ?? '',
    );
    _recipeConversionController = TextEditingController(
      text:
          ingredient?['recipe_conversion_factor']?.toString() ??
          ingredient?['recipeConversionFactor']?.toString() ??
          '1',
    );
    final category = ingredient?['category']?.toString();
    _category = _categories.containsKey(category) ? category! : 'food';
  }

  @override
  void dispose() {
    _skuController.dispose();
    _nameController.dispose();
    _unitController.dispose();
    _recipeUnitController.dispose();
    _recipeConversionController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final conversionFactor = double.tryParse(
      _recipeConversionController.text.trim().replaceAll(',', '.'),
    );
    if (conversionFactor == null ||
        !conversionFactor.isFinite ||
        conversionFactor <= 0) {
      setState(() => _error = 'Rasio konversi harus lebih besar dari 0.');
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });
    final payload = {
      'sku': _skuController.text.trim().toUpperCase(),
      'name': _nameController.text.trim(),
      'category': _category,
      'unit': _unitController.text.trim(),
      'recipe_unit': _recipeUnitController.text.trim().isEmpty
          ? _unitController.text.trim()
          : _recipeUnitController.text.trim(),
      'recipe_conversion_factor': conversionFactor,
    };

    try {
      final productId = widget.ingredient?['product_id']?.toString();
      if (productId == null || productId.isEmpty) {
        await ApiService.post('/integration/coffee/ingredients', payload);
      } else {
        await ApiService.put(
          '/integration/coffee/ingredients/$productId',
          payload,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception:', '').trim(),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit bahan baku' : 'Tambah bahan baku'),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextFormField(
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Nama bahan baku',
                    prefixIcon: Icon(Icons.grain_rounded),
                  ),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Nama bahan baku wajib diisi.'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _skuController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'SKU',
                    prefixIcon: Icon(Icons.qr_code_rounded),
                  ),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'SKU wajib diisi.'
                      : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _category,
                  decoration: const InputDecoration(
                    labelText: 'Kategori',
                    prefixIcon: Icon(Icons.category_outlined),
                  ),
                  items: _categories.entries
                      .map(
                        (entry) => DropdownMenuItem<String>(
                          value: entry.key,
                          child: Text(entry.value),
                        ),
                      )
                      .toList(),
                  onChanged: _isSaving
                      ? null
                      : (value) {
                          if (value != null) setState(() => _category = value);
                        },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _unitController,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Satuan stok/pembelian',
                    hintText: 'Contoh: gram, ml, pcs',
                    prefixIcon: Icon(Icons.straighten_rounded),
                  ),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Satuan wajib diisi.'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _recipeUnitController,
                  textCapitalization: TextCapitalization.words,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Satuan untuk resep',
                    hintText: 'Kosongkan jika sama dengan satuan stok',
                    prefixIcon: Icon(Icons.restaurant_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _recipeConversionController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Jumlah satuan resep per satuan stok',
                    hintText: 'Contoh: 8',
                    prefixIcon: Icon(Icons.swap_horiz_rounded),
                  ),
                  validator: (value) {
                    final factor = double.tryParse(
                      (value ?? '').trim().replaceAll(',', '.'),
                    );
                    return factor == null || !factor.isFinite || factor <= 0
                        ? 'Masukkan rasio lebih besar dari 0.'
                        : null;
                  },
                ),
                const SizedBox(height: 8),
                Text(
                  '1 ${_unitController.text.trim().isEmpty ? 'satuan stok' : _unitController.text.trim()} = '
                  '${_recipeConversionController.text.trim().isEmpty ? '1' : _recipeConversionController.text.trim()} '
                  '${_recipeUnitController.text.trim().isEmpty ? (_unitController.text.trim().isEmpty ? 'satuan resep' : _unitController.text.trim()) : _recipeUnitController.text.trim()}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 14),
                Text(
                  'Bahan baru akan tersedia untuk dipilih saat menyusun resep. Stok awal 0 dan dapat diatur dari menu Sesuaikan stok.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                FilledButton.icon(
                  onPressed: _isSaving ? null : _save,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.save_outlined),
                  label: Text(_isSaving ? 'Menyimpan...' : 'Simpan bahan baku'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
