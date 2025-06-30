import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  AppState,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar'; // ← IMPORTANTE

const DEFAULT_URL = 'https://expo.dev/accounts/flylegion/snacks';

export default function SnackBrowser() {
  const appState = useRef(AppState.currentState);
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const isAllowedUrl = (url) => {
    try {
      const allowedDomains = [
        'snack.expo.dev',
        'expo.dev',
        'auth.expo.dev',
        'accounts.google.com',
        'githubusercontent.com',
      ];
      const hostname = new URL(url).hostname;
      return allowedDomains.some(domain => hostname.endsWith(domain));
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const loadInitialTab = async () => {
      const savedUrl = await AsyncStorage.getItem('lastSnackURL');
      const initialUrl = savedUrl || DEFAULT_URL;
      const newTab = {
        id: Date.now(),
        url: initialUrl,
        key: `webview-${Date.now()}`,
      };
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      setIsReady(true);
    };
    loadInitialTab();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        const activeTab = tabs.find(tab => tab.id === activeTabId);
        if (activeTab?.url) {
          await AsyncStorage.setItem('lastSnackURL', activeTab.url);
        }
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [tabs, activeTabId]);

  const handleNavigation = (tabId, navState) => {
    const updatedTabs = tabs.map(tab =>
      tab.id === tabId ? { ...tab, url: navState.url } : tab
    );
    setTabs(updatedTabs);
    if (tabId === activeTabId) {
      AsyncStorage.setItem('lastSnackURL', navState.url);
    }
  };

  const handleNewTab = () => {
    const timestamp = Date.now();
    const newTab = {
      id: timestamp,
      url: DEFAULT_URL,
      key: `webview-${timestamp}`,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (id) => {
    const remaining = tabs.filter(tab => tab.id !== id);
    setTabs(remaining);
    if (activeTabId === id && remaining.length > 0) {
      setActiveTabId(remaining[remaining.length - 1].id);
    } else if (remaining.length === 0) {
      handleNewTab();
    }
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  if (!isReady || !activeTab) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#00ffcc" size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar backgroundColor="#1e1e1e" style="light" /> {/* ← AÑADIDO */}
      <View style={styles.container}>
        <View style={styles.webviewContainer}>
          {tabs.map((tab) => (
            <View key={tab.key} style={[styles.webviewWrapper, tab.id === activeTabId ? styles.visible : styles.hidden]}>
              <WebView
                source={{ uri: tab.url }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                setSupportMultipleWindows={false}
                onNavigationStateChange={(navState) => handleNavigation(tab.id, navState)}
                onShouldStartLoadWithRequest={(request) => isAllowedUrl(request.url)}
                injectedJavaScript={`
                  (function() {
                    window.open = function(url) {
                      window.location.href = url;
                    };
                    document.addEventListener('DOMContentLoaded', function () {
                      const links = document.querySelectorAll('a[target="_blank"]');
                      links.forEach(link => {
                        link.addEventListener('click', function(e) {
                          e.preventDefault();
                          window.location.href = link.href;
                        });
                      });
                    });
                  })();
                  true;
                `}
              />
            </View>
          ))}
        </View>

        <View style={styles.tabBarContainer}>
          <ScrollView horizontal contentContainerStyle={styles.tabBarContent}>
            {tabs.map((tab) => (
              <View key={tab.id} style={styles.tab}>
                <TouchableOpacity onPress={() => setActiveTabId(tab.id)}>
                  <Text style={tab.id === activeTabId ? styles.activeTabText : styles.tabText}>
                    Tab {tab.id.toString().slice(-4)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleCloseTab(tab.id)}>
                  <Text style={styles.close}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={handleNewTab} style={styles.newTab}>
              <Text style={styles.newTabText}>＋</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={{ height: 48 }} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    paddingTop: 36,
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webviewWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  visible: {
    zIndex: 1,
  },
  hidden: {
    zIndex: 0,
    opacity: 0,
  },
  loading: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBarContainer: {
    backgroundColor: '#222',
  },
  tabBarContent: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
    backgroundColor: '#333',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabText: {
    color: '#ccc',
    marginRight: 4,
    fontSize: 12,
  },
  activeTabText: {
    color: '#00ffcc',
    fontWeight: 'bold',
    marginRight: 4,
    fontSize: 12,
  },
  close: {
    color: '#f66',
    fontSize: 12,
  },
  newTab: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#444',
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  newTabText: {
    color: '#fff',
    fontSize: 16,
  },
});