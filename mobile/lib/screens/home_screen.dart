import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/push.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../core/widgets.dart';
import 'attendance_screen.dart';
import 'inspections_screen.dart';
import 'materials_screen.dart';
import 'notifications_screen.dart';
import 'projects_screen.dart';
import 'queries_screen.dart';

class _Tile {
  const _Tile(this.title, this.icon, this.color, this.builder);
  final String title;
  final IconData icon;
  final Color color;
  final WidgetBuilder builder;
}

/// Home: only the modules this company has enabled AND this user may use.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _unread = 0;
  List<dynamic> _attention = const [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final c = await Api.I.get('/notifications/unread-count');
      final ins = Session.I.can('dashboard.read') ? await Api.I.get('/dashboard/insights') : null;
      if (!mounted) return;
      setState(() {
        _unread = (c?['count'] as num?)?.toInt() ?? 0;
        _attention = (ins?['attention'] as List?) ?? const [];
      });
      await Session.I.loadBootstrap();
    } catch (_) {}
  }

  List<_Tile> _tiles() {
    final s = Session.I;
    return [
      if (s.allowed('attendance', 'attendance.read')) _Tile('Attendance', Icons.how_to_reg, Colors.green, (_) => const AttendanceScreen()),
      if (s.allowed('projects', 'projects.read')) _Tile('Projects', Icons.apartment, Colors.indigo, (_) => const ProjectsScreen()),
      if (s.allowed('inspections', 'inspections.read')) _Tile('Site Inspection', Icons.fact_check, Colors.teal, (_) => const InspectionsScreen()),
      if (s.on('inspections')) _Tile('My Issues', Icons.build_circle_outlined, Colors.red, (_) => const MyIssuesScreen()),
      if (s.allowed('materials', 'materials.read')) _Tile('Materials', Icons.inventory_2_outlined, Colors.brown, (_) => const MaterialsScreen()),
      if (s.allowed('queries', 'queries.read')) _Tile('Queries', Icons.forum_outlined, Colors.blue, (_) => const QueriesScreen()),
    ];
  }

  void _open(WidgetBuilder b) => Navigator.push(context, MaterialPageRoute(builder: b)).then((_) => _refresh());

  void _openAttention(Map a) {
    final kind = '${a['kind']}';
    final s = Session.I;
    WidgetBuilder? b;
    if (kind == 'queries' && s.on('queries')) b = (_) => const QueriesScreen(initialScope: 'assigned');
    if (kind == 'issues') b = (_) => const MyIssuesScreen();
    if ((kind == 'material_requests' || kind == 'dispatch' || kind == 'low_stock') && s.on('materials')) b = (_) => const MaterialsScreen();
    if (kind == 'attendance' && s.on('attendance')) b = (_) => const AttendanceScreen();
    if ((kind == 'late_projects' || kind == 'approvals') && s.on('projects')) b = (_) => const ProjectsScreen();
    if (b != null) _open(b);
  }

  @override
  Widget build(BuildContext context) {
    final s = Session.I;
    final tiles = _tiles();
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${s.company?['name'] ?? 'reyOne'}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          Text('Hi, ${s.name.split(' ').first}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ]),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => _open((_) => const NotificationsScreen()),
            icon: Badge(isLabelVisible: _unread > 0, label: Text(_unread > 9 ? '9+' : '$_unread'), child: const Icon(Icons.notifications_outlined)),
          ),
          PopupMenuButton<String>(
            onSelected: (v) async {
              if (v == 'logout') {
                await Push.unregister();
                await Session.I.logout();
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(enabled: false, child: Text(s.name)),
              const PopupMenuItem(value: 'logout', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (_attention.isNotEmpty) ...[
            const SectionTitle('Needs your attention'),
            for (final a in _attention)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: ListTile(
                    leading: Icon(Icons.priority_high, color: a['tone'] == 'red' ? Colors.red : a['tone'] == 'amber' ? Colors.orange : Colors.blue),
                    title: Text('${a['label']}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _openAttention(a as Map),
                  ),
                ),
              ),
          ],
          const SectionTitle('Work'),
          if (tiles.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(20), child: Text('No mobile features are enabled for your role. Contact your administrator.')))
          else
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.35,
              children: [
                for (final t in tiles)
                  Card(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => _open(t.builder),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(color: t.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                            child: Icon(t.icon, color: t.color),
                          ),
                          Text(t.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                        ]),
                      ),
                    ),
                  ),
              ],
            ),
          const SizedBox(height: 24),
          Center(child: Text('Signed in to ${Api.I.baseUrl}', style: const TextStyle(fontSize: 11, color: Colors.grey))),
          const SizedBox(height: 4),
          const Center(child: Text('reyOne Site', style: TextStyle(fontSize: 11, color: brand))),
        ]),
      ),
    );
  }
}
