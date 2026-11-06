import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView, ActivityIndicator } from 'react-native';
import authService from './src/services/auth.service';
import BottomNav from './src/components/BottomNav';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import MarketlistScreen from './src/screens/MarketlistScreen';
import ReceivingScreen from './src/screens/ReceivingScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedMarketlistId, setSelectedMarketlistId] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch (err) {
        console.warn('Auth check error:', err);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />
      </SafeAreaView>
    );
  }

  const navigateToReceivingWithMl = (mlId) => {
    setSelectedMarketlistId(mlId);
    setActiveTab('receiving');
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            user={currentUser}
            onNavigateToReceiving={navigateToReceivingWithMl}
            onNavigateToMarketlist={() => setActiveTab('marketlist')}
          />
        );
      case 'marketlist':
        return (
          <MarketlistScreen
            onSelectMarketlist={(mlId) => navigateToReceivingWithMl(mlId)}
          />
        );
      case 'receiving':
        return (
          <ReceivingScreen
            marketlistId={selectedMarketlistId}
            user={currentUser}
            onFinish={() => setActiveTab('history')}
          />
        );
      case 'history':
        return <HistoryScreen />;
      case 'profile':
        return (
          <ProfileScreen
            user={currentUser}
            onLogout={() => {
              setCurrentUser(null);
              setActiveTab('home');
            }}
          />
        );
      default:
        return <HomeScreen user={currentUser} onNavigateToReceiving={navigateToReceivingWithMl} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.container}>{renderActiveScreen()}</View>
      <BottomNav activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  centerLoading: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
