import 'package:material_ui/material_ui.dart';

// "Warm Site" palette — matches the web app.
const brand = Color(0xFFF2A900); // amber — primary actions
const brandDark = Color(0xFF4A2700); // dark brown — text on amber, hero cards
const accent = Color(0xFFCC6E02); // burnt orange — links/active
const cream = Color(0xFFF7F4EE); // warm neutral background
const ink = Color(0xFF1F1408); // primary text
const ink2 = Color(0xFF5B4B3A); // secondary text
const muted = Color(0xFF9A8B78); // hints, captions
const line = Color(0xFFECE6DA); // borders
const ok = Color(0xFF15803D);
const bad = Color(0xFFC2410C);

// Dark-mode surfaces (warm, not blue-grey).
const _darkBg = Color(0xFF14100B);
const _darkSurface = Color(0xFF1D1812);
const _darkLine = Color(0xFF3A3026);

ThemeData buildTheme(Brightness b) {
  final dark = b == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: brand,
    brightness: b,
    primary: brand,
    onPrimary: brandDark,
    secondary: accent,
    error: bad,
    surface: dark ? _darkSurface : Colors.white,
    onSurface: dark ? const Color(0xFFF5EEE3) : ink,
    onSurfaceVariant: dark ? const Color(0xFFCDBFAE) : ink2,
    outline: dark ? _darkLine : const Color(0xFFE2D9C8),
    outlineVariant: dark ? _darkLine : line,
  );
  final radius12 = BorderRadius.circular(12);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? _darkBg : cream,
    dividerColor: dark ? _darkLine : line,
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? _darkBg : cream,
      foregroundColor: dark ? Colors.white : ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: dark ? Colors.white : ink),
    ),
    cardTheme: CardThemeData(
      color: dark ? _darkSurface : Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: dark ? _darkLine : line)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? _darkSurface : Colors.white,
      indicatorColor: brand.withValues(alpha: 0.18),
      surfaceTintColor: Colors.transparent,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: s.contains(WidgetState.selected) ? accent : muted)),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? accent : muted)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? _darkSurface : Colors.white,
      border: OutlineInputBorder(borderRadius: radius12, borderSide: BorderSide(color: dark ? _darkLine : const Color(0xFFE2D9C8))),
      enabledBorder: OutlineInputBorder(borderRadius: radius12, borderSide: BorderSide(color: dark ? _darkLine : const Color(0xFFE2D9C8))),
      focusedBorder: OutlineInputBorder(borderRadius: radius12, borderSide: const BorderSide(color: brand, width: 1.6)),
      hintStyle: const TextStyle(color: muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: brand,
        foregroundColor: brandDark,
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        minimumSize: const Size(64, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: dark ? Colors.white : ink,
        side: BorderSide(color: dark ? _darkLine : const Color(0xFFE2D9C8)),
        minimumSize: const Size(64, 46),
        shape: RoundedRectangleBorder(borderRadius: radius12),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(Size(0, 42)),
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
        textStyle: const WidgetStatePropertyAll(TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: dark ? brand : accent)),
    chipTheme: ChipThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)), side: BorderSide.none),
  );
}
