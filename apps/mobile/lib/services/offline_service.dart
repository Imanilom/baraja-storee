import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'api_service.dart';

class OfflineService {
  static const String _queueKey = 'offline_receiving_queue';
  static const String _historyKey = 'offline_receiving_history';

  static Future<List<Map<String, dynamic>>> getQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final str = prefs.getString(_queueKey);
    if (str == null || str.isEmpty) return [];
    try {
      final List list = jsonDecode(str);
      return list.cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  static Future<void> enqueueReceipt(String marketlistId, Map<String, dynamic> payload) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = await getQueue();

    final item = {
      'client_request_id': payload['client_request_id'] ?? const Uuid().v4(),
      'marketlist_id': marketlistId,
      'payload': payload,
      'created_at': DateTime.now().toIso8601String(),
    };

    queue.add(item);
    await prefs.setString(_queueKey, jsonEncode(queue));
    await saveToHistory(item);
  }

  static Future<Map<String, dynamic>> syncQueue() async {
    final queue = await getQueue();
    if (queue.isEmpty) {
      return {'total': 0, 'synced': 0, 'failed': 0};
    }

    final remaining = <Map<String, dynamic>>[];
    int syncedCount = 0;
    int failedCount = 0;

    for (final item in queue) {
      try {
        final mlId = item['marketlist_id'];
        final payload = Map<String, dynamic>.from(item['payload']);
        payload['client_request_id'] = item['client_request_id'];

        await ApiService.post('/receiving/receipts/$mlId', payload);
        syncedCount++;
      } catch (err) {
        failedCount++;
        remaining.add(item);
      }
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_queueKey, jsonEncode(remaining));

    return {
      'total': queue.length,
      'synced': syncedCount,
      'failed': failedCount,
    };
  }

  static Future<void> saveToHistory(Map<String, dynamic> item) async {
    final prefs = await SharedPreferences.getInstance();
    final str = prefs.getString(_historyKey);
    List<dynamic> list = [];
    if (str != null && str.isNotEmpty) {
      try {
        list = jsonDecode(str);
      } catch (_) {}
    }
    list.insert(0, item);
    if (list.length > 50) {
      list = list.sublist(0, 50);
    }
    await prefs.setString(_historyKey, jsonEncode(list));
  }

  static Future<List<Map<String, dynamic>>> getHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final str = prefs.getString(_historyKey);
    if (str == null || str.isEmpty) return [];
    try {
      final List list = jsonDecode(str);
      return list.cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }
}
