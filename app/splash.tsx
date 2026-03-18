import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";

// Keep the native splash screen visible while we prepare
SplashScreen.preventAutoHideAsync();

export default function CustomSplash({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.3);

  useEffect(() => {
    // Animate logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Hide splash screen after 2 seconds and call onFinish
    const timer = setTimeout(async () => {
      await SplashScreen.hideAsync();
      if (onFinish) onFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={["#ffffff", "#f0f0f0"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require("../assets/images/nutri_card_flash.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 200,
    height: 200,
  },
});
