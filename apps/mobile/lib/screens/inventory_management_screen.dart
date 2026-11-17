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
  bool _isLoading = true;
  Map<String, dynamic>? _inventory;
  Map<String, dynamic>? _recipeData;
  String? _error;
  int _selectedTabIndex = 0;

  bool get _canManageRecipes => const {'admin', 'management', 'leader'}
      .contains(widget.user.role.toLowerCase());

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
    if (response is Map && response['success'] == true && response['data'] is Map) {
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
          return menu is Map
              ? menu['_id']?.toString()
              : menu?.toString();
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

  Widget _infoCard({
    required IconData icon,
    required String text,
  }) {
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
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
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

  Widget _buildIngredientsTab() {
    final ingredients = _list(_inventory?['ingredients']);
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
        itemCount: ingredients.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _infoCard(
              icon: Icons.sync_rounded,
              text:
                  'Stok mengikuti penerimaan yang sudah diposting di Baraja Coffee. Penjualan dan waste akan mengurangi saldo di gudang terkait.',
            );
          }
          final item = ingredients[index - 1];
          final warehouses = _list(item['warehouses']);
          final unit = item['unit']?.toString() ?? '';
          final quantity = _formatQuantity(item['current_stock']);
          final isLow = (item['current_stock'] as num? ?? 0) <=
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
        itemCount: menus.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _infoCard(
              icon: Icons.calculate_outlined,
              text:
                  'Jumlah porsi dihitung dari stok bahan utama resep. Jika bahan utama habis, menu nonaktif; bahan pendukung tidak menjadi batas stok menu.',
            );
          }
          final menu = menus[index - 1];
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
        itemCount: recipes.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == 0) {
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
          final recipe = recipes[index - 1];
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
              style: TextStyle(
                color: colors.onSurfaceVariant,
                fontSize: 12,
              ),
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
    final recipeMenuIds = recipes.map((recipe) {
      final menu = recipe['menuItemId'];
      return menu is Map ? menu['_id']?.toString() : menu?.toString();
    }).whereType<String>().toSet();
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
      floatingActionButton: _selectedTabIndex == 2 &&
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
