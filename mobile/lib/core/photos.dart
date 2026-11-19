import 'dart:convert';

import 'package:exif/exif.dart';
import 'package:image_picker/image_picker.dart';

import 'api.dart';

/// Take/choose photos (downscaled on device) and upload them as attachments.
Future<int> pickAndUpload({required String entityType, required int entityId, bool camera = true, String? tag, String? caption}) async {
  final picker = ImagePicker();
  final files = camera
      ? [await picker.pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 75)].whereType<XFile>().toList()
      : await picker.pickMultiImage(maxWidth: 1600, imageQuality: 75);
  var n = 0;
  for (final f in files) {
    final bytes = await f.readAsBytes();
    final takenAt = await photoDate(bytes);
    await Api.I.post('/files', {
      'entityType': entityType,
      'entityId': entityId,
      'name': f.name,
      'mimeType': 'image/jpeg',
      'data': 'data:image/jpeg;base64,${base64Encode(bytes)}',
      'takenAt': ?takenAt,
      'tag': ?tag,
      'caption': ?caption,
    });
    n++;
  }
  return n;
}

/// Original capture time from the photo's EXIF (DateTimeOriginal), as an ISO
/// string, or null when the image has no such metadata.
Future<String?> photoDate(List<int> bytes) async {
  try {
    final tags = await readExifFromBytes(bytes);
    final raw = (tags['EXIF DateTimeOriginal'] ?? tags['EXIF DateTimeDigitized'] ?? tags['Image DateTime'])?.printable;
    final m = RegExp(r'^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})').firstMatch(raw ?? '');
    if (m == null) return null;
    final d = DateTime(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!), int.parse(m[4]!), int.parse(m[5]!), int.parse(m[6]!));
    return d.year < 1990 ? null : d.toUtc().toIso8601String();
  } catch (_) {
    return null;
  }
}

Future<List<dynamic>> listPhotos(String entityType, int entityId) async =>
    (await Api.I.get('/files', query: {'entityType': entityType, 'entityId': entityId, 'withData': 'true'}) as List?) ?? const [];
