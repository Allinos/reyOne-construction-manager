import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/connect.dart';
import '../core/session.dart';
import '../core/theme.dart';
import 'scan_screen.dart';

/// Two steps: connect to the company's own reyOne server (scan the QR from
/// Settings → Mobile app, paste the connection code, or type the address),
/// then sign in. One app works with every company's separate instance.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _code = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _hide = true;
  String? _error;
  bool _connected = Api.I.baseUrl.isNotEmpty;

  Future<void> _connect(String raw) async {
    final parsed = parseConnection(raw);
    if (parsed == null) {
      setState(() => _error = 'That code or address is not valid.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final inst = await verifyInstance(parsed.url);
      if (!inst.mobileEnabled) {
        throw Exception('The mobile app is not activated for ${inst.name}. Ask your administrator to turn it on in Settings → Mobile app.');
      }
      await Api.I.setCompany(inst.url, inst.name);
      if (mounted) setState(() => _connected = true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _scan() async {
    final value = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => const ScanScreen()));
    if (value != null && mounted) await _connect(value);
  }

  Future<void> _signIn() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await Session.I.login(_email.text, _password.text);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _header(String subtitle) => Column(children: [
        Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: brand, borderRadius: BorderRadius.circular(18)),
          child: const Icon(Icons.apartment, color: brandDark, size: 34),
        ),
        const SizedBox(height: 16),
        const Text('reyOne Site', textAlign: TextAlign.center, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
        Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 28),
      ]);

  List<Widget> _connectStep() => [
        _header('Connect to your company'),
        FilledButton.icon(onPressed: _busy ? null : _scan, icon: const Icon(Icons.qr_code_scanner), label: const Text('Scan QR code')),
        const SizedBox(height: 18),
        const Row(children: [Expanded(child: Divider()), Padding(padding: EdgeInsets.symmetric(horizontal: 10), child: Text('or', style: TextStyle(color: Colors.grey))), Expanded(child: Divider())]),
        const SizedBox(height: 18),
        TextField(
          controller: _code,
          keyboardType: TextInputType.url,
          autocorrect: false,
          onSubmitted: (v) => _connect(v),
          decoration: const InputDecoration(labelText: 'Connection code or server address', hintText: 'RY1-…  or  erp.yourcompany.com', prefixIcon: Icon(Icons.link)),
        ),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: _busy ? null : () => _connect(_code.text), child: const Text('Connect')),
        const SizedBox(height: 16),
        const Text('Find the QR code and code on a computer: reyOne → Settings → Mobile app.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontSize: 13)),
      ];

  List<Widget> _signInStep() => [
        _header('Sign in'),
        Card(
          child: ListTile(
            leading: const Icon(Icons.business, color: accent),
            title: Text(Api.I.companyName.isEmpty ? 'Company server' : Api.I.companyName, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(Api.I.baseUrl, overflow: TextOverflow.ellipsis),
            trailing: TextButton(onPressed: _busy ? null : () => setState(() { _connected = false; _error = null; }), child: const Text('Change')),
          ),
        ),
        const SizedBox(height: 16),
        AutofillGroup(
          child: Column(children: [
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: _hide,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _signIn(),
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(icon: Icon(_hide ? Icons.visibility : Icons.visibility_off), onPressed: () => setState(() => _hide = !_hide)),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 20),
        FilledButton(onPressed: _busy ? null : _signIn, child: const Text('Sign in')),
      ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                ...(_connected ? _signInStep() : _connectStep()),
                if (_busy) const Padding(padding: EdgeInsets.only(top: 16), child: Center(child: CircularProgressIndicator())),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
