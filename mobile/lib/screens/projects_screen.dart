import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/widgets.dart';

class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Projects')),
      body: AsyncView<List<dynamic>>(
        load: () async => (await Api.I.getPaged('/projects', query: {'limit': 100})).items,
        builder: (context, list, reload) => list.isEmpty
            ? const EmptyView('No projects assigned to you', icon: Icons.apartment)
            : ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final p = list[i] as Map<String, dynamic>;
                  final progress = ((p['progress'] as num?) ?? 0).toDouble();
                  return Card(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ProjectDetailScreen(id: p['id'] as int))).then((_) => reload()),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(child: Text('${p['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                            Chip2(label('${p['status']}'), color: statusColor('${p['status']}')),
                          ]),
                          Text('${p['referenceNumber']} · ${p['clientName']}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                          const SizedBox(height: 10),
                          Row(children: [
                            Expanded(child: LinearProgressIndicator(value: progress / 100, minHeight: 6, borderRadius: BorderRadius.circular(6))),
                            const SizedBox(width: 8),
                            Text('${progress.toInt()}%', style: const TextStyle(fontWeight: FontWeight.w600)),
                          ]),
                          if (p['endDate'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Target: ${fmtDate(p['endDate'])}', style: const TextStyle(fontSize: 12, color: Colors.grey))),
                        ]),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

/// Stages & tasks: site staff tick tasks off (moves project progress) and can
/// raise requests that need a manager's approval.
class ProjectDetailScreen extends StatefulWidget {
  const ProjectDetailScreen({super.key, required this.id});
  final int id;
  @override
  State<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends State<ProjectDetailScreen> {
  final _key = GlobalKey<AsyncViewState<Map<String, dynamic>>>();

  Future<void> _toggleTask(Map phase, Map task) async {
    final next = task['status'] == 'completed' ? 'pending' : 'completed';
    if (await guard(context, () => Api.I.patch('/projects/${widget.id}/phases/${phase['id']}/tasks/${task['id']}', {'status': next}))) {
      _key.currentState?.reload();
    }
  }

  Future<void> _request() async {
    final title = TextEditingController();
    final details = TextEditingController();
    var type = 'general';
    var priority = 'normal';
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Request approval', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Type'),
              items: const [
                DropdownMenuItem(value: 'general', child: Text('General request')),
                DropdownMenuItem(value: 'phase_completion', child: Text('Stage completion')),
                DropdownMenuItem(value: 'budget', child: Text('Budget / finance')),
                DropdownMenuItem(value: 'material', child: Text('Material')),
              ],
              onChanged: (v) => set(() => type = v ?? 'general'),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: priority,
              decoration: const InputDecoration(labelText: 'Priority'),
              items: const [
                DropdownMenuItem(value: 'low', child: Text('Low')),
                DropdownMenuItem(value: 'normal', child: Text('Normal')),
                DropdownMenuItem(value: 'high', child: Text('High')),
                DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
              ],
              onChanged: (v) => set(() => priority = v ?? 'normal'),
            ),
            const SizedBox(height: 10),
            TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
            const SizedBox(height: 10),
            TextField(controller: details, maxLines: 3, decoration: const InputDecoration(labelText: 'Details')),
            const SizedBox(height: 14),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit')),
          ]),
        ),
      ),
    );
    if (ok != true || title.text.trim().isEmpty || !mounted) return;
    if (await guard(context, () => Api.I.post('/projects/${widget.id}/approvals', {'type': type, 'priority': priority, 'title': title.text.trim(), if (details.text.trim().isNotEmpty) 'description': details.text.trim()}), success: 'Request sent for approval')) {
      _key.currentState?.reload();
    }
  }

  Future<void> _decide(Map a, String decision) async {
    if (await guard(context, () => Api.I.patch('/projects/${widget.id}/approvals/${a['id']}', {'decision': decision}), success: decision == 'approve' ? 'Approved' : 'Rejected')) {
      _key.currentState?.reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    final canEdit = Session.I.can('projects.update');
    return Scaffold(
      appBar: AppBar(title: const Text('Project')),
      floatingActionButton: FloatingActionButton.extended(onPressed: _request, icon: const Icon(Icons.how_to_vote_outlined), label: const Text('Request')),
      body: AsyncView<Map<String, dynamic>>(
        key: _key,
        load: () async => await Api.I.get('/projects/${widget.id}') as Map<String, dynamic>,
        builder: (context, p, reload) {
          final phases = (p['phases'] as List).cast<Map<String, dynamic>>();
          final approvals = ((p['approvals'] as List?) ?? const []).cast<Map<String, dynamic>>();
          final progress = ((p['progress'] as num?) ?? 0).toDouble();
          return ListView(padding: const EdgeInsets.fromLTRB(12, 12, 12, 90), children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${p['name']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  Text('${p['referenceNumber']} · ${p['clientName']}', style: const TextStyle(color: Colors.grey)),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: LinearProgressIndicator(value: progress / 100, minHeight: 8, borderRadius: BorderRadius.circular(8))),
                    const SizedBox(width: 10),
                    Text('${progress.toInt()}%', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ]),
                  const SizedBox(height: 8),
                  Text('Start ${fmtDate(p['startDate'])} · Target ${fmtDate(p['endDate'])}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ]),
              ),
            ),
            for (final ph in phases) ...[
              SectionTitle('${ph['name']}', trailing: Text('${ph['progress'] ?? 0}%', style: const TextStyle(fontWeight: FontWeight.w600))),
              Card(
                child: Column(children: [
                  if ((ph['tasks'] as List).isEmpty) const ListTile(title: Text('No tasks', style: TextStyle(color: Colors.grey))),
                  for (final t in (ph['tasks'] as List).cast<Map<String, dynamic>>())
                    CheckboxListTile(
                      value: t['status'] == 'completed',
                      onChanged: canEdit ? (_) => _toggleTask(ph, t) : null,
                      title: Text('${t['title']}', style: TextStyle(decoration: t['status'] == 'completed' ? TextDecoration.lineThrough : null)),
                      subtitle: t['deadline'] != null ? Text('Due ${fmtDate(t['deadline'])}') : null,
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                  if (ph['deadline'] != null) ListTile(dense: true, leading: const Icon(Icons.flag_outlined, size: 18), title: Text('Stage deadline ${fmtDate(ph['deadline'])}')),
                ]),
              ),
            ],
            if (approvals.isNotEmpty) ...[
              const SectionTitle('Requests & approvals'),
              for (final a in approvals)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Card(
                    child: ListTile(
                      title: Text('${a['title']}'),
                      subtitle: Text('${a['requestedBy']?['name'] ?? ''} · ${fmtDate(a['createdAt'])}${a['description'] != null ? '\n${a['description']}' : ''}'),
                      isThreeLine: a['description'] != null,
                      trailing: a['status'] == 'pending' && Session.I.can('projects.approve')
                          ? Row(mainAxisSize: MainAxisSize.min, children: [
                              IconButton(tooltip: 'Approve', icon: const Icon(Icons.check_circle, color: Colors.green), onPressed: () => _decide(a, 'approve')),
                              IconButton(tooltip: 'Reject', icon: const Icon(Icons.cancel, color: Colors.red), onPressed: () => _decide(a, 'reject')),
                            ])
                          : Chip2(label('${a['status']}'), color: statusColor('${a['status']}')),
                    ),
                  ),
                ),
            ],
          ]);
        },
      ),
    );
  }
}
