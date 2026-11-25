import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:purchasing_mobile/models/user_model.dart';
import 'package:purchasing_mobile/screens/profile_screen.dart';

void main() {
  testWidgets(
    'profile provides identity, password, and offline history menus',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ProfileScreen(
            user: UserModel(
              id: 'user-1',
              name: 'Baraja User',
              email: 'user@example.com',
              role: 'admin',
            ),
            onUserUpdated: (_) {},
            onLogout: () {},
          ),
        ),
      );

      expect(find.text('Riwayat & antrean offline'), findsOneWidget);
      await tester.tap(find.text('Identitas pribadi'));
      await tester.pumpAndSettle();
      expect(find.text('Email akun'), findsOneWidget);
      expect(find.text('Simpan identitas'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ganti password'));
      await tester.pumpAndSettle();
      expect(find.text('Password saat ini'), findsOneWidget);
      expect(find.text('Ulangi password baru'), findsOneWidget);
    },
  );
}
