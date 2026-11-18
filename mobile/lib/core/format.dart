import 'package:intl/intl.dart';

import 'session.dart';

String money(dynamic v) {
  final n = v is num ? v : num.tryParse('$v') ?? 0;
  final sym = Session.I.currency == 'INR' ? '₹' : '${Session.I.currency} ';
  return NumberFormat.currency(locale: 'en_IN', symbol: sym, decimalDigits: n % 1 == 0 ? 0 : 2).format(n);
}

String fmtDate(dynamic v) {
  if (v == null || '$v'.isEmpty) return '—';
  final d = DateTime.tryParse('$v');
  return d == null ? '—' : DateFormat('dd MMM yyyy').format(d.toLocal());
}

String fmtDateTime(dynamic v) {
  final d = v == null ? null : DateTime.tryParse('$v');
  return d == null ? '—' : DateFormat('dd MMM, hh:mm a').format(d.toLocal());
}

String isoDay(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

String qty(dynamic v, [String unit = '']) {
  final n = v is num ? v : num.tryParse('$v') ?? 0;
  final s = n % 1 == 0 ? n.toInt().toString() : n.toStringAsFixed(2);
  return unit.isEmpty ? s : '$s $unit';
}
