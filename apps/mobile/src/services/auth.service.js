import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithAuth, getApiBaseUrl } from '../config/api';

class MobileAuthService {
  async login(email, password) {
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.message || json?.error || 'Login gagal.');
    }

    const { user, tokens } = json.data;
    await AsyncStorage.setItem('baraja_mobile_token', tokens.accessToken);
    await AsyncStorage.setItem('baraja_mobile_refresh', tokens.refreshToken);
    await AsyncStorage.setItem('baraja_mobile_user', JSON.stringify(user));

    return user;
  }

  async logout() {
    await AsyncStorage.removeItem('baraja_mobile_token');
    await AsyncStorage.removeItem('baraja_mobile_refresh');
    await AsyncStorage.removeItem('baraja_mobile_user');
  }

  async getCurrentUser() {
    const raw = await AsyncStorage.getItem('baraja_mobile_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

export default new MobileAuthService();
