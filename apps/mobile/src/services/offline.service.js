import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithAuth } from '../config/api';

function generateUUID() {
  return 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

class OfflineReceivingService {
  /**
   * Cache marketlists locally so receiver can open digital delivery notes offline
   */
  async cacheMarketlists(marketlists) {
    await AsyncStorage.setItem('cached_marketlists', JSON.stringify(marketlists));
  }

  async getCachedMarketlists() {
    const raw = await AsyncStorage.getItem('cached_marketlists');
    return raw ? JSON.parse(raw) : [];
  }

  /**
   * Submit goods receipt with offline fallback
   */
  async submitGoodsReceipt(marketlistId, receiptPayload) {
    // Generate idempotent client_request_id if not present
    if (!receiptPayload.client_request_id) {
      receiptPayload.client_request_id = generateUUID();
    }

    try {
      // Attempt online submission
      const response = await fetchWithAuth(`/marketlists/${marketlistId}/receipts`, {
        method: 'POST',
        body: JSON.stringify(receiptPayload)
      });

      // Save to local successful history
      await this.addToLocalHistory({
        ...response.data,
        synced_at: new Date().toISOString()
      });

      return {
        success: true,
        isOffline: false,
        data: response.data
      };
    } catch (error) {
      console.warn('[Offline Service] Network submission failed, queueing offline:', error.message);

      // Queue locally
      const queueItem = {
        marketlistId,
        payload: receiptPayload,
        queued_at: new Date().toISOString()
      };

      const existingQueue = await this.getPendingQueue();
      existingQueue.push(queueItem);
      await AsyncStorage.setItem('offline_receiving_queue', JSON.stringify(existingQueue));

      return {
        success: true,
        isOffline: true,
        message: 'Disimpan di antrean offline lokal. Akan disinkronkan saat koneksi tersedia.',
        data: {
          receipt_number: 'GR-OFFLINE-' + Date.now().toString().slice(-4),
          client_request_id: receiptPayload.client_request_id,
          status: 'pending_sync',
          ...receiptPayload
        }
      };
    }
  }

  async getPendingQueue() {
    const raw = await AsyncStorage.getItem('offline_receiving_queue');
    return raw ? JSON.parse(raw) : [];
  }

  async syncPendingQueue() {
    const queue = await this.getPendingQueue();
    if (queue.length === 0) return { syncedCount: 0 };

    const remainingQueue = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        await fetchWithAuth(`/marketlists/${item.marketlistId}/receipts`, {
          method: 'POST',
          body: JSON.stringify(item.payload)
        });
        syncedCount++;
      } catch (err) {
        remainingQueue.push(item);
      }
    }

    await AsyncStorage.setItem('offline_receiving_queue', JSON.stringify(remainingQueue));
    return { syncedCount, remainingCount: remainingQueue.length };
  }

  async addToLocalHistory(receipt) {
    const raw = await AsyncStorage.getItem('local_receipt_history');
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(receipt);
    await AsyncStorage.setItem('local_receipt_history', JSON.stringify(history.slice(0, 30)));
  }

  async getLocalHistory() {
    const raw = await AsyncStorage.getItem('local_receipt_history');
    return raw ? JSON.parse(raw) : [];
  }
}

export default new OfflineReceivingService();

