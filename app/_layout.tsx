import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { AuthProvider } from "../context/AuthContext";
import { initSyncService } from "../lib/sync";

export default function RootLayout() {
  useEffect(() => {
    const cleanup = initSyncService();
    return cleanup;
  }, []);
  return (
    <AuthProvider>
      <Stack initialRouteName="index">
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="info" options={{ headerShown: false }} />
        <Stack.Screen name="scanner" options={{ headerShown: false }} />
        <Stack.Screen name="barcode_info" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ headerShown: false }} />
        <Stack.Screen name="goals" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="analytics" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
