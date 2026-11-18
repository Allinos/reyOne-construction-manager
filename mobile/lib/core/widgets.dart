import 'package:material_ui/material_ui.dart';

import 'api.dart';

/// Loads data with a pull-to-refresh, loading and error state.
class AsyncView<T> extends StatefulWidget {
  const AsyncView({super.key, required this.load, required this.builder, this.empty});
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload) builder;
  final bool Function(T data)? empty;

  @override
  State<AsyncView<T>> createState() => AsyncViewState<T>();
}

class AsyncViewState<T> extends State<AsyncView<T>> {
  T? _data;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    setState(() => _loading = _data == null);
    try {
      final d = await widget.load();
      if (!mounted) return;
      setState(() {
        _data = d;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null && _data == null) {
      return ErrorView(message: '$_error', onRetry: reload);
    }
    return RefreshIndicator(onRefresh: reload, child: widget.builder(context, _data as T, reload));
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off, size: 48, color: Colors.grey),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[const SizedBox(height: 12), OutlinedButton(onPressed: onRetry, child: const Text('Retry'))],
          ]),
        ),
      );
}

class EmptyView extends StatelessWidget {
  const EmptyView(this.text, {super.key, this.icon = Icons.inbox_outlined});
  final String text;
  final IconData icon;
  @override
  Widget build(BuildContext context) => ListView(children: [
        const SizedBox(height: 120),
        Icon(icon, size: 52, color: Colors.grey),
        const SizedBox(height: 10),
        Center(child: Text(text, style: const TextStyle(color: Colors.grey))),
      ]);
}

class Chip2 extends StatelessWidget {
  const Chip2(this.label, {super.key, this.color = Colors.blueGrey});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
      );
}

Color statusColor(String s) {
  switch (s) {
    case 'completed':
    case 'approved':
    case 'fulfilled':
    case 'resolved':
    case 'verified':
    case 'closed':
    case 'paid':
    case 'present':
      return Colors.green;
    case 'pending':
    case 'open':
    case 'half_day':
    case 'due_soon':
      return Colors.orange;
    case 'rejected':
    case 'overdue':
    case 'absent':
    case 'urgent':
    case 'critical':
      return Colors.red;
    case 'in_progress':
    case 'partially_fulfilled':
    case 'leave':
      return Colors.blue;
    default:
      return Colors.blueGrey;
  }
}

String label(String s) => s.isEmpty ? s : (s[0].toUpperCase() + s.substring(1)).replaceAll('_', ' ');

void toast(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), backgroundColor: error ? Colors.red.shade700 : null, behavior: SnackBarBehavior.floating));
}

/// Runs an API action with a toast on failure; returns true on success.
Future<bool> guard(BuildContext context, Future<void> Function() fn, {String? success}) async {
  try {
    await fn();
    if (success != null && context.mounted) toast(context, success);
    return true;
  } on ApiException catch (e) {
    if (context.mounted) toast(context, e.message, error: true);
  } catch (e) {
    if (context.mounted) toast(context, '$e', error: true);
  }
  return false;
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
        child: Row(children: [
          Expanded(child: Text(text.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: Colors.grey))),
          ?trailing,
        ]),
      );
}

/// Simple project picker loaded from the API (respects project access).
Future<Map<String, dynamic>?> pickProject(BuildContext context) async {
  final list = (await Api.I.getPaged('/projects', query: {'limit': 100})).items.cast<Map<String, dynamic>>();
  if (!context.mounted) return null;
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    showDragHandle: true,
    builder: (_) => list.isEmpty
        ? const Padding(padding: EdgeInsets.all(32), child: Text('No projects assigned to you.'))
        : ListView(children: [
            for (final p in list)
              ListTile(title: Text('${p['name']}'), subtitle: Text('${p['clientName'] ?? ''}'), onTap: () => Navigator.pop(context, p)),
          ]),
  );
}
