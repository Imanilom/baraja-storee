import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import authService from '../services/auth.service';
import { setApiBaseUrl, getApiBaseUrl } from '../config/api';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('receiver@baraja.com');
  const [password, setPassword] = useState('receiver123');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [customIp, setCustomIp] = useState('');

  const handleLogin = async (overrideEmail = null, overridePass = null) => {
    const targetEmail = overrideEmail || email;
    const targetPass = overridePass || password;

    if (!targetEmail || !targetPass) {
      Alert.alert('Perhatian', 'Email dan password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const user = await authService.login(targetEmail, targetPass);
      Alert.alert('Sukses', `Selamat datang, ${user.name}!`);
      onLoginSuccess(user);
    } catch (err) {
      Alert.alert('Login Gagal', err.message || 'Periksa koneksi jaringan dan kredensial.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiBase = async () => {
    if (!customIp) return;
    let url = customIp.trim();
    if (!url.startsWith('http')) url = 'http://' + url;
    if (!url.includes('/api/v1')) url = url + '/api/v1';
    await setApiBaseUrl(url);
    Alert.alert('Server Diperbarui', `API URL: ${url}`);
    setShowConfig(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo & Brand */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>BJ</Text>
          </View>
          <Text style={styles.appName}>Baraja Receiving</Text>
          <Text style={styles.appTagline}>Dokumen Surat Jalan Digital & Verifikasi Fisik</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Masuk Petugas Gudang</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="receiver@baraja.com"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => handleLogin()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>Masuk ke Sistem</Text>
            )}
          </TouchableOpacity>

          {/* Quick Demo Receiver & Purchasing Login */}
          <View style={styles.demoSection}>
            <Text style={styles.demoLabel}>AKSES CEPAT PETUGAS & PURCHASING:</Text>
            <TouchableOpacity
              style={styles.demoBtn}
              onPress={() => handleLogin('receiver@baraja.com', 'receiver123')}
            >
              <Text style={styles.demoBtnText}>⚡ Masuk sebagai Receiver Gudang</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, { marginTop: 8, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }]}
              onPress={() => handleLogin('purchasing@baraja.com', 'purchasing123')}
            >
              <Text style={[styles.demoBtnText, { color: '#0f172a' }]}>📝 Masuk sebagai Purchasing Staff</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Server IP Config Toggle */}
        <TouchableOpacity
          style={styles.configToggle}
          onPress={() => setShowConfig(!showConfig)}
        >
          <Text style={styles.configToggleText}>⚙️ Pengaturan IP Server Backend</Text>
        </TouchableOpacity>

        {showConfig && (
          <View style={styles.configBox}>
            <Text style={styles.configLabel}>IP Komputer / Emulator:</Text>
            <TextInput
              style={styles.configInput}
              placeholder="Contoh: 192.168.1.10:5000"
              value={customIp}
              onChangeText={setCustomIp}
            />
            <TouchableOpacity style={styles.saveIpBtn} onPress={handleSaveApiBase}>
              <Text style={styles.saveIpText}>Simpan Host API</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 4
  },
  logoText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900'
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5
  },
  appTagline: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 14
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a'
  },
  loginBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  demoSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  demoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    letterSpacing: 0.5
  },
  demoBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  demoBtnText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '700'
  },
  configToggle: {
    marginTop: 20,
    alignItems: 'center'
  },
  configToggleText: {
    color: '#94a3b8',
    fontSize: 12
  },
  configBox: {
    marginTop: 12,
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10
  },
  configLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    marginBottom: 6
  },
  configInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    marginBottom: 8
  },
  saveIpBtn: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center'
  },
  saveIpText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  }
});

