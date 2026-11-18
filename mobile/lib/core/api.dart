import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// Error surfaced to the UI with the server's message.
class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

/// Paged list result ({ data, meta }).
class Paged {
  Paged(this.items, this.meta);
  final List<dynamic> items;
  final Map<String, dynamic>? meta;
}

/// Thin client for the reyOne API. Every request identifies itself as the
/// mobile app (X-Client: mobile) so the server can enforce the Mobile App
/// module, and access tokens are refreshed transparently on 401.
class Api {
  Api._();
  static final Api I = Api._();

  static const _storage = FlutterSecureStorage();
  final http.Client _http = http.Client();

  String baseUrl = '';
  String? _access;
  String? _refresh;
  Future<bool>? _refreshing;

  /// Called when the session can no longer be refreshed (forces re-login).
  void Function()? onUnauthorized;

  bool get hasTokens => _access != null && _refresh != null;

  Future<void> load() async {
    baseUrl = await _storage.read(key: 'baseUrl') ?? '';
    _access = await _storage.read(key: 'access');
    _refresh = await _storage.read(key: 'refresh');
  }

  Future<void> setBaseUrl(String url) async {
    var u = url.trim();
    if (u.isEmpty) return;
    if (!u.startsWith('http')) u = 'https://$u';
    while (u.endsWith('/')) {
      u = u.substring(0, u.length - 1);
    }
    baseUrl = u;
    await _storage.write(key: 'baseUrl', value: u);
  }

  Future<void> setTokens(String access, String refresh) async {
    _access = access;
    _refresh = refresh;
    await _storage.write(key: 'access', value: access);
    await _storage.write(key: 'refresh', value: refresh);
  }

  Future<void> clearTokens() async {
    _access = null;
    _refresh = null;
    await _storage.delete(key: 'access');
    await _storage.delete(key: 'refresh');
  }

  String? get refreshToken => _refresh;

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final q = <String, String>{};
    query?.forEach((k, v) {
      if (v != null && '$v'.isNotEmpty) q[k] = '$v';
    });
    return Uri.parse('$baseUrl/api/v1$path').replace(queryParameters: q.isEmpty ? null : q);
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'X-Client': 'mobile',
        if (_access != null) 'Authorization': 'Bearer $_access',
      };

  Future<http.Response> _send(String method, String path, {Map<String, dynamic>? query, Object? body}) {
    final req = http.Request(method, _uri(path, query))..headers.addAll(_headers);
    if (body != null) req.body = jsonEncode(body);
    return _http.send(req).then(http.Response.fromStream).timeout(const Duration(seconds: 30));
  }

  Future<bool> _doRefresh() async {
    if (_refresh == null) return false;
    try {
      final res = await _http
          .post(_uri('/auth/refresh'), headers: {'Content-Type': 'application/json', 'X-Client': 'mobile'}, body: jsonEncode({'refreshToken': _refresh}))
          .timeout(const Duration(seconds: 20));
      if (res.statusCode != 200) return false;
      final data = jsonDecode(res.body)['data'] as Map<String, dynamic>;
      await setTokens(data['accessToken'] as String, data['refreshToken'] as String);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> _request(String method, String path, {Map<String, dynamic>? query, Object? body, bool auth = true}) async {
    http.Response res;
    try {
      res = await _send(method, path, query: query, body: body);
      if (res.statusCode == 401 && auth && _refresh != null && !path.startsWith('/auth/')) {
        _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
        if (await _refreshing!) {
          res = await _send(method, path, query: query, body: body);
        } else {
          await clearTokens();
          onUnauthorized?.call();
          throw ApiException(401, 'Your session has expired. Please sign in again.');
        }
      }
    } on TimeoutException {
      throw ApiException(0, 'The server took too long to respond. Check your connection.');
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(0, 'Cannot reach the server. Check your internet connection.');
    }
    Map<String, dynamic> json;
    try {
      json = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(res.statusCode, 'Unexpected response from server (${res.statusCode}).');
    }
    if (res.statusCode >= 400) {
      final err = json['error'];
      final msg = (err is Map ? err['message'] : null) ?? json['message'] ?? 'Request failed (${res.statusCode})';
      throw ApiException(res.statusCode, '$msg');
    }
    return json;
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async => (await _request('GET', path, query: query))['data'];
  Future<Paged> getPaged(String path, {Map<String, dynamic>? query}) async {
    final j = await _request('GET', path, query: query);
    return Paged((j['data'] as List?) ?? const [], j['meta'] as Map<String, dynamic>?);
  }

  Future<dynamic> post(String path, [Object? body]) async => (await _request('POST', path, body: body ?? const {}))['data'];
  Future<dynamic> patch(String path, Object body) async => (await _request('PATCH', path, body: body))['data'];
  Future<dynamic> put(String path, Object body) async => (await _request('PUT', path, body: body))['data'];
  Future<dynamic> delete(String path, [Object? body]) async => (await _request('DELETE', path, body: body))['data'];
}
