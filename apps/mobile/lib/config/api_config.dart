import 'dart:io';
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String defaultProduction = 'https://api.barajastore.my.id/api/v1';
  static const String defaultAndroidEmulator = 'http://10.0.2.2:5000/api/v1';
  static const String _keyBaseUrl = 'custom_base_url';

  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final custom = prefs.getString(_keyBaseUrl);
    if (custom != null && custom.isNotEmpty) {
      return custom;
    }
    return defaultProduction;
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

