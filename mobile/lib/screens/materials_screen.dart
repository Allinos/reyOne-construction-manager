import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/widgets.dart';

/// Material requests (raise / approve), site stock and consumption.
class MaterialsScreen extends StatefulWidget {
  const MaterialsScreen({super.key});
  @override
  State<MaterialsScreen> createState() => _MaterialsScreenState();
}

class _MaterialsScreenState extends State<MaterialsScreen> {
  final _key = GlobalKey<AsyncViewState<List<dynamic>>>();
  bool get _canRequest => Session.I.can('materials.request') || Session.I.can('materials.manage');

  Future<List<Map<String, dynamic>>> _materials() async => ((await Api.I.get('/materials/items')) as List).cast<Map<String, dynamic>>();

  Future<void> _newRequest() async {
    final project = await pickProject(context);
    if (project == null || !mounted) return;
    final mats = await _materials();
    if (!mounted) return;
    final lines = <Map<String, dynamic>>[{'materialId': null, 'qty': TextEditingController()}];
    var priority = 'normal';
    final notes = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Material request · ${project['name']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              for (final l in lines)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    Expanded(
                      flex: 3,
                      child: DropdownButtonFormField<int?>(
                        initialValue: l['materialId'] as int?,
                        isExpanded: true,
                        decoration: const InputDecoration(labelText: 'Material'),
                        items: [for (final m in mats) DropdownMenuItem(value: m['id'] as int, child: Text('${m['name']} (${m['unit']})', overflow: TextOverflow.ellipsis))],
                        onChanged: (v) => set(() => l['materialId'] = v),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(controller: l['qty'] as TextEditingController, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Qty'))),
                  ]),
                ),
              Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => set(() => lines.add({'materialId': null, 'qty': TextEditingController()})), icon: const Icon(Icons.add), label: const Text('Add material'))),
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
              TextField(controller: notes, decoration: const InputDecoration(labelText: 'Notes')),
              const SizedBox(height: 14),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit request')),
            ]),
          ),
        ),
      ),
    );
    if (ok != true || !mounted) return;
    final items = [
      for (final l in lines)
        if (l['materialId'] != null && (double.tryParse((l['qty'] as TextEditingController).text) ?? 0) > 0)
          {'materialId': l['materialId'], 'quantity': double.parse((l['qty'] as TextEditingController).text)},
    ];
    if (items.isEmpty) {
      toast(context, 'Add at least one material with a quantity', error: true);
      return;
    }
    if (await guard(context, () => Api.I.post('/materials/requests', {'projectId': project['id'], 'items': items, 'priority': priority, if (notes.text.trim().isNotEmpty) 'notes': notes.text.trim()}), success: 'Request sent — approvers notified')) {
      _key.currentState?.reload();
    }
  }

  Future<void> _decide(Map r, String decision) async {
    if (await guard(context, () => Api.I.patch('/materials/requests/${r['id']}/decide', {'decision': decision}), success: decision == 'approve' ? 'Approved' : 'Rejected')) {
      _key.currentState?.reload();
    }
  }

  Future<void> _consume() async {
    final project = await pickProject(context);
    if (project == null || !mounted) return;
    final stock = ((await Api.I.get('/materials/stock', query: {'projectId': project['id']})) as List).cast<Map<String, dynamic>>().where((s) => (s['quantity'] as num) > 0).toList();
    if (!mounted) return;
    if (stock.isEmpty) {
      toast(context, 'No stock at this site yet', error: true);
      return;
    }
    int? materialId = stock.first['materialId'] as int;
    final qtyCtl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Record consumption · ${project['name']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            DropdownButtonFormField<int?>(
              initialValue: materialId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Material'),
              items: [for (final s in stock) DropdownMenuItem(value: s['materialId'] as int, child: Text('${s['name']} · ${qty(s['quantity'], '${s['unit']}')} at site'))],
              onChanged: (v) => set(() => materialId = v),
            ),
            const SizedBox(height: 10),
            TextField(controller: qtyCtl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Quantity used')),
            const SizedBox(height: 14),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ]),
        ),
      ),
    );
    final q = double.tryParse(qtyCtl.text) ?? 0;
    if (ok != true || materialId == null || q <= 0 || !mounted) return;
    await guard(context, () => Api.I.post('/materials/consume', {'materialId': materialId, 'quantity': q, 'projectId': project['id']}), success: 'Consumption recorded');
  }

  @override
  Widget build(BuildContext context) {
    final canApprove = Session.I.can('materials.approve');
    return Scaffold(
      appBar: AppBar(title: const Text('Materials'), actions: [
        if (_canRequest) TextButton.icon(onPressed: _consume, icon: const Icon(Icons.remove_circle_outline), label: const Text('Used')),
      ]),
      floatingActionButton: _canRequest ? FloatingActionButton.extended(onPressed: _newRequest, icon: const Icon(Icons.add), label: const Text('Request')) : null,
      body: AsyncView<List<dynamic>>(
        key: _key,
        load: () async => await Api.I.get('/materials/requests') as List,
        builder: (context, list, reload) => list.isEmpty
            ? const EmptyView('No material requests', icon: Icons.inventory_2_outlined)
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final r = list[i] as Map<String, dynamic>;
                  final items = (r['items'] as List).cast<Map<String, dynamic>>();
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text('#${r['id']} · ${r['projectName']}', style: const TextStyle(fontWeight: FontWeight.w700))),
                          Chip2(label('${r['status']}'), color: statusColor('${r['status']}')),
                        ]),
                        Text('${r['requestedByName'] ?? ''} · ${fmtDate(r['createdAt'])}${r['priority'] != 'normal' ? ' · ${'${r['priority']}'.toUpperCase()}' : ''}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                        const SizedBox(height: 8),
                        for (final it in items)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(children: [
                              Expanded(child: Text('${it['name']}')),
                              Text(qty(it['quantity'], '${it['unit']}')),
                              if (((it['fulfilledQty'] as num?) ?? 0) > 0) Text('  · sent ${qty(it['fulfilledQty'])}', style: const TextStyle(color: Colors.green, fontSize: 12)),
                            ]),
                          ),
                        if (r['status'] == 'pending' && canApprove) ...[
                          const SizedBox(height: 8),
                          Row(children: [
                            Expanded(child: OutlinedButton(onPressed: () => _decide(r, 'reject'), child: const Text('Reject'))),
                            const SizedBox(width: 8),
                            Expanded(child: FilledButton(onPressed: () => _decide(r, 'approve'), child: const Text('Approve'))),
                          ]),
                        ],
                      ]),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
