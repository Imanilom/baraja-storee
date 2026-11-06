import 'dart:io';
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String _defaultAndroidEmulator = 'http://10.0.2.2:5000/api';
  static const String _defaultGeneral = 'http://localhost:5000/api';
  static const String _keyBaseUrl = 'custom_base_url';

  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final custom = prefs.getString(_keyBaseUrl);
    if (custom != null && custom.isNotEmpty) {
      return custom;
    }
    try {
      if (Platform.isAndroid) {
        return _defaultAndroidEmulator;
      }
    } catch (_) {}
    return _defaultGeneral;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyBaseUrl, url.trim());
  }

  static Future<void> resetBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyBaseUrl);
  }
}
