import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/session.dart';
import '../core/widgets.dart';
import 'inspections_screen.dart';
import 'materials_screen.dart';
import 'projects_screen.dart';
import 'queries_screen.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  Widget? _target(Map n) {
    final id = int.tryParse('${n['entityId']}');
    final s = Session.I;
    switch (n['entityType']) {
      case 'project':
        return id != null && s.on('projects') ? ProjectDetailScreen(id: id) : null;
      case 'query':
        return id != null && s.on('queries') ? QueryDetailScreen(id: id) : null;
      case 'inspection':
        if (!s.on('inspections')) return null;
        return s.can('inspections.read') && id != null ? InspectionDetailScreen(id: id) : const MyIssuesScreen();
      case 'material_request':
        return s.on('materials') ? const MaterialsScreen() : null;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications'), actions: [
        TextButton(onPressed: () => Api.I.post('/notifications/read-all'), child: const Text('Mark all read')),
      ]),
      body: AsyncView<List<dynamic>>(
        load: () async => (await Api.I.getPaged('/notifications', query: {'limit': 50})).items,
        builder: (context, list, reload) => list.isEmpty
            ? const EmptyView('No notifications', icon: Icons.notifications_none)
            : ListView.separated(
                itemCount: list.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final n = list[i] as Map<String, dynamic>;
                  final unread = n['readAt'] == null;
                  return ListTile(
                    tileColor: unread ? Colors.orange.withValues(alpha: 0.06) : null,
                    leading: Icon(unread ? Icons.circle : Icons.circle_outlined, size: 12, color: unread ? Colors.orange : Colors.grey),
                    title: Text('${n['title']}', style: TextStyle(fontWeight: unread ? FontWeight.w600 : FontWeight.normal)),
                    subtitle: Text('${n['message'] ?? ''}\n${fmtDateTime(n['createdAt'])}'),
                    isThreeLine: true,
                    onTap: () async {
                      if (unread) Api.I.patch('/notifications/${n['id']}/read', const {});
                      final t = _target(n);
                      if (t != null) await Navigator.push(context, MaterialPageRoute(builder: (_) => t));
                      reload();
                    },
                  );
                },
              ),
      ),
    );
  }
}
