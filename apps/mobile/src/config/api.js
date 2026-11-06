import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// In Android Emulator, localhost is 10.0.2.2; on physical device or web it can be custom LAN IP
const DEFAULT_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api/v1'
    : 'http://localhost:5000/api/v1';

let customApiBase = null;

export const setApiBaseUrl = async (url) => {
  customApiBase = url;
  await AsyncStorage.setItem('baraja_api_base', url);
};

export const getApiBaseUrl = async () => {
  if (customApiBase) return customApiBase;
  const stored = await AsyncStorage.getItem('baraja_api_base');
  if (stored) {
    customApiBase = stored;
    return stored;
  }
  return DEFAULT_API_BASE;
};

export async function fetchWithAuth(endpoint, options = {}) {
  const baseUrl = await getApiBaseUrl();
  const token = await AsyncStorage.getItem('baraja_mobile_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
    }

    return json;
  } catch (error) {
    throw error;
  }
}
