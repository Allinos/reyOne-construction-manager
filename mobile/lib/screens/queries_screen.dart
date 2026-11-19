import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/photos.dart';
import '../core/session.dart';
import '../core/widgets.dart';

const _priorityColor = {'low': Colors.blueGrey, 'normal': Colors.blueGrey, 'high': Colors.orange, 'urgent': Colors.red};
const _qStatus = {'open': 'Open', 'assigned': 'Assigned', 'awaiting_response': 'Awaiting response', 'responded': 'Responded', 'resolved': 'Resolved', 'closed': 'Closed'};
const _qColor = {'open': Colors.blueGrey, 'assigned': Colors.blue, 'awaiting_response': Colors.orange, 'responded': Colors.purple, 'resolved': Colors.green, 'closed': Colors.brown};
const _qType = {'rfi': 'RFI', 'clarification': 'Clarification', 'site_issue': 'Site issue', 'design_change': 'Design change', 'approval': 'Approval needed', 'general': 'General'};

class QueriesScreen extends StatefulWidget {
  const QueriesScreen({super.key, this.initialScope = 'all'});
  final String initialScope;
  @override
  State<QueriesScreen> createState() => _QueriesScreenState();
}

class _QueriesScreenState extends State<QueriesScreen> {
  late String _scope = widget.initialScope;
  final _key = GlobalKey<AsyncViewState<List<dynamic>>>();

  Future<void> _create() async {
    final title = TextEditingController();
    final desc = TextEditingController();
    var priority = 'normal';
    var type = 'rfi';
    final location = TextEditingController();
    DateTime? due;
    int? phaseId;
    List<Map<String, dynamic>> phases = [];
    Map<String, dynamic>? project;
    final assignees = <int>{};
    final users = (await Api.I.get('/users/directory') as List).cast<Map<String, dynamic>>();
    if (!mounted) return;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('Raise a query / RFI', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Type'),
                items: [for (final e in _qType.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                onChanged: (v) => set(() => type = v ?? 'rfi'),
              ),
              const SizedBox(height: 10),
              TextField(controller: title, decoration: const InputDecoration(labelText: 'Subject')),
              const SizedBox(height: 10),
              TextField(controller: desc, maxLines: 3, decoration: const InputDecoration(labelText: 'Details')),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                icon: const Icon(Icons.apartment),
                label: Text(project == null ? 'Project / site (optional)' : '${project!['name']}'),
                onPressed: () async {
                  final p = await pickProject(ctx);
                  List<Map<String, dynamic>> ph = [];
                  if (p != null) {
                    try {
                      ph = (((await Api.I.get('/projects/${p['id']}')) as Map)['phases'] as List).cast<Map<String, dynamic>>();
                    } catch (_) {}
                  }
                  set(() {
                    project = p;
                    phases = ph;
                    phaseId = null;
                  });
                },
              ),
              if (phases.isNotEmpty) ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<int?>(
                  initialValue: phaseId,
                  decoration: const InputDecoration(labelText: 'Stage'),
                  items: [const DropdownMenuItem(value: null, child: Text('Whole project')), for (final ph in phases) DropdownMenuItem(value: ph['id'] as int, child: Text('${ph['name']}'))],
                  onChanged: (v) => set(() => phaseId = v),
                ),
              ],
              const SizedBox(height: 10),
              TextField(controller: location, decoration: const InputDecoration(labelText: 'Location (block / floor / grid)')),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                icon: const Icon(Icons.event),
                label: Text(due == null ? 'Response needed by (optional)' : 'Needed by ${fmtDate(due!.toIso8601String())}'),
                onPressed: () async {
                  final d = await showDatePicker(context: ctx, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: DateTime.now().add(const Duration(days: 2)));
                  if (d != null) set(() => due = d);
                },
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: priority,
                decoration: const InputDecoration(labelText: 'Priority'),
                items: [for (final p in _priorityColor.keys) DropdownMenuItem(value: p, child: Text(label(p)))],
                onChanged: (v) => set(() => priority = v ?? 'normal'),
              ),
              const SizedBox(height: 10),
              const Text('Assign to', style: TextStyle(fontWeight: FontWeight.w600)),
              Wrap(spacing: 6, children: [
                for (final u in users)
                  FilterChip(
                    label: Text('${u['name']}'),
                    selected: assignees.contains(u['id']),
                    onSelected: (v) => set(() => v ? assignees.add(u['id'] as int) : assignees.remove(u['id'])),
                  ),
              ]),
              const SizedBox(height: 14),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit')),
            ]),
          ),
        ),
      ),
    );
    if (ok != true || title.text.trim().isEmpty || !mounted) return;
    try {
      final q = await Api.I.post('/queries', {
        'title': title.text.trim(),
        if (desc.text.trim().isNotEmpty) 'description': desc.text.trim(),
        'priority': priority,
        'type': type,
        'projectId': project?['id'],
        'phaseId': ?phaseId,
        if (location.text.trim().isNotEmpty) 'location': location.text.trim(),
        if (due != null) 'dueDate': due!.toIso8601String().substring(0, 10),
        'assigneeIds': assignees.toList(),
      });
      if (!mounted) return;
      toast(context, 'Query raised');
      await Navigator.push(context, MaterialPageRoute(builder: (_) => QueryDetailScreen(id: q['id'] as int)));
      _key.currentState?.reload();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Queries')),
      floatingActionButton: Session.I.can('queries.create') ? FloatingActionButton.extended(onPressed: _create, icon: const Icon(Icons.add_comment_outlined), label: const Text('Ask')) : null,
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'mine', label: Text('Mine')),
              ButtonSegment(value: 'assigned', label: Text('To answer')),
              ButtonSegment(value: 'all', label: Text('All')),
            ],
            selected: {_scope},
            onSelectionChanged: (s) => setState(() => _scope = s.first),
          ),
        ),
        Expanded(
          child: AsyncView<List<dynamic>>(
            key: ValueKey(_scope),
            load: () async => await Api.I.get('/queries', query: {'scope': _scope, 'status': 'active'}) as List,
            builder: (context, list, reload) => list.isEmpty
                ? const EmptyView('No open queries', icon: Icons.forum_outlined)
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 90),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final q = list[i] as Map<String, dynamic>;
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(radius: 6, backgroundColor: _priorityColor['${q['priority']}'] ?? Colors.grey),
                          title: Text('${q['title']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text('${q['ref']} · ${q['projectName'] ?? 'General'}${q['phaseName'] != null ? ' › ${q['phaseName']}' : ''}${q['dueDate'] != null ? '\nDue ${fmtDate(q['dueDate'])}${q['overdue'] == true ? ' · OVERDUE' : ''}' : ''}'),
                          isThreeLine: q['dueDate'] != null,
                          trailing: Chip2(_qStatus['${q['status']}'] ?? label('${q['status']}'), color: _qColor['${q['status']}'] ?? Colors.grey),
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => QueryDetailScreen(id: q['id'] as int))).then((_) => reload()),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ]),
    );
  }
}

class QueryDetailScreen extends StatefulWidget {
  const QueryDetailScreen({super.key, required this.id});
  final int id;
  @override
  State<QueryDetailScreen> createState() => _QueryDetailScreenState();
}

class _QueryDetailScreenState extends State<QueryDetailScreen> {
  final _key = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  final _msg = TextEditingController();
  bool _sending = false;

  Future<void> _send() async {
    if (_msg.text.trim().isEmpty) return;
    setState(() => _sending = true);
    if (await guard(context, () => Api.I.post('/queries/${widget.id}/replies', {'message': _msg.text.trim()}))) {
      _msg.clear();
      _key.currentState?.reload();
    }
    if (mounted) setState(() => _sending = false);
  }

  Future<void> _resolve(String suggestion) async {
    final c = TextEditingController(text: suggestion);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Resolve query'),
        content: TextField(controller: c, maxLines: 4, decoration: const InputDecoration(labelText: 'Resolution / decision')),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Resolve'))],
      ),
    );
    if (ok != true || !mounted) return;
    if (await guard(context, () => Api.I.post('/queries/${widget.id}/resolve', {'resolution': c.text.trim()}), success: 'Resolved')) _key.currentState?.reload();
  }

  Future<void> _state(String action) async {
    if (await guard(context, () => Api.I.post('/queries/${widget.id}/$action', {}), success: action == 'close' ? 'Closed' : 'Reopened')) _key.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Query'), actions: [
        IconButton(
          tooltip: 'Attach photo',
          icon: const Icon(Icons.add_a_photo_outlined),
          onPressed: () async {
            await guard(context, () async => pickAndUpload(entityType: 'query', entityId: widget.id), success: 'Photo attached');
            _key.currentState?.reload();
          },
        ),
      ]),
      body: AsyncView<Map<String, dynamic>>(
        key: _key,
        load: () async => await Api.I.get('/queries/${widget.id}') as Map<String, dynamic>,
        builder: (context, q, reload) {
          final replies = (q['replies'] as List).cast<Map<String, dynamic>>();
          final me = Session.I.userId;
          final isAssignee = q['isAssignee'] == true;
          final canManage = q['canManage'] == true;
          final active = !['resolved', 'closed'].contains(q['status']);
          final lastResponse = replies.lastWhere((r) => r['kind'] == 'response', orElse: () => <String, dynamic>{});
          return Column(children: [
            Expanded(
              child: ListView(padding: const EdgeInsets.all(12), children: [
                Text('${q['title']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text('${q['ref']} · ${_qType['${q['type']}'] ?? q['type']}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 4),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  Chip2(_qStatus['${q['status']}'] ?? label('${q['status']}'), color: _qColor['${q['status']}'] ?? Colors.grey),
                  Chip2(label('${q['priority']}'), color: _priorityColor['${q['priority']}'] ?? Colors.grey),
                  if (q['projectName'] != null) Chip2('${q['projectName']}${q['phaseName'] != null ? ' › ${q['phaseName']}' : ''}'),
                  if (q['dueDate'] != null) Chip2('Due ${fmtDate(q['dueDate'])}', color: q['overdue'] == true ? Colors.red : Colors.blueGrey),
                ]),
                if (q['location'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('📍 ${q['location']}${q['workItem'] != null ? ' · ${q['workItem']}' : ''}', style: const TextStyle(fontSize: 12))),
                const SizedBox(height: 6),
                Text('by ${q['createdByName']} · ${fmtDateTime(q['createdAt'])}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                if ((q['assignees'] as List).isNotEmpty) Text('Assigned: ${(q['assignees'] as List).map((a) => a['name']).join(', ')}', style: const TextStyle(fontSize: 12)),
                if (q['description'] != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('${q['description']}')),
                if ((q['files'] as List).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('📎 ${(q['files'] as List).length} attachment(s)', style: const TextStyle(fontSize: 12))),
                if (q['resolution'] != null)
                  Card(
                    color: Colors.green.withValues(alpha: 0.08),
                    margin: const EdgeInsets.only(top: 10),
                    child: Padding(padding: const EdgeInsets.all(10), child: Text('Resolution: ${q['resolution']}')),
                  ),
                if (canManage)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Wrap(spacing: 8, children: [
                      if (active) FilledButton.icon(onPressed: () => _resolve('${lastResponse['message'] ?? ''}'), icon: const Icon(Icons.check), label: const Text('Resolve')),
                      if (q['status'] == 'resolved') OutlinedButton(onPressed: () => _state('close'), child: const Text('Close')),
                      if (!active) OutlinedButton(onPressed: () => _state('reopen'), child: const Text('Reopen')),
                    ]),
                  ),
                const Divider(height: 28),
                if (replies.isEmpty) const Center(child: Text('No replies yet', style: TextStyle(color: Colors.grey))),
                for (final r in replies)
                  if (r['kind'] == 'event')
                    Padding(padding: const EdgeInsets.only(bottom: 8), child: Center(child: Text('${r['userName']} · ${r['message']}', style: const TextStyle(fontSize: 11, color: Colors.grey))))
                  else
                  Align(
                    alignment: r['userId'] == me ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                      decoration: BoxDecoration(
                        color: r['kind'] == 'response' ? Colors.purple.withValues(alpha: 0.12) : r['userId'] == me ? Theme.of(context).colorScheme.primaryContainer : Theme.of(context).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${r['userName']}${r['kind'] == 'response' ? ' · RESPONSE' : ''} · ${fmtDateTime(r['createdAt'])}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                        Text('${r['message']}'),
                      ]),
                    ),
                  ),
              ]),
            ),
            if (active) SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 8, 8),
                child: Row(children: [
                  Expanded(child: TextField(controller: _msg, minLines: 1, maxLines: 4, decoration: InputDecoration(hintText: isAssignee ? 'Write your response…' : 'Reply or follow up…', isDense: true))),
                  IconButton.filled(onPressed: _sending ? null : _send, icon: const Icon(Icons.send)),
                ]),
              ),
            ),
          ]);
        },
      ),
    );
  }
}
