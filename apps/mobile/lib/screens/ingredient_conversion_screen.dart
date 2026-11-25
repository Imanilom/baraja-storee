import 'package:flutter/material.dart';
import '../services/api_service.dart';

class IngredientConversionScreen extends StatefulWidget {
  final List<Map<String, dynamic>>? ingredients;
  final List<Map<String, dynamic>>? recipes;
  final bool isActive;

  const IngredientConversionScreen({
    super.key,
    this.ingredients,
    this.recipes,
    this.isActive = true,
  });

  @override
  State<IngredientConversionScreen> createState() =>
      _IngredientConversionScreenState();
}

class _IngredientConversionScreenState
    extends State<IngredientConversionScreen> {
  final _searchController = TextEditingController();
  final _recipeUnitController = TextEditingController();
  final _factorController = TextEditingController();
  List<Map<String, dynamic>> _ingredients = [];
  List<Map<String, dynamic>> _recipes = [];
  Map<String, dynamic>? _selectedIngredient;
  bool _isLoading = true;
  bool _hasLoadedData = false;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.ingredients != null && widget.recipes != null) {
      _ingredients = widget.ingredients!;
      _recipes = widget.recipes!;
      _isLoading = false;
      _hasLoadedData = true;
    } else if (widget.isActive) {
      _loadData();
    } else {
      _isLoading = false;
    }
  }

  @override
  void didUpdateWidget(covariant IngredientConversionScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive && !_hasLoadedData) {
      _loadData();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _recipeUnitController.dispose();
    _factorController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _asList(dynamic value) {
    if (value is! List) return [];
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Map<String, dynamic> _responseData(dynamic response) {
    if (response is Map &&
        response['success'] == true &&
        response['data'] is Map) {
      return Map<String, dynamic>.from(response['data'] as Map);
    }
    throw const FormatException('Format data konversi stok tidak valid.');
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final responses = await Future.wait([
        ApiService.get('/integration/coffee/inventory'),
        ApiService.get('/integration/coffee/recipes'),
      ]);
      final inventory = _responseData(responses[0]);
      final recipeData = _responseData(responses[1]);
      final ingredients = _asList(inventory['ingredients']);
      final recipes = _asList(recipeData['recipes']);
      final selectedId = _selectedIngredient?['product_id']?.toString();
      if (mounted) {
        setState(() {
          _ingredients = ingredients;
          _recipes = recipes;
          _selectedIngredient = selectedId == null
              ? null
              : ingredients.cast<Map<String, dynamic>?>().firstWhere(
                  (item) => item?['product_id']?.toString() == selectedId,
                  orElse: () => null,
                );
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception:', '').trim(),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasLoadedData = true;
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filteredIngredients {
    final query = _searchController.text.trim().toLowerCase();
    return _ingredients.where((ingredient) {
      final name = ingredient['name']?.toString().toLowerCase() ?? '';
      final sku = ingredient['sku']?.toString().toLowerCase() ?? '';
      return query.isEmpty || name.contains(query) || sku.contains(query);
    }).toList();
  }

  List<Map<String, dynamic>> get _affectedRecipes {
    final selectedId = _selectedIngredient?['product_id']?.toString();
    if (selectedId == null) return [];
    return _recipes.where((recipe) {
      final sections = <dynamic>[
        recipe['baseIngredients'],
        if (recipe['toppingOptions'] is List)
          ...(recipe['toppingOptions'] as List).map(
            (option) => option is Map ? option['ingredients'] : null,
          ),
        if (recipe['addonOptions'] is List)
          ...(recipe['addonOptions'] as List).map(
            (option) => option is Map ? option['ingredients'] : null,
          ),
      ];
      return sections
          .whereType<List>()
          .expand((items) => items)
          .whereType<Map>()
          .any((ingredient) {
            final product = ingredient['productId'];
            final productId = product is Map
                ? product['_id']?.toString()
                : product?.toString();
            return productId == selectedId;
          });
    }).toList();
  }

  String _formatQuantity(double value) {
    if (!value.isFinite) return '0';
    return value == value.roundToDouble()
        ? value.toStringAsFixed(0)
        : value.toStringAsFixed(2);
  }

  void _selectIngredient(Map<String, dynamic> ingredient) {
    setState(() {
      _selectedIngredient = ingredient;
      _recipeUnitController.text =
          ingredient['recipe_unit']?.toString() ??
          ingredient['unit']?.toString() ??
          '';
      _factorController.text =
          ingredient['recipe_conversion_factor']?.toString() ?? '1';
      _error = null;
    });
  }

  Future<void> _save() async {
    final ingredient = _selectedIngredient;
    if (ingredient == null) {
      setState(() => _error = 'Pilih bahan baku terlebih dahulu.');
      return;
    }

    final recipeUnit = _recipeUnitController.text.trim();
    final factor = double.tryParse(
      _factorController.text.trim().replaceAll(',', '.'),
    );
    if (recipeUnit.isEmpty ||
        factor == null ||
        !factor.isFinite ||
        factor <= 0) {
      setState(() {
        _error = 'Satuan resep dan rasio konversi harus diisi dengan benar.';
      });
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      await ApiService.put(
        '/integration/coffee/ingredients/${ingredient['product_id']}',
        {'recipe_unit': recipeUnit, 'recipe_conversion_factor': factor},
      );
      await _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Konversi berhasil disimpan.')),
        );
      }
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
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Konversi satuan resep')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null && _ingredients.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Konversi satuan resep')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_outlined, size: 40),
                const SizedBox(height: 12),
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _loadData,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Coba lagi'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final selected = _selectedIngredient;
    final stockUnit = selected?['unit']?.toString() ?? 'satuan stok';
    final currentStock = selected?['current_stock'];
    final stockQuantity = currentStock is num
        ? currentStock.toDouble()
        : double.tryParse('$currentStock') ?? 0;
    final factor =
        double.tryParse(_factorController.text.trim().replaceAll(',', '.')) ??
        0;
    final recipeUnit = _recipeUnitController.text.trim();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Konversi satuan resep'),
        actions: [
          IconButton(
            tooltip: 'Muat ulang bahan dan resep',
            onPressed: _loadData,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.compare_arrows_rounded),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Pilih bahan, lalu masukkan jumlah satuan resep yang didapat dari satu satuan stok. Contoh: 1 kg ayam = 8 potong.',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '1. Pilih bahan baku',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
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
          const SizedBox(height: 10),
          if (_filteredIngredients.isEmpty)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: Text('Bahan baku tidak ditemukan.')),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 260),
              child: ListView.separated(
                shrinkWrap: true,
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                itemCount: _filteredIngredients.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final ingredient = _filteredIngredients[index];
                  final selectedId = _selectedIngredient?['product_id']
                      ?.toString();
                  final ingredientId = ingredient['product_id']?.toString();
                  final isSelected = selectedId == ingredientId;
                  return Card(
                    margin: EdgeInsets.zero,
                    clipBehavior: Clip.antiAlias,
                    color: isSelected
                        ? Theme.of(context).colorScheme.primaryContainer
                        : null,
                    child: ListTile(
                      leading: const CircleAvatar(
                        child: Icon(Icons.grain_rounded),
                      ),
                      title: Text(ingredient['name']?.toString() ?? 'Bahan'),
                      subtitle: Text(
                        'Stok ${ingredient['current_stock'] ?? 0} '
                        '${ingredient['unit'] ?? ''}'
                        ' · SKU ${ingredient['sku'] ?? '-'}',
                      ),
                      trailing: isSelected
                          ? Icon(
                              Icons.check_circle_rounded,
                              color: Theme.of(context).colorScheme.primary,
                            )
                          : const Icon(Icons.chevron_right_rounded),
                      onTap: () => _selectIngredient(ingredient),
                    ),
                  );
                },
              ),
            ),
          if (selected != null) ...[
            const SizedBox(height: 18),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      '2. Atur konversi',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${selected['name'] ?? 'Bahan'} · Stok tersedia '
                      '$stockQuantity $stockUnit',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _factorController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        labelText: 'Jumlah per 1 $stockUnit',
                        hintText: 'Contoh: 8',
                        prefixIcon: const Icon(Icons.numbers_rounded),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _recipeUnitController,
                      textCapitalization: TextCapitalization.words,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        labelText: 'Satuan yang dipakai di resep',
                        hintText: 'Contoh: potong atau ml',
                        prefixIcon: Icon(Icons.straighten_rounded),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.secondaryContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '1 $stockUnit = '
                        '${_factorController.text.isEmpty ? '1' : _factorController.text} '
                        '${recipeUnit.isEmpty ? 'satuan resep' : recipeUnit}\n'
                        'Stok tersedia setara dengan '
                        '${_formatQuantity(stockQuantity * factor)} '
                        '${recipeUnit.isEmpty ? 'satuan resep' : recipeUnit}.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Resep yang sudah memakai bahan ini akan ikut disesuaikan. Jumlah stok fisik tetap sama dan stok porsi menu dihitung ulang.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    if (_affectedRecipes.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Dipakai oleh ${_affectedRecipes.length} resep',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      ..._affectedRecipes.map((recipe) {
                        final menu = recipe['menuItemId'];
                        final menuName = menu is Map
                            ? menu['name']?.toString() ?? 'Menu'
                            : 'Menu';
                        final availableStock = menu is Map
                            ? menu['availableStock'] ?? 0
                            : 0;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          leading: const Icon(Icons.restaurant_menu_rounded),
                          title: Text(menuName),
                          subtitle: Text('Stok menu: $availableStock porsi'),
                        );
                      }),
                    ],
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 20),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_error != null) ...[
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              const SizedBox(height: 8),
            ],
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _isSaving || selected == null ? null : _save,
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
                label: Text(_isSaving ? 'Menyimpan...' : 'Simpan konversi'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
