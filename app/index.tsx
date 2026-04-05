import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import Icon from "react-native-vector-icons/Ionicons";
import CustomSplash from "./splash"; // Import your custom splash
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";

export default function Index() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { user, isLoading, logout } = useAuth();

  // Handle Auth redirection
  useEffect(() => {
    if (isReady && !isLoading && !user) {
      router.replace("/login" as any);
    }
  }, [isReady, isLoading, user]);

  // Show splash screen while loading
  if (!isReady || isLoading) {
    return <CustomSplash onFinish={() => setIsReady(true)} />;
  }
  const handleSearch = async (query?: string) => {
    const q = query || searchQuery;
    if (q.trim() !== "") {
      setLoading(true);
      try {
        const response = await fetch(
          `https://nutritionapi.aarambhtech.in/?action=search&q=${encodeURIComponent(q)}`,
        );
        const data = await response.json();
        Keyboard.dismiss();
        if (data.success) {
          router.push({
            pathname: "/info",
            params: { query: q, results: JSON.stringify(data.results) },
          });
        } else {
          alert("No results found");
        }
      } catch (error) {
        console.error("Search error:", error);
        alert("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const suggestions = [
    "Vada Pav",
    "Pizza",
    "Burger",
    "Biryani",
    "Samosa",
    "Pav Bhaji",
    "Noodles",
    "Ice Cream",
  ];

  return (
    <LinearGradient
      colors={["#0d5ef5", "#4ECDC4"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" />

      {/* Logout button at Top Left */}
      <TouchableOpacity 
        onPress={logout}
        style={styles.logoutButton}
      >
        <Icon name="log-out-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Logo at Top */}
      <Animatable.View
        animation="bounceIn"
        duration={1200}
        style={styles.logoContainer}
      >
        <Animatable.Image
          source={require("../assets/images/nutri_app_logo_white.png")}
          style={styles.logo}
          resizeMode="contain"
          animation="pulse"
          iterationCount="infinite"
          duration={2000}
        />
      </Animatable.View>

      {/* Search Bar */}
      <Animatable.View
        animation="fadeInUp"
        delay={300}
        style={styles.searchContainer}
      >
        <Icon
          name="search-outline"
          size={24}
          color="#fff"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for dish or scan barcode"
          placeholderTextColor="rgba(255, 255, 255, 0.7)"
          cursorColor="#fff"
          selectionColor="#fff"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => handleSearch()}
          returnKeyType="search"
          editable={!loading}
        />
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <TouchableOpacity onPress={() => router.push("/scanner" as any)}>
            <Icon name="camera-outline" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </Animatable.View>

      {/* Search Suggestions Text */}
      <Animatable.View
        animation="fadeInUp"
        delay={600}
        style={styles.suggestionsContainer}
      >
        <TouchableOpacity onPress={() => handleSearch("Vada Pav")}>

        </TouchableOpacity>

        <View style={styles.suggestionChips}>
          {suggestions.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.chip}
              onPress={() => handleSearch(item)}
            >
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animatable.View>

      {/* View My Calories Button */}
      <Animatable.View
        animation="fadeInUp"
        delay={900}
        style={styles.historyBtnContainer}
      >
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => router.push("/history")}
        >
          <Icon name="calendar-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.historyButtonText}>View My Calories</Text>
        </TouchableOpacity>
      </Animatable.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoutButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 80,
    marginBottom: 20,
  },
  logo: {
    width: 180,
    height: 180,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 5,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    paddingVertical: 12,
    fontWeight: "400",
    letterSpacing: 0.5,
  },
  suggestionsContainer: {
    marginTop: 10,
  },
  suggestionsText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 15,
    fontWeight: "500",
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  chipText: {
    color: "#fff",
    fontSize: 14,
  },
  historyBtnContainer: {
    marginTop: 30,
    alignItems: "center",
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  historyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
