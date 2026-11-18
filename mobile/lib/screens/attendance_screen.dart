import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/widgets.dart';

const _opts = [
  ('present', 'P', Colors.green),
  ('half_day', 'H', Colors.orange),
  ('absent', 'A', Colors.red),
  ('leave', 'L', Colors.blue),
];

/// Daily attendance sheet for employees and labour — big tap targets for site use.
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  DateTime _date = DateTime.now();
  String _type = '';
  Map<String, dynamic>? _project;
  List<Map<String, dynamic>> _rows = [];
  final Map<String, String> _edits = {};
  bool _loading = true;
  bool _saving = false;
  String _search = '';
  String? _error;

  bool get _canMark => Session.I.can('attendance.mark');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final d = await Api.I.get('/attendance/day', query: {'date': isoDay(_date), 'type': _type}) as Map<String, dynamic>;
      setState(() {
        _rows = (d['rows'] as List).cast<Map<String, dynamic>>();
        _edits.clear();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _status(Map r) => _edits[r['key']] ?? (r['status'] as String? ?? '');

  Future<void> _save() async {
    setState(() => _saving = true);
    final byKey = {for (final r in _rows) r['key']: r};
    final ok = await guard(context, () async {
      await Api.I.put('/attendance/day', {
        'date': isoDay(_date),
        if (_project != null) 'projectId': _project!['id'],
        'entries': [
          for (final e in _edits.entries) {'personType': byKey[e.key]!['personType'], 'personId': byKey[e.key]!['personId'], 'status': e.value},
        ],
      });
    }, success: 'Attendance saved');
    if (mounted) setState(() => _saving = false);
    if (ok) _load();
  }

  @override
  Widget build(BuildContext context) {
    final list = _rows.where((r) => _search.isEmpty || '${r['name']}'.toLowerCase().contains(_search.toLowerCase())).toList();
    final counts = {for (final o in _opts) o.$1: _rows.where((r) => _status(r) == o.$1).length};
    final unmarked = _rows.where((r) => _status(r).isEmpty).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance'), actions: [
        if (_canMark)
          TextButton(
            onPressed: _rows.isEmpty
                ? null
                : () => setState(() {
                      for (final r in list) {
                        _edits[r['key'] as String] = 'present';
                      }
                    }),
            child: const Text('All present'),
          ),
      ]),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          child: Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.calendar_today, size: 18),
                label: Text(fmtDate(_date.toIso8601String())),
                onPressed: () async {
                  final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
                  if (d != null) {
                    setState(() => _date = d);
                    _load();
                  }
                },
              ),
            ),
            const SizedBox(width: 8),
            DropdownButton<String>(
              value: _type,
              items: const [
                DropdownMenuItem(value: '', child: Text('All')),
                DropdownMenuItem(value: 'USER', child: Text('Employees')),
                DropdownMenuItem(value: 'WORKFORCE', child: Text('Labour')),
              ],
              onChanged: (v) {
                setState(() => _type = v ?? '');
                _load();
              },
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(hintText: 'Search name', prefixIcon: Icon(Icons.search), isDense: true),
                onChanged: (v) => setState(() => _search = v),
              ),
            ),
            const SizedBox(width: 8),
            ActionChip(
              avatar: const Icon(Icons.location_on_outlined, size: 18),
              label: Text(_project == null ? 'Site' : '${_project!['name']}', overflow: TextOverflow.ellipsis),
              onPressed: () async {
                final p = await pickProject(context);
                if (p != null) setState(() => _project = p);
              },
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Wrap(spacing: 6, runSpacing: 6, children: [
            for (final o in _opts) Chip2('${label(o.$1)}: ${counts[o.$1]}', color: o.$3),
            Chip2('Unmarked: $unmarked'),
          ]),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? ErrorView(message: _error!, onRetry: _load)
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: list.isEmpty
                          ? const EmptyView('No people found')
                          : ListView.separated(
                              padding: const EdgeInsets.only(bottom: 90),
                              itemCount: list.length,
                              separatorBuilder: (_, _) => const Divider(height: 1),
                              itemBuilder: (_, i) {
                                final r = list[i];
                                final st = _status(r);
                                final changed = _edits.containsKey(r['key']);
                                return Container(
                                  color: changed ? Colors.orange.withValues(alpha: 0.06) : null,
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  child: Row(children: [
                                    Expanded(
                                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text('${r['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                                        Text('${r['group']}${(r['detail'] ?? '') != '' ? ' · ${r['detail']}' : ''}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                      ]),
                                    ),
                                    for (final o in _opts)
                                      Padding(
                                        padding: const EdgeInsets.only(left: 4),
                                        child: SizedBox(
                                          width: 42,
                                          height: 42,
                                          child: OutlinedButton(
                                            style: OutlinedButton.styleFrom(
                                              padding: EdgeInsets.zero,
                                              minimumSize: const Size(42, 42),
                                              backgroundColor: st == o.$1 ? o.$3 : null,
                                              foregroundColor: st == o.$1 ? Colors.white : o.$3,
                                              side: BorderSide(color: st == o.$1 ? o.$3 : Colors.grey.shade300),
                                            ),
                                            onPressed: _canMark ? () => setState(() => _edits[r['key'] as String] = st == o.$1 ? '' : o.$1) : null,
                                            child: Text(o.$2, style: const TextStyle(fontWeight: FontWeight.w800)),
                                          ),
                                        ),
                                      ),
                                  ]),
                                );
                              },
                            ),
                    ),
        ),
      ]),
      floatingActionButton: _edits.isEmpty
          ? null
          : FloatingActionButton.extended(
              onPressed: _saving ? null : _save,
              icon: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save),
              label: Text('Save ${_edits.length}'),
            ),
    );
  }
}
