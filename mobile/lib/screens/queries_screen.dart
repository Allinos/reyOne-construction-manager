import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/photos.dart';
import '../core/session.dart';
import '../core/widgets.dart';

const _priorityColor = {'low': Colors.blueGrey, 'normal': Colors.blue, 'high': Colors.deepOrange, 'urgent': Colors.red};

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
              const Text('Raise a query', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
              const SizedBox(height: 10),
              TextField(controller: desc, maxLines: 3, decoration: const InputDecoration(labelText: 'Details')),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                icon: const Icon(Icons.apartment),
                label: Text(project == null ? 'Project / site (optional)' : '${project!['name']}'),
                onPressed: () async {
                  final p = await pickProject(ctx);
                  set(() => project = p);
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
        'projectId': project?['id'],
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
              ButtonSegment(value: 'all', label: Text('All')),
              ButtonSegment(value: 'mine', label: Text('Mine')),
              ButtonSegment(value: 'assigned', label: Text('Assigned')),
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
                          subtitle: Text('${q['projectName'] ?? 'General'} · by ${q['createdByName']} · ${q['replyCount']} replies'),
                          trailing: Chip2(label('${q['status']}'), color: statusColor('${q['status']}')),
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

  Future<void> _status(String s) async {
    if (await guard(context, () => Api.I.patch('/queries/${widget.id}', {'status': s}), success: 'Marked ${label(s).toLowerCase()}')) _key.currentState?.reload();
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
          final isAssignee = (q['assignees'] as List).any((a) => a['id'] == me);
          final canStatus = Session.I.can('queries.manage') || q['createdById'] == me || isAssignee;
          return Column(children: [
            Expanded(
              child: ListView(padding: const EdgeInsets.all(12), children: [
                Text('${q['title']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  Chip2(label('${q['status']}'), color: statusColor('${q['status']}')),
                  Chip2(label('${q['priority']}'), color: _priorityColor['${q['priority']}'] ?? Colors.grey),
                  if (q['projectName'] != null) Chip2('${q['projectName']}'),
                ]),
                const SizedBox(height: 6),
                Text('by ${q['createdByName']} · ${fmtDateTime(q['createdAt'])}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                if ((q['assignees'] as List).isNotEmpty) Text('Assigned: ${(q['assignees'] as List).map((a) => a['name']).join(', ')}', style: const TextStyle(fontSize: 12)),
                if (q['description'] != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('${q['description']}')),
                if ((q['files'] as List).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('📎 ${(q['files'] as List).length} attachment(s)', style: const TextStyle(fontSize: 12))),
                if (canStatus && q['status'] != 'resolved' && q['status'] != 'closed')
                  Padding(padding: const EdgeInsets.only(top: 10), child: OutlinedButton.icon(onPressed: () => _status('resolved'), icon: const Icon(Icons.check), label: const Text('Mark resolved'))),
                const Divider(height: 28),
                if (replies.isEmpty) const Center(child: Text('No replies yet', style: TextStyle(color: Colors.grey))),
                for (final r in replies)
                  Align(
                    alignment: r['userId'] == me ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                      decoration: BoxDecoration(
                        color: r['userId'] == me ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${r['userName']} · ${fmtDateTime(r['createdAt'])}', style: TextStyle(fontSize: 10, color: r['userId'] == me ? Colors.white70 : Colors.grey)),
                        Text('${r['message']}', style: TextStyle(color: r['userId'] == me ? Colors.white : null)),
                      ]),
                    ),
                  ),
              ]),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 8, 8),
                child: Row(children: [
                  Expanded(child: TextField(controller: _msg, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: 'Reply…', isDense: true))),
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
