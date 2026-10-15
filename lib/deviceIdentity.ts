import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'device_id';

/**
 * Retrieves or generates a unique, persistent installation UUID for the device.
 * Persisted in hardware-backed SecureStore.
 */
export async function getDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const newId = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
    return newId;
  } catch (error) {
    console.error('Error accessing device_id in SecureStore:', error);
    return 'fallback-' + Crypto.randomUUID();
  }
}

/**
 * Retrieves device human-readable model and OS name using expo-device.
 */
export function getDeviceName(): string {
  const model = Device.deviceName || Device.modelName || 'Device';
  return `${Platform.OS} ${model}`.trim();
}
