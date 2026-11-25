import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import 'api_service.dart';

class AuthService {
  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'auth_user';

  static Future<UserModel> login(String email, String password) async {
    final res = await ApiService.post('/auth/login', {
      'email': email.trim(),
      'password': password.trim(),
    });

    final data = res['data'] ?? {};
    final String token =
        (data['tokens'] != null && data['tokens']['accessToken'] != null)
        ? data['tokens']['accessToken'].toString()
        : (data['token']?.toString() ?? data['accessToken']?.toString() ?? '');

    if (token.isEmpty) {
      throw Exception(
        'Gagal mendapatkan token autentikasi dari respons server.',
      );
    }

    final userJson = data['user'] is Map<String, dynamic>
        ? data['user'] as Map<String, dynamic>
        : <String, dynamic>{};

    final user = UserModel.fromJson(userJson, token: token);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(user.toJson()));

    return user;
  }

  static Future<UserModel> updateProfile({
    required UserModel currentUser,
    required String name,
  }) async {
    final response = await ApiService.put('/auth/profile', {'name': name});
    final data = response is Map ? response['data'] : null;
    if (data is! Map) {
      throw const FormatException('Format profil dari server tidak valid.');
    }

    final updatedUser = UserModel.fromJson(
      Map<String, dynamic>.from(data),
      token: currentUser.token,
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(updatedUser.toJson()));
    return updatedUser;
  }

  static Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await ApiService.post('/auth/change-password', {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  static Future<UserModel?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString(_userKey);
    final token = prefs.getString(_tokenKey);

    if (userStr == null || token == null) {
      return null;
    }

    try {
      final json = jsonDecode(userStr);
      return UserModel.fromJson(json, token: token);
    } catch (_) {
      return null;
    }
  }

  static Future<bool> isLoggedIn() async {
    final user = await getCurrentUser();
    return user != null;
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }
}
