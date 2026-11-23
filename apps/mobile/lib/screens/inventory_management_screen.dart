import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'recipe_editor_screen.dart';

class InventoryManagementScreen extends StatefulWidget {
  final UserModel user;

  const InventoryManagementScreen({super.key, required this.user});

  @override
  State<InventoryManagementScreen> createState() =>
      _InventoryManagementScreenState();
}

class _InventoryManagementScreenState extends State<InventoryManagementScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final TextEditingController _ingredientSearchController =
      TextEditingController();
  final TextEditingController _menuSearchController = TextEditingController();
  final TextEditingController _recipeSearchController = TextEditingController();
  bool _isLoading = true;
  Map<String, dynamic>? _inventory;
  Map<String, dynamic>? _recipeData;
  String? _error;
  int _selectedTabIndex = 0;
  String _ingredientCategory = '';
  String _menuCategory = '';
  String _menuStatus = 'all';
  String _recipeCategory = '';
  final TextEditingController _ingredientActualStockController =
      TextEditingController();
  final TextEditingController _ingredientAdjustmentNoteController =
      TextEditingController();

  bool get _canManageRecipes => const {
    'admin',
    'management',
    'leader',
  }.contains(widget.user.role.toLowerCase());

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(_handleTabChanged);
    _load();
  }

  void _handleTabChanged() {
    if (_selectedTabIndex == _tabController.index) return;
    setState(() => _selectedTabIndex = _tabController.index);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _ingredientSearchController.dispose();
    _menuSearchController.dispose();
    _recipeSearchController.dispose();
    _ingredientActualStockController.dispose();
    _ingredientAdjustmentNoteController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _list(dynamic value) {
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
    throw const FormatException('Format data stok Coffee tidak valid.');
  }

  Future<void> _load() async {
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
      if (mounted) {
        setState(() {
          _inventory = inventory;
          _recipeData = recipeData;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString().replaceFirst('Exception:', '').trim();
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openRecipeEditor({Map<String, dynamic>? recipe}) async {
    final menus = _list(_recipeData?['menus']);
    final recipes = _list(_recipeData?['recipes']);
    final existingMenuIds = recipes
        .map((entry) {
          final menu = entry['menuItemId'];
          return menu is Map ? menu['_id']?.toString() : menu?.toString();
        })
        .whereType<String>()
        .toSet();
    final availableMenus = recipe == null
        ? menus
              .where((menu) => !existingMenuIds.contains(menu['menu_item_id']))
              .toList()
        : menus;

    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => RecipeEditorScreen(
          menus: availableMenus,
          products: _list(_recipeData?['products']),
          recipe: recipe,
        ),
      ),
    );
    if (saved == true) await _load();
  }

  String _formatQuantity(dynamic value) {
    final number = value is num ? value.toDouble() : double.tryParse('$value');
    if (number == null) return '0';
    return number == number.roundToDouble()
        ? number.toInt().toString()
        : number.toString();
  }

  Widget _infoCard({required IconData icon, required String text}) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.primaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 19, color: colors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: colors.onPrimaryContainer,
                fontSize: 12,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openIngredientAdjustment(
    Map<String, dynamic> ingredient,
  ) async {
    final warehouses = _list(ingredient['warehouses']);
    if (warehouses.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Bahan ini belum memiliki gudang untuk disesuaikan.'),
        ),
      );
      return;
    }

    String warehouseId = warehouses.first['warehouse_id']?.toString() ?? '';
    String actualStock = _formatQuantity(warehouses.first['current_stock']);
    _ingredientActualStockController.text = actualStock;
    _ingredientAdjustmentNoteController.clear();

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text('Sesuaikan ${ingredient['name'] ?? 'bahan baku'}'),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: warehouseId,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Gudang'),
                      items: warehouses.map((warehouse) {
                        final id = warehouse['warehouse_id']?.toString() ?? '';
                        return DropdownMenuItem<String>(
                          value: id,
                          child: Text(
                            warehouse['warehouse_name']?.toString() ?? 'Gudang',
                          ),
                        );
                      }).toList(),
                      onChanged: (value) {
                        if (value == null) return;
                        final warehouse = warehouses.firstWhere(
                          (item) => item['warehouse_id']?.toString() == value,
                          orElse: () => <String, dynamic>{},
                        );
                        setDialogState(() {
                          warehouseId = value;
                          actualStock = _formatQuantity(
                            warehouse['current_stock'],
                          );
                          _ingredientActualStockController.text = actualStock;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      controller: _ingredientActualStockController
                        ..text = actualStock,
                      decoration: InputDecoration(
                        labelText: 'Stok fisik',
                        suffixText: ingredient['unit']?.toString() ?? '',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _ingredientAdjustmentNoteController,
                      decoration: const InputDecoration(
                        labelText: 'Catatan penyesuaian',
                      ),
                      maxLines: 2,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Batal'),
                ),
                FilledButton(
                  onPressed: () async {
                    final value = double.tryParse(
                      _ingredientActualStockController.text.trim().replaceAll(
                        ',',
                        '.',
                      ),
                    );
                    if (value == null || !value.isFinite || value < 0) {
                      ScaffoldMessenger.of(dialogContext).showSnackBar(
                        const SnackBar(
                          content: Text('Masukkan stok fisik yang valid.'),
                        ),
                      );
                      return;
                    }
                    try {
                      await ApiService.put(
                        '/integration/coffee/ingredients/${ingredient['product_id']}/stock',
                        {
                          'warehouseId': warehouseId,
                          'actualStock': value,
                          'handledBy': widget.user.name,
                          'notes': _ingredientAdjustmentNoteController.text
                              .trim(),
                        },
                      );
                      if (dialogContext.mounted) {
                        Navigator.pop(dialogContext, true);
                      }
                    } catch (error) {
                      if (dialogContext.mounted) {
                        ScaffoldMessenger.of(dialogContext).showSnackBar(
                          SnackBar(
                            content: Text(
                              error
                                  .toString()
                                  .replaceFirst('Exception:', '')
                                  .trim(),
                            ),
                          ),
                        );
                      }
                    }
                  },
                  child: const Text('Simpan'),
                ),
              ],
            );
          },
        );
      },
    );
    if (saved == true) await _load();
  }

  Widget _emptyState(String title, String detail) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: BarajaPalette.mint,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.inventory_2_outlined,
                color: BarajaPalette.forest,
                size: 28,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              detail,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _categoryName(dynamic category) {
    if (category is String) return category;
    if (category is Map) {
      return category['name']?.toString() ?? '';
    }
    if (category is List) {
      return category
          .map((item) => _categoryName(item))
          .where((item) => item.isNotEmpty)
          .join(', ');
    }
    return '';
  }

  List<String> _categories(List<Map<String, dynamic>> items) {
    final categories = <String>{};
    for (final item in items) {
      for (final category
          in _categoryName(item['category'])
              .split(',')
              .map((item) => item.trim())
              .where((item) => item.isNotEmpty)) {
        categories.add(category);
      }
    }
    final result = categories.toList()..sort();
    return result;
  }

  Widget _searchFilterBar({
    required TextEditingController searchController,
    required String hintText,
    required List<String> categories,
    required String selectedCategory,
    required ValueChanged<String> onCategoryChanged,
    List<Widget> extraFilters = const [],
  }) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Column(
        children: [
          TextField(
            controller: searchController,
            onChanged: (_) => setState(() {}),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              isDense: true,
              hintText: hintText,
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: searchController.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Hapus pencarian',
                      onPressed: () {
                        searchController.clear();
                        setState(() {});
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: selectedCategory.isEmpty
                      ? null
                      : selectedCategory,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    isDense: true,
                    labelText: 'Kategori',
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                  items: [
                    const DropdownMenuItem<String>(
                      value: '',
                      child: Text('Semua kategori'),
                    ),
                    ...categories.map(
                      (category) => DropdownMenuItem<String>(
                        value: category,
                        child: Text(category),
                      ),
                    ),
                  ],
                  onChanged: (value) => onCategoryChanged(value ?? ''),
                ),
              ),
              ...extraFilters,
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildIngredientsTab() {
    final ingredients = _list(_inventory?['ingredients']);
    final search = _ingredientSearchController.text.trim().toLowerCase();
    final filteredIngredients = ingredients.where((item) {
      final name = item['name']?.toString().toLowerCase() ?? '';
      final sku = item['sku']?.toString().toLowerCase() ?? '';
      final category = _categoryName(item['category']).toLowerCase();
      final matchesSearch =
          search.isEmpty || name.contains(search) || sku.contains(search);
      final matchesCategory =
          _ingredientCategory.isEmpty ||
          category
              .split(',')
              .map((item) => item.trim())
              .contains(_ingredientCategory.toLowerCase());
      return matchesSearch && matchesCategory;
    }).toList();
    if (ingredients.isEmpty) {
      return _emptyState(
        'Belum ada bahan baku',
        'Produk bahan baku dari master Baraja Coffee akan tampil di sini.',
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        itemCount: filteredIngredients.isEmpty
            ? 3
            : filteredIngredients.length + 2,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _searchFilterBar(
              searchController: _ingredientSearchController,
              hintText: 'Cari nama atau SKU bahan...',
              categories: _categories(ingredients),
              selectedCategory: _ingredientCategory,
              onCategoryChanged: (value) {
                setState(() => _ingredientCategory = value);
              },
            );
          }
          if (index == 1) {
            return _infoCard(
              icon: Icons.sync_rounded,
              text:
                  'Stok mengikuti penerimaan yang sudah diposting di Baraja Coffee. Penjualan dan waste akan mengurangi saldo di gudang terkait.',
            );
          }
          if (filteredIngredients.isEmpty) {
            return _emptyState(
              'Bahan baku tidak ditemukan',
              'Coba ubah kata pencarian atau kategori.',
            );
          }
          final item = filteredIngredients[index - 2];
          final warehouses = _list(item['warehouses']);
          final unit = item['unit']?.toString() ?? '';
          final quantity = _formatQuantity(item['current_stock']);
          final isLow =
              (item['current_stock'] as num? ?? 0) <=
              (item['minimum_stock'] as num? ?? 0);
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: BarajaPalette.mint,
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: const Icon(
                          Icons.grain_rounded,
                          color: BarajaPalette.forest,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item['name']?.toString() ?? 'Bahan baku',
                              style: const TextStyle(
                                color: BarajaPalette.ink,
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '${item['sku'] ?? '-'} · ${item['category'] ?? 'Bahan baku'}',
                              style: const TextStyle(
                                color: BarajaPalette.muted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '$quantity $unit',
                            style: TextStyle(
                              color: isLow
                                  ? Theme.of(context).colorScheme.error
                                  : BarajaPalette.forest,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            isLow ? 'Stok rendah' : 'Stok tersedia',
                            style: const TextStyle(
                              color: BarajaPalette.muted,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 4),
                      IconButton(
                        tooltip: 'Sesuaikan stok',
                        visualDensity: VisualDensity.compact,
                        onPressed: () => _openIngredientAdjustment(item),
                        icon: const Icon(Icons.tune_rounded),
                        color: BarajaPalette.forest,
                      ),
                    ],
                  ),
                  if (warehouses.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const Divider(height: 1),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: warehouses.map((warehouse) {
                        return _StockTag(
                          label:
                              '${warehouse['warehouse_name']}: ${_formatQuantity(warehouse['current_stock'])} $unit',
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMenusTab() {
    final menus = _list(_inventory?['menus']);
    final search = _menuSearchController.text.trim().toLowerCase();
    final filteredMenus = menus.where((item) {
      final name = item['name']?.toString().toLowerCase() ?? '';
      final category = _categoryName(item['category']).toLowerCase();
      final workstation = item['workstation']?.toString().toLowerCase() ?? '';
      final matchesSearch =
          search.isEmpty ||
          name.contains(search) ||
          workstation.contains(search);
      final matchesCategory =
          _menuCategory.isEmpty ||
          category
              .split(',')
              .map((item) => item.trim())
              .contains(_menuCategory.toLowerCase());
      final matchesStatus =
          _menuStatus == 'all' ||
          (_menuStatus == 'active' && item['is_active'] == true) ||
          (_menuStatus == 'inactive' && item['is_active'] != true);
      return matchesSearch && matchesCategory && matchesStatus;
    }).toList();
    if (menus.isEmpty) {
      return _emptyState(
        'Belum ada stok menu',
        'Data menu dan stok terhitung akan disinkronkan dari Baraja Coffee.',
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        itemCount: filteredMenus.isEmpty ? 3 : filteredMenus.length + 2,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _searchFilterBar(
              searchController: _menuSearchController,
              hintText: 'Cari nama atau workstation menu...',
              categories: _categories(menus),
              selectedCategory: _menuCategory,
              onCategoryChanged: (value) {
                setState(() => _menuCategory = value);
              },
              extraFilters: [
                const SizedBox(width: 8),
                SizedBox(
                  width: 132,
                  child: DropdownButtonFormField<String>(
                    initialValue: _menuStatus,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      isDense: true,
                      labelText: 'Status',
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('Semua')),
                      DropdownMenuItem(value: 'active', child: Text('Aktif')),
                      DropdownMenuItem(
                        value: 'inactive',
                        child: Text('Nonaktif'),
                      ),
                    ],
                    onChanged: (value) {
                      setState(() => _menuStatus = value ?? 'all');
                    },
                  ),
                ),
              ],
            );
          }
          if (index == 1) {
            return _infoCard(
              icon: Icons.calculate_outlined,
              text:
                  'Jumlah porsi dihitung dari stok bahan utama resep. Jika bahan utama habis, menu nonaktif; bahan pendukung tidak menjadi batas stok menu.',
            );
          }
          if (filteredMenus.isEmpty) {
            return _emptyState(
              'Stok menu tidak ditemukan',
              'Coba ubah kata pencarian, kategori, atau status.',
            );
          }
          final menu = filteredMenus[index - 2];
          final isActive = menu['is_active'] == true;
          final warehouses = _list(menu['warehouses']);
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          menu['name']?.toString() ?? 'Menu',
                          style: const TextStyle(
                            color: BarajaPalette.ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      _StatusTag(
                        label: isActive ? 'Aktif' : 'Nonaktif',
                        active: isActive,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(
                        Icons.restaurant_menu_rounded,
                        size: 17,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 7),
                      Text(
                        '${_formatQuantity(menu['current_stock'])} porsi',
                        style: TextStyle(
                          color: isActive
                              ? BarajaPalette.forest
                              : BarajaPalette.muted,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        menu['workstation']?.toString().isNotEmpty == true
                            ? menu['workstation'].toString().toUpperCase()
                            : 'WORKSTATION -',
                        style: const TextStyle(
                          color: BarajaPalette.muted,
                          fontSize: 10,
                          letterSpacing: 0.6,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      if (menu['has_recipe'] != true)
                        const Text(
                          'Resep belum ada',
                          style: TextStyle(
                            color: BarajaPalette.honey,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                  if (warehouses.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: warehouses.map((warehouse) {
                        return _StockTag(
                          label:
                              '${warehouse['warehouse_name']}: ${_formatQuantity(warehouse['current_stock'])} porsi',
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildRecipesTab() {
    final recipes = _list(_recipeData?['recipes']);
    final menus = _list(_inventory?['menus']);
    final menuCategories = <String, String>{};
    for (final menu in menus) {
      final menuId = menu['menu_item_id']?.toString();
      if (menuId != null) {
        menuCategories[menuId] = _categoryName(menu['category']);
      }
    }
    final search = _recipeSearchController.text.trim().toLowerCase();
    final filteredRecipes = recipes.where((recipe) {
      final menu = recipe['menuItemId'];
      final menuId = menu is Map ? menu['_id']?.toString() : menu?.toString();
      var menuName = menu is Map ? menu['name']?.toString() ?? '' : '';
      if (menuName.isEmpty) {
        for (final menuItem in menus) {
          if (menuItem['menu_item_id']?.toString() == menuId) {
            menuName = menuItem['name']?.toString() ?? '';
            break;
          }
        }
      }
      final ingredients = _list(recipe['baseIngredients']);
      final ingredientNames = ingredients
          .map((ingredient) {
            final product = ingredient['productId'];
            return product is Map ? product['name']?.toString() ?? '' : '';
          })
          .join(' ')
          .toLowerCase();
      final category = (menuCategories[menuId] ?? '').toLowerCase();
      final matchesSearch =
          search.isEmpty ||
          menuName.toLowerCase().contains(search) ||
          ingredientNames.contains(search);
      final matchesCategory =
          _recipeCategory.isEmpty ||
          category
              .split(',')
              .map((item) => item.trim())
              .contains(_recipeCategory.toLowerCase());
      return matchesSearch && matchesCategory;
    }).toList();
    if (recipes.isEmpty) {
      return _emptyState(
        'Resep belum tersedia',
        _canManageRecipes
            ? 'Buat resep untuk menghitung stok porsi menu dari bahan utama.'
            : 'Minta admin atau manajemen menambahkan resep menu.',
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        itemCount: filteredRecipes.isEmpty ? 3 : filteredRecipes.length + 2,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _searchFilterBar(
              searchController: _recipeSearchController,
              hintText: 'Cari nama menu atau bahan resep...',
              categories: _categories(menus),
              selectedCategory: _recipeCategory,
              onCategoryChanged: (value) {
                setState(() => _recipeCategory = value);
              },
            );
          }
          if (index == 1) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _infoCard(
                  icon: Icons.menu_book_outlined,
                  text:
                      'Bahan utama menentukan ketersediaan menu. Bahan pendukung tetap dipakai saat penjualan, tetapi tidak menonaktifkan menu jika stoknya habis.',
                ),
                const SizedBox(height: 10),
                const Wrap(
                  spacing: 8,
                  children: [
                    _StatusTag(label: 'Bahan utama', active: true),
                    _StatusTag(label: 'Bahan pendukung', active: false),
                  ],
                ),
              ],
            );
          }
          if (filteredRecipes.isEmpty) {
            return _emptyState(
              'Resep tidak ditemukan',
              'Coba ubah kata pencarian atau kategori.',
            );
          }
          final recipe = filteredRecipes[index - 2];
          final menu = recipe['menuItemId'];
          final menuName = menu is Map
              ? menu['name']?.toString() ?? 'Menu'
              : 'Menu';
          final ingredients = _list(recipe['baseIngredients']);
          final mainCount = ingredients
              .where((ingredient) => ingredient['isDefault'] == true)
              .length;
          final supportCount = ingredients.length - mainCount;
          return Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: _canManageRecipes
                  ? () => _openRecipeEditor(recipe: recipe)
                  : null,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            menuName,
                            style: const TextStyle(
                              color: BarajaPalette.ink,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        if (_canManageRecipes)
                          const Icon(
                            Icons.edit_outlined,
                            size: 18,
                            color: BarajaPalette.muted,
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: [
                        _StatusTag(
                          label: '$mainCount bahan utama',
                          active: true,
                        ),
                        _StatusTag(
                          label: '$supportCount bahan pendukung',
                          active: false,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ...ingredients.map((ingredient) {
                      final product = ingredient['productId'];
                      final productName = product is Map
                          ? product['name']?.toString() ?? 'Bahan'
                          : 'Bahan';
                      final role = ingredient['isDefault'] == true
                          ? 'Utama'
                          : 'Pendukung';
                      return Padding(
                        padding: const EdgeInsets.only(top: 5),
                        child: Row(
                          children: [
                            Icon(
                              ingredient['isDefault'] == true
                                  ? Icons.circle
                                  : Icons.circle_outlined,
                              size: 7,
                              color: ingredient['isDefault'] == true
                                  ? BarajaPalette.forest
                                  : BarajaPalette.honey,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                productName,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: BarajaPalette.muted,
                                ),
                              ),
                            ),
                            Text(
                              '${_formatQuantity(ingredient['quantity'])} ${ingredient['unit'] ?? ''} · $role',
                              style: const TextStyle(
                                fontSize: 11,
                                color: BarajaPalette.ink,
                                fontWeight: FontWeight.w600,
                              ),
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
        },
      ),
    );
  }

  Widget _buildLoadError() {
    final colors = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined, size: 40, color: colors.error),
            const SizedBox(height: 12),
            const Text(
              'Data Baraja Coffee belum bisa dimuat',
              style: TextStyle(fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              _error ?? 'Periksa koneksi dan pengaturan integrasi.',
              style: TextStyle(color: colors.onSurfaceVariant, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Coba lagi'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final recipes = _list(_recipeData?['recipes']);
    final menus = _list(_recipeData?['menus']);
    final recipeMenuIds = recipes
        .map((recipe) {
          final menu = recipe['menuItemId'];
          return menu is Map ? menu['_id']?.toString() : menu?.toString();
        })
        .whereType<String>()
        .toSet();
    final hasMenuWithoutRecipe = menus.any(
      (menu) => !recipeMenuIds.contains(menu['menu_item_id']),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stok & Resep'),
        actions: [
          IconButton(
            tooltip: 'Muat ulang stok dan resep',
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.grain_rounded), text: 'Bahan baku'),
            Tab(icon: Icon(Icons.restaurant_menu_rounded), text: 'Stok menu'),
            Tab(icon: Icon(Icons.menu_book_outlined), text: 'Resep'),
          ],
        ),
      ),
      floatingActionButton:
          _selectedTabIndex == 2 &&
              _canManageRecipes &&
              hasMenuWithoutRecipe &&
              !_isLoading
          ? FloatingActionButton.extended(
              onPressed: () => _openRecipeEditor(),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Buat resep'),
            )
          : null,
      body: _isLoading && _inventory == null
          ? const Center(child: CircularProgressIndicator())
          : _inventory == null || _recipeData == null
          ? _buildLoadError()
          : Column(
              children: [
                if (_error != null)
                  MaterialBanner(
                    content: Text(_error!),
                    leading: const Icon(Icons.warning_amber_rounded),
                    actions: [
                      TextButton(onPressed: _load, child: const Text('Ulangi')),
                    ],
                  ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildIngredientsTab(),
                      _buildMenusTab(),
                      _buildRecipesTab(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _StockTag extends StatelessWidget {
  final String label;

  const _StockTag({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: BarajaPalette.canvas,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: BarajaPalette.muted,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _StatusTag extends StatelessWidget {
  final String label;
  final bool active;

  const _StatusTag({required this.label, required this.active});

  @override
  Widget build(BuildContext context) {
    final color = active ? BarajaPalette.forest : BarajaPalette.muted;
    final background = active ? BarajaPalette.mint : BarajaPalette.canvas;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
