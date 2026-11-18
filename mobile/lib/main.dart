import 'package:material_ui/material_ui.dart';

import 'core/push.dart';
import 'core/session.dart';
import 'core/theme.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  Session.I.restore();
  runApp(const ReyOneApp());
}

class ReyOneApp extends StatelessWidget {
  const ReyOneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'reyOne Site',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      home: ListenableBuilder(
        listenable: Session.I,
        builder: (context, _) {
          final s = Session.I;
          if (!s.ready) return const Scaffold(body: Center(child: CircularProgressIndicator()));
          return s.signedIn ? const _SignedIn() : const LoginScreen();
        },
      ),
    );
  }
}

class _SignedIn extends StatefulWidget {
  const _SignedIn();
  @override
  State<_SignedIn> createState() => _SignedInState();
}

class _SignedInState extends State<_SignedIn> {
  @override
  void initState() {
    super.initState();
    Push.register();
  }

  @override
  Widget build(BuildContext context) => const HomeScreen();
}
