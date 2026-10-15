import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiFetch, setApiSession, setOnUnauthorized, AuthSession } from '../lib/apiClient';
import { getDeviceId, getDeviceName } from '../lib/deviceIdentity';

export type User = AuthSession | null;

interface AuthContextType {
  user: User;
  isLoading: boolean;
  isPremium: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  recordSearch: (query: string) => Promise<void>;
  togglePremiumForTesting: () => Promise<void>;
}

interface LoginApiResponse {
  success: boolean;
  id: number | string;
  email: string;
  is_premium?: boolean;
  session_token: string;
  signing_key: string;
  message?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [devPremiumOverride, setDevPremiumOverride] = useState<boolean | null>(null);
  const startTime = useRef<number>(Date.now());
  const appState = useRef(AppState.currentState);

  const purgeSessionLocally = async () => {
    try {
      await SecureStore.deleteItemAsync('user_session');
    } catch (e) {
      console.error('Error clearing secure user_session:', e);
    }
    setApiSession(null);
    setUser(null);
  };

  useEffect(() => {
    // 1. Hook up central 401 unauthorized / invalid session listener
    setOnUnauthorized(async () => {
      await purgeSessionLocally();
    });

    // 2. Load stored session and validate signing_key presence
    const loadStoredUser = async () => {
      try {
        const storedOverride = await AsyncStorage.getItem('@dev_premium_override');
        if (storedOverride !== null) {
          try {
            setDevPremiumOverride(JSON.parse(storedOverride));
          } catch {
            // ignore parse error
          }
        }

        const storedUser = await SecureStore.getItemAsync('user_session');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          // If stored session lacks signing_key (legacy v1 session), purge it
          if (!parsed || !parsed.signing_key || !parsed.token) {
            await purgeSessionLocally();
          } else {
            setUser(parsed);
            setApiSession(parsed);
          }
        }
      } catch (error) {
        console.error('Failed to load user session from SecureStore:', error);
        await purgeSessionLocally();
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredUser();

    // 3. Monitor active/background state transitions for usage duration telemetry
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
  }, []);

  const recordUsage = async () => {
    if (!user || !user.token) return;

    const now = Date.now();
    const duration = Math.floor((now - startTime.current) / 1000);
    const startIso = new Date(startTime.current).toISOString().slice(0, 19).replace('T', ' ');
    const endIso = new Date(now).toISOString().slice(0, 19).replace('T', ' ');
    const date = new Date().toISOString().slice(0, 10);

    if (duration < 5) return;

    try {
      await apiFetch('record_usage', {
        method: 'POST',
        body: {
          user_id: user.id,
          start_time: startIso,
          end_time: endIso,
          duration,
          date,
        },
      });
    } catch (e) {
      console.error('Usage log telemetry error:', e);
    }
  };

  const login = async (email: string, password: string) => {
    const deviceId = await getDeviceId();
    const deviceName = getDeviceName();

    try {
      const data = await apiFetch<LoginApiResponse>('login', {
        method: 'POST',
        body: {
          email,
          password,
          device_name: deviceName,
          device_id: deviceId,
        },
      });

      if (data && data.session_token && data.signing_key) {
        const loggedUser: User = {
          id: data.id.toString(),
          email: data.email,
          token: data.session_token,
          signing_key: data.signing_key,
          is_premium: !!data.is_premium,
        };

        await SecureStore.setItemAsync('user_session', JSON.stringify(loggedUser));
        setApiSession(loggedUser);
        setUser(loggedUser);
        startTime.current = Date.now();
      } else {
        throw new Error(data?.message || 'Login failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      await apiFetch('register', {
        method: 'POST',
        body: { email, password },
      });
      await login(email, password);
    } catch (error) {
      throw error;
    }
  };

  const recordSearch = async (query: string) => {
    if (!user || !user.token) return;
    try {
      await apiFetch('record_search', {
        method: 'POST',
        body: { user_id: user.id, q: query },
      });
    } catch (e) {
      console.error('Search telemetry error:', e);
    }
  };

  const logout = async () => {
    try {
      await recordUsage();
    } catch {
      // Best-effort
    }

    try {
      await apiFetch('logout', { method: 'POST' });
    } catch {
      // Best-effort remote session revocation
    }

    await purgeSessionLocally();
  };

  const isPremium = devPremiumOverride !== null ? devPremiumOverride : !!user?.is_premium;

  const togglePremiumForTesting = async () => {
    const nextVal = !isPremium;
    setDevPremiumOverride(nextVal);
    await AsyncStorage.setItem('@dev_premium_override', JSON.stringify(nextVal));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isPremium,
        login,
        register,
        logout,
        recordSearch,
        togglePremiumForTesting,
      }}
    >
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
