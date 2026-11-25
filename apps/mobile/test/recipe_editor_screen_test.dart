import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:purchasing_mobile/screens/recipe_editor_screen.dart';

void main() {
  testWidgets('ingredient picker closes cleanly after selecting a product', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: RecipeEditorScreen(
          menus: const [],
          products: [
            {
              'product_id': 'product-1',
              'name': 'Ayam',
              'category': 'Protein',
              'unit': 'kg',
              'sku': 'AYAM-01',
            },
          ],
        ),
      ),
    );

    await tester.scrollUntilVisible(
      find.text('Tambah bahan'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Tambah bahan'));
    await tester.pumpAndSettle();
    expect(find.text('Pilih bahan baku'), findsNWidgets(3));
    expect(find.text('Ayam'), findsOneWidget);

    await tester.tap(find.text('Ayam'));
    await tester.pumpAndSettle();

    expect(find.text('Pilih bahan baku'), findsOneWidget);
    expect(find.text('Ayam'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
