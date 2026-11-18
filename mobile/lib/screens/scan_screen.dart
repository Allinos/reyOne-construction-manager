import 'package:material_ui/material_ui.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Full-screen camera that returns the first QR code it reads.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white, title: const Text('Scan company QR code')),
      body: Stack(children: [
        MobileScanner(
          controller: _controller,
          onDetect: (capture) {
            if (_done) return;
            final value = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
            if (value == null) return;
            _done = true;
            Navigator.pop(context, value);
          },
        ),
        Center(
          child: Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 3), borderRadius: BorderRadius.circular(16)),
          ),
        ),
        const Positioned(
          left: 24,
          right: 24,
          bottom: 48,
          child: Text(
            'Open reyOne on a computer → Settings → Mobile app, and point the camera at the QR code.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white, fontSize: 15),
          ),
        ),
      ]),
    );
  }
}
