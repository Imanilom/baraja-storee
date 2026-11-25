import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:purchasing_mobile/screens/ingredient_conversion_screen.dart';

void main() {
  testWidgets('conversion screen previews recipe units for selected stock', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: IngredientConversionScreen(
          ingredients: [
            {
              'product_id': 'chicken',
              'name': 'Ayam',
              'sku': 'AYAM-01',
              'unit': 'kg',
              'current_stock': 3,
              'recipe_unit': 'potong',
              'recipe_conversion_factor': 8,
            },
          ],
          recipes: [
            {
              'baseIngredients': [
                {'productId': 'chicken'},
              ],
              'menuItemId': {'name': 'Ayam goreng', 'availableStock': 6},
            },
          ],
        ),
      ),
    );

    await tester.tap(find.text('Ayam'));
    await tester.pumpAndSettle();

    expect(find.text('Jumlah per 1 kg'), findsOneWidget);
    expect(
      find.text('1 kg = 8 potong\nStok tersedia setara dengan 24 potong.'),
      findsOneWidget,
    );
    expect(find.text('Ayam goreng'), findsOneWidget);
    expect(find.text('Simpan konversi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
