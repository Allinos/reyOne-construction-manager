import 'dart:convert';

import 'package:image_picker/image_picker.dart';

import 'api.dart';

/// Take/choose photos (downscaled on device) and upload them as attachments.
Future<int> pickAndUpload({required String entityType, required int entityId, bool camera = true}) async {
  final picker = ImagePicker();
  final files = camera
      ? [await picker.pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 75)].whereType<XFile>().toList()
      : await picker.pickMultiImage(maxWidth: 1600, imageQuality: 75);
  var n = 0;
  for (final f in files) {
    final bytes = await f.readAsBytes();
    await Api.I.post('/files', {
      'entityType': entityType,
      'entityId': entityId,
      'name': f.name,
      'mimeType': 'image/jpeg',
      'data': 'data:image/jpeg;base64,${base64Encode(bytes)}',
    });
    n++;
  }
  return n;
}

Future<List<dynamic>> listPhotos(String entityType, int entityId) async =>
    (await Api.I.get('/files', query: {'entityType': entityType, 'entityId': entityId, 'withData': 'true'}) as List?) ?? const [];
