import 'package:flutter/material.dart';

abstract final class BarajaPalette {
  static const forest = Color(0xFF195B47);
  static const forestDeep = Color(0xFF123F34);
  static const mint = Color(0xFFE8F1EB);
  static const canvas = Color(0xFFF5F7F3);
  static const ink = Color(0xFF1E2D27);
  static const muted = Color(0xFF718078);
  static const outline = Color(0xFFE2E9E3);
  static const honey = Color(0xFFC28A52);
  static const danger = Color(0xFFB84C43);
}

abstract final class BarajaTheme {
  static ThemeData get light {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: BarajaPalette.forest,
      onPrimary: Colors.white,
      secondary: BarajaPalette.honey,
      onSecondary: Colors.white,
      error: BarajaPalette.danger,
      onError: Colors.white,
      surface: Colors.white,
      onSurface: BarajaPalette.ink,
      surfaceContainerHighest: BarajaPalette.canvas,
      onSurfaceVariant: BarajaPalette.muted,
      outline: BarajaPalette.outline,
      outlineVariant: BarajaPalette.outline,
      shadow: Color(0x1A123F34),
      scrim: Color(0x66000000),
      inverseSurface: BarajaPalette.ink,
      onInverseSurface: Colors.white,
      inversePrimary: Color(0xFF9BC8B3),
      surfaceTint: BarajaPalette.forest,
      tertiary: Color(0xFF7C6A48),
      onTertiary: Colors.white,
      tertiaryContainer: Color(0xFFF3E8D8),
      onTertiaryContainer: Color(0xFF49351E),
      primaryContainer: BarajaPalette.mint,
      onPrimaryContainer: BarajaPalette.forestDeep,
      secondaryContainer: Color(0xFFF5E9DC),
      onSecondaryContainer: Color(0xFF57391F),
      errorContainer: Color(0xFFFCE9E6),
      onErrorContainer: Color(0xFF6D201B),
      surfaceContainerLow: Color(0xFFFAFBF8),
      surfaceContainer: Color(0xFFF0F4EF),
      surfaceContainerHigh: Color(0xFFEAF0EA),
      surfaceContainerLowest: Colors.white,
      surfaceBright: Colors.white,
      surfaceDim: Color(0xFFE5EAE4),
    );
    final textTheme = Typography.material2021().black.apply(
      bodyColor: BarajaPalette.ink,
      displayColor: BarajaPalette.ink,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: BarajaPalette.canvas,
      textTheme: textTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: BarajaPalette.canvas,
        foregroundColor: BarajaPalette.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: BarajaPalette.ink,
          fontSize: 19,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: BarajaPalette.outline),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 15,
        ),
        hintStyle: const TextStyle(color: BarajaPalette.muted, fontSize: 14),
        labelStyle: const TextStyle(color: BarajaPalette.muted),
        prefixIconColor: BarajaPalette.muted,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BarajaPalette.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BarajaPalette.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BarajaPalette.forest, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BarajaPalette.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BarajaPalette.danger, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 50),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(0, 50),
          elevation: 0,
          backgroundColor: BarajaPalette.forest,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 48),
          foregroundColor: BarajaPalette.forest,
          side: const BorderSide(color: BarajaPalette.outline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: BarajaPalette.forest,
        unselectedLabelColor: BarajaPalette.muted,
        indicatorColor: BarajaPalette.forest,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: BarajaPalette.outline,
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        unselectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 13,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: Colors.white,
        indicatorColor: BarajaPalette.mint,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          return TextStyle(
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? BarajaPalette.forest
                : BarajaPalette.muted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          return IconThemeData(
            color: states.contains(WidgetState.selected)
                ? BarajaPalette.forest
                : BarajaPalette.muted,
          );
        }),
      ),
      navigationRailTheme: const NavigationRailThemeData(
        backgroundColor: Colors.white,
        indicatorColor: BarajaPalette.mint,
        selectedIconTheme: IconThemeData(color: BarajaPalette.forest),
        unselectedIconTheme: IconThemeData(color: BarajaPalette.muted),
        selectedLabelTextStyle: TextStyle(
          color: BarajaPalette.forest,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelTextStyle: TextStyle(color: BarajaPalette.muted),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: BarajaPalette.ink,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      dividerTheme: const DividerThemeData(
        color: BarajaPalette.outline,
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: BarajaPalette.forest,
        linearTrackColor: BarajaPalette.mint,
      ),
    );
  }
}
