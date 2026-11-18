import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api.dart';

/// Registers this device for push notifications. Requires Firebase to be
/// configured for the app (google-services.json / GoogleService-Info.plist);
/// without it this quietly does nothing and the in-app notification list
/// still works.
class Push {
  static bool _initialised = false;
  static String? _token;
  static StreamSubscription<String>? _sub;

  static Future<void> register() async {
    try {
      if (!_initialised) {
        await Firebase.initializeApp();
        _initialised = true;
      }
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission();
      // onRegistered fires with the token now and again whenever it rotates.
      _sub ??= fm.onRegistered.listen((t) {
        _token = t;
        Api.I.post('/notifications/devices', {'token': t, 'platform': Platform.isIOS ? 'ios' : 'android'}).catchError((_) => null);
      });
      await fm.register();
    } catch (e) {
      debugPrint('Push not available: $e');
    }
  }

  static Future<void> unregister() async {
    if (_token == null) return;
    try {
      await Api.I.delete('/notifications/devices', {'token': _token});
    } catch (_) {}
  }
}
