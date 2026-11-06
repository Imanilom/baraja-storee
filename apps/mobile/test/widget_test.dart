import 'package:flutter_test/flutter_test.dart';
import 'package:purchasing_mobile/main.dart';

void main() {
  testWidgets('PurchasingApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const PurchasingApp());
    expect(find.byType(PurchasingApp), findsOneWidget);
  });
}
