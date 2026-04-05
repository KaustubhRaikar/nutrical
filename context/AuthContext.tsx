import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import CryptoJS from 'crypto-js';

const API_BASE_URL = 'https://nutritionapi.aarambhtech.in/';
const API_SECRET = 'nutrical_secret_2c0m6'; 

type User = {
  id: string;
  email: string;
  token?: string;
} | null;

interface AuthContextType {
  user: User;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  recordSearch: (query: string) => Promise<void>;
  generateSecurityHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);
  const startTime = useRef<number>(Date.now());
  const appState = useRef(AppState.currentState);

  const generateSecurityHeaders = () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = CryptoJS.HmacSHA256(timestamp, API_SECRET).toString();
    
    const headers: Record<string, string> = {
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
    };

    if (user && user.token) {
      headers['X-SESSION-TOKEN'] = user.token;
    }

    return headers;
  };

  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        // Use SecureStore for the whole session in production
        const storedUser = await SecureStore.getItemAsync('user_session');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Failed to load user session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredUser();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        recordUsage();
      } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        startTime.current = Date.now();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      recordUsage();
    };
  }, [user]);

  const recordUsage = async () => {
    if (!user || !user.token) return;
    
    const now = Date.now();
    const duration = Math.floor((now - startTime.current) / 1000);
    const startIso = new Date(startTime.current).toISOString().slice(0, 19).replace('T', ' ');
    const endIso = new Date(now).toISOString().slice(0, 19).replace('T', ' ');
    const date = new Date().toISOString().slice(0, 10);

    if (duration < 5) return;

    try {
      const response = await fetch(`${API_BASE_URL}?action=record_usage`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...generateSecurityHeaders()
        },
        body: JSON.stringify({
          user_id: user.id,
          start_time: startIso,
          end_time: endIso,
          duration: duration,
          date: date
        })
      });
      const data = await response.json();
      if (data.message === 'Invalid session') {
        logout(); // Force logout if session is invalid
      }
    } catch (e) {
      console.error('Usage log error:', e);
    }
  };

  const login = async (email: string, password: string) => {
    const deviceName = Platform.OS + ' ' + (Constants.deviceName || 'Device');
    const deviceId = Constants.installationId || 'unknown';

    try {
      const response = await fetch(`${API_BASE_URL}?action=login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...generateSecurityHeaders()
        },
        body: JSON.stringify({ email, password, device_name: deviceName, device_id: deviceId })
      });
      
      const data = await response.json();
      if (data.success) {
        const loggedUser = { id: data.id.toString(), email: data.email, token: data.session_token };
        // Save SECURELY
        await SecureStore.setItemAsync('user_session', JSON.stringify(loggedUser));
        setUser(loggedUser);
        startTime.current = Date.now();
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error: any) {
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}?action=register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...generateSecurityHeaders()
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (data.success) {
        await login(email, password);
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (error: any) {
      throw error;
    }
  };

  const recordSearch = async (query: string) => {
    if (!user || !user.token) return;
    try {
      const response = await fetch(`${API_BASE_URL}?action=record_search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...generateSecurityHeaders()
        },
        body: JSON.stringify({ user_id: user.id, q: query })
      });
      const data = await response.json();
      if (data.message === 'Invalid session') {
        logout();
      }
    } catch (e) {
      console.error('Search log error:', e);
    }
  };

  const logout = async () => {
    await recordUsage();
    await SecureStore.deleteItemAsync('user_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, recordSearch, generateSecurityHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
