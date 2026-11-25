import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class RecipeEditorScreen extends StatefulWidget {
  final List<Map<String, dynamic>> menus;
  final List<Map<String, dynamic>> products;
  final Map<String, dynamic>? recipe;

  const RecipeEditorScreen({
    super.key,
    required this.menus,
    required this.products,
    this.recipe,
  });

  @override
  State<RecipeEditorScreen> createState() => _RecipeEditorScreenState();
}

class _IngredientDraft {
  final TextEditingController quantityController;
  final TextEditingController unitController;
  String? productId;
  bool isMain;

  _IngredientDraft({
    required this.productId,
    required String quantity,
    required String unit,
    required this.isMain,
  }) : quantityController = TextEditingController(text: quantity),
       unitController = TextEditingController(text: unit);

  void dispose() {
    quantityController.dispose();
    unitController.dispose();
  }
}

class _IngredientProductPickerSheet extends StatefulWidget {
  final List<String> categories;
  final String? selectedProductId;
  final String Function(dynamic) categoryName;
  final List<Map<String, dynamic>> Function(String, String) filterProducts;

  const _IngredientProductPickerSheet({
    required this.categories,
    required this.selectedProductId,
    required this.categoryName,
    required this.filterProducts,
  });

  @override
  State<_IngredientProductPickerSheet> createState() =>
      _IngredientProductPickerSheetState();
}

class _IngredientProductPickerSheetState
    extends State<_IngredientProductPickerSheet> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final bottomInset = media.viewInsets.bottom;
    final availableHeight =
        media.size.height - bottomInset - media.padding.bottom - 16;
    final pickerHeight = availableHeight < media.size.height * 0.78
        ? availableHeight
        : media.size.height * 0.78;
    final products = widget.filterProducts(
      _searchController.text,
      _selectedCategory,
    );

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, bottomInset + 16),
        child: SizedBox(
          height: pickerHeight,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Pilih bahan baku',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  isDense: true,
                  labelText: 'Cari nama atau SKU',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _searchController.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Hapus pencarian',
                          onPressed: () {
                            _searchController.clear();
                            setState(() {});
                          },
                          icon: const Icon(Icons.close_rounded),
                        ),
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _selectedCategory,
                isExpanded: true,
                decoration: const InputDecoration(
                  isDense: true,
                  labelText: 'Kategori',
                  prefixIcon: Icon(Icons.category_outlined),
                ),
                items: [
                  const DropdownMenuItem<String>(
                    value: '',
                    child: Text('Semua kategori'),
                  ),
                  ...widget.categories.map(
                    (category) => DropdownMenuItem<String>(
                      value: category,
                      child: Text(category),
                    ),
                  ),
                ],
                onChanged: (value) =>
                    setState(() => _selectedCategory = value ?? ''),
              ),
              const SizedBox(height: 8),
              Text(
                '${products.length} bahan ditemukan',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 4),
              Expanded(
                child: products.isEmpty
                    ? const Center(child: Text('Bahan baku tidak ditemukan.'))
                    : ListView.separated(
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        itemCount: products.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final product = products[index];
                          final id = product['product_id']?.toString() ?? '';
                          final category = widget.categoryName(
                            product['category'],
                          );
                          final unit = product['unit']?.toString() ?? '';
                          final sku = product['sku']?.toString() ?? '';
                          final details = [
                            if (sku.isNotEmpty) 'SKU $sku',
                            if (category.isNotEmpty) category,
                            if (unit.isNotEmpty) 'Stok: $unit',
                          ];
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const CircleAvatar(
                              child: Icon(Icons.grain_rounded),
                            ),
                            title: Text(
                              product['name']?.toString() ?? 'Bahan baku',
                            ),
                            subtitle: details.isEmpty
                                ? null
                                : Text(details.join(' • ')),
                            trailing: id == widget.selectedProductId
                                ? Icon(
                                    Icons.check_circle_rounded,
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.primary,
                                  )
                                : null,
                            onTap: () => Navigator.pop(context, id),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecipeEditorScreenState extends State<RecipeEditorScreen> {
  final List<_IngredientDraft> _ingredients = [];
  final TextEditingController _menuSearchController = TextEditingController();
  String? _menuItemId;
  String? _error;
  bool _isSaving = false;

  String _id(dynamic value) {
    if (value is Map) return value['_id']?.toString() ?? '';
    return value?.toString() ?? '';
  }

  @override
  void initState() {
    super.initState();
    final menu = widget.recipe?['menuItemId'];
    _menuItemId = menu is Map ? menu['_id']?.toString() : menu?.toString();

    final baseIngredients = widget.recipe?['baseIngredients'];
    if (baseIngredients is List) {
      for (final rawIngredient in baseIngredients.whereType<Map>()) {
        final product = rawIngredient['productId'];
        _ingredients.add(
          _IngredientDraft(
            productId: _id(product),
            quantity: rawIngredient['quantity']?.toString() ?? '1',
            unit: rawIngredient['unit']?.toString() ?? '',
            isMain: rawIngredient['isDefault'] == true,
          ),
        );
      }
    }
    if (_ingredients.isEmpty) {
      _ingredients.add(
        _IngredientDraft(
          productId: null,
          quantity: '1',
          unit: '',
          isMain: true,
        ),
      );
    }
  }

  @override
  void dispose() {
    for (final ingredient in _ingredients) {
      ingredient.dispose();
    }
    _menuSearchController.dispose();
    super.dispose();
  }

  Future<void> _addIngredient() async {
    final ingredient = _IngredientDraft(
      productId: null,
      quantity: '1',
      unit: '',
      isMain: _ingredients.isEmpty,
    );
    setState(() {
      _ingredients.add(ingredient);
      _error = null;
    });
    if (widget.products.isNotEmpty) {
      await _chooseProduct(ingredient);
    }
  }

  void _removeIngredient(int index) {
    setState(() {
      _ingredients.removeAt(index).dispose();
      _error = null;
    });
  }

  void _selectProduct(_IngredientDraft ingredient, String? productId) {
    Map<String, dynamic>? product;
    for (final candidate in widget.products) {
      if (candidate['product_id']?.toString() == productId) {
        product = candidate;
        break;
      }
    }
    setState(() {
      ingredient.productId = productId;
      if (product != null) {
        ingredient.unitController.text =
            product['recipe_unit']?.toString() ??
            product['unit']?.toString() ??
            '';
      }
      _error = null;
    });
  }

  Future<void> _chooseProduct(_IngredientDraft ingredient) async {
    final productId = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _IngredientProductPickerSheet(
        categories: _productCategories(),
        selectedProductId: ingredient.productId,
        categoryName: _productCategoryName,
        filterProducts: _filteredProducts,
      ),
    );
    if (productId != null && mounted && _ingredients.contains(ingredient)) {
      _selectProduct(ingredient, productId);
    }
  }

  Future<void> _save() async {
    if (_menuItemId == null || _menuItemId!.isEmpty) {
      setState(() => _error = 'Pilih menu yang akan dibuatkan resep.');
      return;
    }
    if (_ingredients.isEmpty ||
        !_ingredients.any((ingredient) => ingredient.isMain)) {
      setState(() => _error = 'Tambahkan minimal satu bahan utama.');
      return;
    }

    final payloadIngredients = <Map<String, dynamic>>[];
    for (var index = 0; index < _ingredients.length; index++) {
      final ingredient = _ingredients[index];
      final quantity = double.tryParse(
        ingredient.quantityController.text.trim().replaceAll(',', '.'),
      );
      final unit = ingredient.unitController.text.trim();
      if (ingredient.productId == null ||
          quantity == null ||
          !quantity.isFinite ||
          quantity <= 0 ||
          unit.isEmpty) {
        setState(
          () => _error =
              'Lengkapi produk, jumlah, dan satuan pada bahan ${index + 1}.',
        );
        return;
      }
      payloadIngredients.add({
        'productId': ingredient.productId,
        'quantity': quantity,
        'unit': unit,
        'isDefault': ingredient.isMain,
      });
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      final payload = {
        'menuItemId': _menuItemId,
        'baseIngredients': payloadIngredients,
      };
      final recipeId = widget.recipe?['_id']?.toString();
      if (recipeId == null || recipeId.isEmpty) {
        await ApiService.post('/integration/coffee/recipes', payload);
      } else {
        await ApiService.put('/integration/coffee/recipes/$recipeId', payload);
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

  String _productCategoryName(dynamic category) {
    if (category is String) return category;
    if (category is Map) return category['name']?.toString() ?? '';
    if (category is List) {
      return category
          .map((item) => _productCategoryName(item))
          .where((item) => item.isNotEmpty)
          .join(', ');
    }
    return '';
  }

  List<Map<String, dynamic>> _filteredProducts(
    String searchText,
    String categoryFilter,
  ) {
    final search = searchText.trim().toLowerCase();
    return widget.products.where((product) {
      final name = product['name']?.toString().toLowerCase() ?? '';
      final sku = product['sku']?.toString().toLowerCase() ?? '';
      final category = _productCategoryName(product['category']).toLowerCase();
      final matchesSearch =
          search.isEmpty || name.contains(search) || sku.contains(search);
      final matchesCategory =
          categoryFilter.isEmpty ||
          category
              .split(',')
              .map((item) => item.trim())
              .contains(categoryFilter.toLowerCase());
      return matchesSearch && matchesCategory;
    }).toList();
  }

  List<String> _productCategories() {
    final categories = <String>{};
    for (final product in widget.products) {
      for (final category
          in _productCategoryName(product['category'])
              .split(',')
              .map((item) => item.trim())
              .where((item) => item.isNotEmpty)) {
        categories.add(category);
      }
    }
    return categories.toList()..sort();
  }

  Widget _buildIngredientCard(int index) {
    final ingredient = _ingredients[index];
    final colors = Theme.of(context).colorScheme;
    final selectedProduct = widget.products.where(
      (product) => product['product_id']?.toString() == ingredient.productId,
    );
    final selectedProductExists = widget.products.any(
      (product) => product['product_id']?.toString() == ingredient.productId,
    );
    final selectedProductRecord = selectedProduct.isEmpty
        ? null
        : selectedProduct.first;
    final selectedRecipeUnit =
        selectedProductRecord?['recipe_unit']?.toString() ??
        selectedProductRecord?['unit']?.toString() ??
        '';
    final selectedStockUnit = selectedProductRecord?['unit']?.toString() ?? '';
    final conversionFactor =
        double.tryParse(
          '${selectedProductRecord?['recipe_conversion_factor'] ?? 1}',
        ) ??
        1;
    final hasConversion =
        selectedRecipeUnit.toLowerCase() != selectedStockUnit.toLowerCase() ||
        (conversionFactor - 1).abs() > 0.000000001;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Bahan ${index + 1}',
                    style: const TextStyle(
                      color: BarajaPalette.ink,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Hapus bahan',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _removeIngredient(index),
                  icon: const Icon(Icons.delete_outline_rounded),
                  color: colors.error,
                ),
              ],
            ),
            const SizedBox(height: 4),
            OutlinedButton.icon(
              onPressed: widget.products.isEmpty
                  ? null
                  : () => _chooseProduct(ingredient),
              icon: const Icon(Icons.grain_rounded),
              label: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  selectedProductExists
                      ? selectedProductRecord!['name']?.toString() ??
                            'Pilih bahan baku'
                      : 'Pilih bahan baku',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 14,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: ingredient.quantityController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Jumlah per porsi',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: ingredient.unitController,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Satuan resep',
                    ),
                  ),
                ),
              ],
            ),
            if (selectedProductRecord != null && hasConversion) ...[
              const SizedBox(height: 6),
              Text(
                'Konversi stok: 1 $selectedStockUnit = '
                '${conversionFactor.toString()} $selectedRecipeUnit',
                style: TextStyle(
                  color: colors.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (ingredient.unitController.text.trim().toLowerCase() !=
                  selectedRecipeUnit.toLowerCase())
                Text(
                  'Satuan resep bahan ini berbeda. Gunakan $selectedRecipeUnit agar konversi stok diterapkan.',
                  style: TextStyle(color: colors.error, fontSize: 11),
                ),
            ],
            const SizedBox(height: 12),
            SegmentedButton<bool>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment<bool>(
                  value: true,
                  icon: Icon(Icons.star_outline_rounded),
                  label: Text('Utama'),
                ),
                ButtonSegment<bool>(
                  value: false,
                  icon: Icon(Icons.add_circle_outline_rounded),
                  label: Text('Pendukung'),
                ),
              ],
              selected: {ingredient.isMain},
              onSelectionChanged: (selection) {
                setState(() {
                  ingredient.isMain = selection.first;
                  _error = null;
                });
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final menus = widget.menus.where((menu) {
      final search = _menuSearchController.text.trim().toLowerCase();
      final name = menu['name']?.toString().toLowerCase() ?? '';
      return search.isEmpty || name.contains(search);
    }).toList();
    final selectedMenuExists = widget.menus.any(
      (menu) => menu['menu_item_id']?.toString() == _menuItemId,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.recipe == null ? 'Buat resep' : 'Edit resep'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: BarajaPalette.mint,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline_rounded, color: BarajaPalette.forest),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Bahan utama menentukan stok porsi dan status aktif menu. Bahan pendukung tetap tercatat untuk pemakaian penjualan, tetapi tidak menonaktifkan menu.',
                    style: TextStyle(
                      color: BarajaPalette.forestDeep,
                      fontSize: 12,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _menuSearchController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              isDense: true,
              labelText: 'Cari menu',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _menuSearchController.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Hapus pencarian',
                      onPressed: () {
                        _menuSearchController.clear();
                        setState(() {});
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: selectedMenuExists ? _menuItemId : null,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Menu',
              prefixIcon: Icon(Icons.restaurant_menu_rounded),
            ),
            items: menus.map((menu) {
              return DropdownMenuItem<String>(
                value: menu['menu_item_id']?.toString(),
                child: Text(
                  menu['name']?.toString() ?? 'Menu',
                  overflow: TextOverflow.ellipsis,
                ),
              );
            }).toList(),
            onChanged: widget.recipe == null
                ? (value) => setState(() {
                    _menuItemId = value;
                    _error = null;
                  })
                : null,
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Bahan resep',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                '${_ingredients.length} item',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (menus.isEmpty && widget.recipe == null)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text(
                'Tidak ada menu yang bisa dibuatkan resep baru.',
                style: TextStyle(color: BarajaPalette.muted, fontSize: 12),
              ),
            ),
          if (widget.products.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text(
                'Master bahan baku Coffee belum tersedia.',
                style: TextStyle(color: BarajaPalette.muted, fontSize: 12),
              ),
            ),
          ...List.generate(
            _ingredients.length,
            (index) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _buildIngredientCard(index),
            ),
          ),
          OutlinedButton.icon(
            onPressed: _addIngredient,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Tambah bahan'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(
              _error!,
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton.icon(
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
          label: Text(_isSaving ? 'Menyimpan resep...' : 'Simpan resep'),
        ),
      ),
    );
  }
}
