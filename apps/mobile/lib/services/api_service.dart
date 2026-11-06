import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiService {
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }

  static Future<Map<String, String>> _getHeaders({bool hasBody = true}) async {
    final token = await getToken();
    final headers = <String, String>{
      'Accept': 'application/json',
    };
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static Future<dynamic> get(String endpoint) async {
    final baseUrl = await ApiConfig.getBaseUrl();
    final url = Uri.parse('$baseUrl$endpoint');
    final headers = await _getHeaders(hasBody: false);

    final response = await http.get(url, headers: headers).timeout(
      const Duration(seconds: 12),
      onTimeout: () => throw Exception('Koneksi timeout ke server ($url)'),
    );

    return _handleResponse(response);
  }

  static Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    final baseUrl = await ApiConfig.getBaseUrl();
    final url = Uri.parse('$baseUrl$endpoint');
    final headers = await _getHeaders(hasBody: true);

    final response = await http.post(
      url,
      headers: headers,
      body: jsonEncode(body),
    ).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Koneksi timeout ke server ($url)'),
    );

    return _handleResponse(response);
  }

  static Future<dynamic> put(String endpoint, Map<String, dynamic> body) async {
    final baseUrl = await ApiConfig.getBaseUrl();
    final url = Uri.parse('$baseUrl$endpoint');
    final headers = await _getHeaders(hasBody: true);

    final response = await http.put(
      url,
      headers: headers,
      body: jsonEncode(body),
    ).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Koneksi timeout ke server ($url)'),
    );

    return _handleResponse(response);
  }

  static dynamic _handleResponse(http.Response response) {
    dynamic decoded;
    try {
      decoded = jsonDecode(response.body);
    } catch (_) {
      decoded = {'message': response.body};
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    } else {
      final msg = decoded is Map && decoded['message'] != null
          ? decoded['message'].toString()
          : 'Terjadi kesalahan (HTTP ${response.statusCode})';
      throw Exception(msg);
    }
  }
}
