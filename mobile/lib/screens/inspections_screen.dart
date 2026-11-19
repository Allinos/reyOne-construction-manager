import 'dart:convert';

import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/photos.dart';
import '../core/session.dart';
import '../core/widgets.dart';

const _severityColor = {'low': Colors.blueGrey, 'medium': Colors.orange, 'high': Colors.deepOrange, 'critical': Colors.red};
const _statusColor = {'pending': Colors.grey, 'assigned': Colors.blueGrey, 'in_progress': Colors.blue, 'completed': Colors.green, 'follow_up': Colors.orange, 'closed': Colors.brown};
const _statusLabel = {'pending': 'Pending', 'assigned': 'Assigned', 'in_progress': 'In progress', 'completed': 'Completed', 'follow_up': 'Needs follow-up', 'closed': 'Closed'};

class InspectionsScreen extends StatefulWidget {
  const InspectionsScreen({super.key});
  @override
  State<InspectionsScreen> createState() => _InspectionsScreenState();
}

class _InspectionsScreenState extends State<InspectionsScreen> {
  final _key = GlobalKey<AsyncViewState<List<dynamic>>>();
  bool _mine = !Session.I.can('inspections.read');

  Future<void> _create() async {
    final project = await pickProject(context);
    if (project == null || !mounted) return;
    final templates = (await Api.I.get('/inspections/templates') as List).cast<Map<String, dynamic>>();
    if (!mounted) return;
    final title = TextEditingController();
    String? tpl = templates.isNotEmpty ? templates.first['key'] as String : null;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('New inspection · ${project['name']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            TextField(controller: title, decoration: const InputDecoration(labelText: 'Title', hintText: 'e.g. Slab L3 pre-pour')),
            const SizedBox(height: 10),
            DropdownButtonFormField<String?>(
              initialValue: tpl,
              decoration: const InputDecoration(labelText: 'Checklist'),
              items: [
                const DropdownMenuItem(value: null, child: Text('Blank')),
                for (final t in templates) DropdownMenuItem(value: t['key'] as String, child: Text('${t['name']}')),
              ],
              onChanged: (v) => set(() => tpl = v),
            ),
            const SizedBox(height: 14),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Start')),
          ]),
        ),
      ),
    );
    if (ok != true || title.text.trim().isEmpty || !mounted) return;
    try {
      final row = await Api.I.post('/inspections', {'projectId': project['id'], 'title': title.text.trim(), 'templateKey': ?tpl, 'date': DateTime.now().toIso8601String().substring(0, 10)});
      if (!mounted) return;
      await Navigator.push(context, MaterialPageRoute(builder: (_) => InspectionDetailScreen(id: row['id'] as int)));
      _key.currentState?.reload();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Site Inspection')),
      floatingActionButton: Session.I.can('inspections.manage') ? FloatingActionButton.extended(onPressed: _create, icon: const Icon(Icons.add), label: const Text('Inspect')) : null,
      body: AsyncView<List<dynamic>>(
        key: _key,
        load: () async => await Api.I.get('/inspections', query: {if (_mine) 'mine': 'true'}) as List,
        builder: (context, list, reload) => ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
                itemCount: list.length + 1,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  if (i == 0) {
                    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (Session.I.can('inspections.read'))
                        SegmentedButton<bool>(
                          segments: const [ButtonSegment(value: true, label: Text('Assigned to me')), ButtonSegment(value: false, label: Text('All'))],
                          selected: {_mine},
                          onSelectionChanged: (s) {
                            setState(() => _mine = s.first);
                            _key.currentState?.reload();
                          },
                        ),
                      if (list.isEmpty) const Padding(padding: EdgeInsets.only(top: 40), child: EmptyView('No inspections here', icon: Icons.fact_check_outlined)),
                    ]);
                  }
                  final r = list[i - 1] as Map<String, dynamic>;
                  final pct = r['score']?['pct'];
                  return Card(
                    child: ListTile(
                      title: Text('${r['title']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${r['projectName']} · ${r['answered'] ?? 0}/${r['checklistCount'] ?? 0} checked${r['dueDate'] != null ? ' · due ${fmtDate(r['dueDate'])}' : ''}${r['overdue'] == true ? ' · OVERDUE' : ''}${(r['openIssues'] ?? 0) > 0 ? '\n${r['openIssues']} open issue(s)' : ''}'),
                      isThreeLine: (r['openIssues'] ?? 0) > 0,
                      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Chip2(_statusLabel['${r['status']}'] ?? label('${r['status']}'), color: _statusColor['${r['status']}'] ?? Colors.grey),
                        if (pct != null) Text('$pct%', style: TextStyle(fontWeight: FontWeight.w700, color: pct >= 85 ? Colors.green : pct >= 60 ? Colors.orange : Colors.red)),
                      ]),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => InspectionDetailScreen(id: r['id'] as int))).then((_) => reload()),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class InspectionDetailScreen extends StatefulWidget {
  const InspectionDetailScreen({super.key, required this.id});
  final int id;
  @override
  State<InspectionDetailScreen> createState() => _InspectionDetailScreenState();
}

class _InspectionDetailScreenState extends State<InspectionDetailScreen> {
  Map<String, dynamic>? _d;
  List<Map<String, dynamic>> _checklist = [];
  List<dynamic> _photos = [];
  List<dynamic> _users = [];
  bool _dirty = false;
  String? _error;

  bool get _isInspector => _d?['isInspector'] == true;
  bool get _canManage => Session.I.can('inspections.manage');
  bool get _editable => (_canManage || _isInspector) && (_d?['status'] == 'assigned' || _d?['status'] == 'in_progress');
  final _notes = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    Api.I.get('/users/directory').then((u) => mounted ? setState(() => _users = u as List) : null).catchError((_) => null);
  }

  Future<void> _load() async {
    try {
      final d = await Api.I.get('/inspections/${widget.id}') as Map<String, dynamic>;
      final photos = await listPhotos('inspection', widget.id);
      if (!mounted) return;
      setState(() {
        _d = d;
        _checklist = (d['checklist'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _notes.text = '${d['remarks'] ?? ''}';
        _photos = photos;
        _dirty = false;
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _save() async {
    if (await guard(context, () => Api.I.patch('/inspections/${widget.id}', {'checklist': _checklist, 'remarks': _notes.text.trim().isEmpty ? null : _notes.text.trim()}), success: 'Progress saved')) _load();
  }

  Future<void> _complete() async {
    final left = _checklist.where((c) => '${c['result'] ?? ''}'.isEmpty).length;
    if (left > 0) {
      toast(context, 'Mark every checklist item first ($left left)', error: true);
      return;
    }
    if (await guard(context, () async {
      await Api.I.patch('/inspections/${widget.id}', {'checklist': _checklist, 'remarks': _notes.text.trim().isEmpty ? null : _notes.text.trim()});
      await Api.I.patch('/inspections/${widget.id}', {'status': 'completed'});
    }, success: 'Inspection submitted — items marked Fail/Action go to follow-up')) {
      _load();
    }
  }

  Future<void> _addPhoto(bool camera) async {
    await guard(context, () async {
      final n = await pickAndUpload(entityType: 'inspection', entityId: widget.id, camera: camera);
      if (n == 0) return;
    }, success: 'Photo uploaded');
    _load();
  }

  Future<void> _addIssue() async {
    final desc = TextEditingController();
    final action = TextEditingController();
    var severity = 'medium';
    int? assignee;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Record issue', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            TextField(controller: desc, maxLines: 3, decoration: const InputDecoration(labelText: 'Issue')),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: severity,
              decoration: const InputDecoration(labelText: 'Severity'),
              items: [for (final s in _severityColor.keys) DropdownMenuItem(value: s, child: Text(label(s)))],
              onChanged: (v) => set(() => severity = v ?? 'medium'),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<int?>(
              initialValue: assignee,
              decoration: const InputDecoration(labelText: 'Assign to'),
              items: [
                const DropdownMenuItem(value: null, child: Text('Unassigned')),
                for (final u in _users) DropdownMenuItem(value: u['id'] as int, child: Text('${u['name']}')),
              ],
              onChanged: (v) => set(() => assignee = v),
            ),
            const SizedBox(height: 10),
            TextField(controller: action, maxLines: 2, decoration: const InputDecoration(labelText: 'Corrective action required')),
            const SizedBox(height: 14),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add issue')),
          ]),
        ),
      ),
    );
    if (ok != true || desc.text.trim().isEmpty || !mounted) return;
    if (await guard(context, () => Api.I.post('/inspections/${widget.id}/issues', {
          'description': desc.text.trim(),
          'severity': severity,
          'assignedToId': assignee,
          if (action.text.trim().isNotEmpty) 'correctiveAction': action.text.trim(),
        }), success: 'Issue recorded')) {
      _load();
    }
  }

  Future<void> _issueStatus(Map issue, String status) async {
    if (await guard(context, () => Api.I.patch('/inspections/issues/${issue['id']}', {'status': status}))) _load();
  }

  Future<void> _close() async {
    if (_dirty) await Api.I.patch('/inspections/${widget.id}', {'checklist': _checklist, 'remarks': _notes.text.trim().isEmpty ? null : _notes.text.trim()});
    if (!mounted) return;
    if (await guard(context, () => Api.I.patch('/inspections/${widget.id}', {'status': 'closed'}), success: 'Inspection closed')) _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Scaffold(appBar: AppBar(), body: ErrorView(message: _error!, onRetry: _load));
    final d = _d;
    if (d == null) return Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator()));
    final issues = (d['issues'] as List).cast<Map<String, dynamic>>();
    return Scaffold(
      appBar: AppBar(title: Text('${d['title']}'), actions: [
        if (_canManage && (d['status'] == 'completed' || d['status'] == 'follow_up')) TextButton(onPressed: _close, child: const Text('Close')),
      ]),
      bottomNavigationBar: _editable
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
                child: Row(children: [
                  Expanded(child: OutlinedButton(onPressed: _dirty ? _save : null, child: const Text('Save progress'))),
                  const SizedBox(width: 10),
                  Expanded(child: FilledButton.icon(onPressed: _complete, icon: const Icon(Icons.check), label: const Text('Mark completed'))),
                ]),
              ),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.fromLTRB(12, 12, 12, 90), children: [
          Text('${d['projectName']} · ${fmtDate(d['date'])}${d['inspectorName'] != null ? ' · Inspector: ${d['inspectorName']}' : ''}${d['dueDate'] != null ? ' · due ${fmtDate(d['dueDate'])}' : ''}', style: const TextStyle(color: Colors.grey)),
          if ('${d['instructions'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 10),
            Card(
              color: Colors.blue.withValues(alpha: 0.08),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('WHAT TO INSPECT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.blue)),
                  const SizedBox(height: 4),
                  Text('${d['instructions']}'),
                ]),
              ),
            ),
          ],
          if (d['completedAt'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Completed ${fmtDate(d['completedAt'])}${d['completedByName'] != null ? ' by ${d['completedByName']}' : ''}', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w600))),
          SectionTitle('Checklist · ${_checklist.where((c) => '${c['result'] ?? ''}'.isNotEmpty).length}/${_checklist.length}', trailing: Chip2(_statusLabel['${d['status']}'] ?? label('${d['status']}'), color: _statusColor['${d['status']}'] ?? Colors.grey)),
          Card(
            child: Column(children: [
              for (var i = 0; i < _checklist.length; i++)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${i + 1}. ${_checklist[i]['item']}', style: const TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(height: 6),
                    SegmentedButton<String>(
                      emptySelectionAllowed: true,
                      showSelectedIcon: false,
                      segments: const [
                        ButtonSegment(value: 'pass', label: Text('Pass')),
                        ButtonSegment(value: 'fail', label: Text('Fail')),
                        ButtonSegment(value: 'action', label: Text('Action')),
                        ButtonSegment(value: 'na', label: Text('N/A')),
                      ],
                      selected: {if ((_checklist[i]['result'] ?? '') != '') '${_checklist[i]['result']}'},
                      onSelectionChanged: _editable
                          ? (s) => setState(() {
                                _checklist[i]['result'] = s.isEmpty ? '' : s.first;
                                _dirty = true;
                              })
                          : null,
                    ),
                  ]),
                ),
              if (_checklist.isEmpty) const ListTile(title: Text('No checklist items', style: TextStyle(color: Colors.grey))),
            ]),
          ),
          SectionTitle('Notes'),
          TextField(
            controller: _notes,
            enabled: _editable,
            maxLines: 3,
            decoration: const InputDecoration(hintText: 'Observations, measurements, people present…'),
            onChanged: (_) => setState(() => _dirty = true),
          ),
          SectionTitle('Photos (${_photos.length})', trailing: (_canManage || _isInspector) && d['status'] != 'closed'
              ? Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(tooltip: 'Camera', icon: const Icon(Icons.photo_camera), onPressed: () => _addPhoto(true)),
                  IconButton(tooltip: 'Gallery', icon: const Icon(Icons.photo_library_outlined), onPressed: () => _addPhoto(false)),
                ])
              : null),
          if (_photos.isEmpty)
            const Text('  No photos yet', style: TextStyle(color: Colors.grey))
          else
            SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _photos.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final data = '${_photos[i]['data']}';
                  final b64 = data.contains(',') ? data.split(',').last : data;
                  final taken = _photos[i]['takenAt'];
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Stack(children: [
                      Image.memory(base64Decode(b64), width: 96, height: 96, fit: BoxFit.cover),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Container(
                          color: Colors.black54,
                          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                          child: Text(taken != null ? '📷 ${fmtDate(taken)}' : '↑ ${fmtDate(_photos[i]['createdAt'])}', style: const TextStyle(color: Colors.white, fontSize: 9), overflow: TextOverflow.ellipsis),
                        ),
                      ),
                    ]),
                  );
                },
              ),
            ),
          SectionTitle('Issues (${issues.length})', trailing: (_canManage || _isInspector) && d['status'] != 'closed' ? TextButton.icon(onPressed: _addIssue, icon: const Icon(Icons.add), label: const Text('Issue')) : null),
          for (final is_ in issues)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Card(
                child: ListTile(
                  leading: Icon(Icons.report_problem, color: _severityColor['${is_['severity']}'] ?? Colors.grey),
                  title: Text('${is_['description']}'),
                  subtitle: Text('${is_['assignedToName'] ?? 'Unassigned'}${is_['dueDate'] != null ? ' · due ${fmtDate(is_['dueDate'])}' : ''}'),
                  trailing: PopupMenuButton<String>(
                    enabled: Session.I.can('inspections.manage'),
                    onSelected: (s) => _issueStatus(is_, s),
                    itemBuilder: (_) => [for (final s in ['open', 'in_progress', 'resolved', 'verified']) PopupMenuItem(value: s, child: Text(label(s)))],
                    child: Chip2(label('${is_['status']}'), color: statusColor('${is_['status']}')),
                  ),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

/// Issues assigned to me — anyone can see and resolve their own.
class MyIssuesScreen extends StatelessWidget {
  const MyIssuesScreen({super.key});

  Future<void> _resolve(BuildContext context, Map issue, Future<void> Function() reload) async {
    final note = TextEditingController(text: '${issue['correctiveAction'] ?? ''}');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Mark resolved'),
        content: TextField(controller: note, maxLines: 3, decoration: const InputDecoration(labelText: 'What was done?')),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Resolve'))],
      ),
    );
    if (ok != true || !context.mounted) return;
    if (await guard(context, () => Api.I.patch('/inspections/issues/${issue['id']}', {'status': 'resolved', 'correctiveAction': note.text.trim().isEmpty ? null : note.text.trim()}), success: 'Resolved — inspector notified')) {
      reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Issues')),
      body: AsyncView<List<dynamic>>(
        load: () async => await Api.I.get('/inspections/issues', query: {'mine': 'true', 'status': 'open'}) as List,
        builder: (context, list, reload) => list.isEmpty
            ? const EmptyView('No open issues assigned to you', icon: Icons.check_circle_outline)
            : ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final is_ = list[i] as Map<String, dynamic>;
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Chip2(label('${is_['severity']}').toUpperCase(), color: _severityColor['${is_['severity']}'] ?? Colors.grey),
                          const SizedBox(width: 8),
                          Expanded(child: Text('${is_['projectName']} · ${is_['inspection']?['title'] ?? ''}', style: const TextStyle(fontSize: 12, color: Colors.grey), overflow: TextOverflow.ellipsis)),
                        ]),
                        const SizedBox(height: 8),
                        Text('${is_['description']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        if (is_['correctiveAction'] != null) Text('Action: ${is_['correctiveAction']}', style: const TextStyle(fontSize: 13)),
                        if (is_['dueDate'] != null) Text('Due ${fmtDate(is_['dueDate'])}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                        const SizedBox(height: 10),
                        Row(children: [
                          if (is_['status'] == 'open')
                            OutlinedButton(onPressed: () async {
                              if (await guard(context, () => Api.I.patch('/inspections/issues/${is_['id']}', {'status': 'in_progress'}))) reload();
                            }, child: const Text('Start')),
                          const SizedBox(width: 8),
                          Expanded(child: FilledButton(onPressed: () => _resolve(context, is_, reload), child: const Text('Mark resolved'))),
                        ]),
                      ]),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
