import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String defaultProduction = 'https://api.barajastore.my.id/api/v1';
  static const String _keyBaseUrl = 'custom_base_url';

  /// Default production API Baraja Store
  static Future<String> getBaseUrl() async {
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
