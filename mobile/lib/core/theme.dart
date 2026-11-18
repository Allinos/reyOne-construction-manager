import 'package:material_ui/material_ui.dart';

const brand = Color(0xFFF2A900); // amber — primary actions
const brandDark = Color(0xFF4A2700); // dark brown — text on amber, headers
const accent = Color(0xFFCC6E02); // burnt orange — links/active
const cream = Color(0xFFFBF8F1); // warm neutral background

ThemeData buildTheme(Brightness b) {
  final scheme = ColorScheme.fromSeed(seedColor: brand, brightness: b, primary: brand, onPrimary: brandDark, secondary: accent);
  final dark = b == Brightness.dark;
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? const Color(0xFF0F172A) : cream,
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? const Color(0xFF1E293B) : Colors.white,
      foregroundColor: dark ? Colors.white : const Color(0xFF1F2937),
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: dark ? const Color(0xFF1E293B) : Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: dark ? const Color(0xFF334155) : const Color(0xFFECE2CC))),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF1E293B) : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(backgroundColor: brand, foregroundColor: brandDark, textStyle: const TextStyle(fontWeight: FontWeight.w600), minimumSize: const Size(64, 48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(foregroundColor: dark ? brand : accent, minimumSize: const Size(64, 44), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: dark ? brand : accent)),
  );
}
