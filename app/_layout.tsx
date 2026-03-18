import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="info" options={{ headerShown: false }} />
      <Stack.Screen name="scanner" options={{ headerShown: false }} />
      <Stack.Screen name="barcode_info" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ headerShown: false }} />
    </Stack>
  );
}
