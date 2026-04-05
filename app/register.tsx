import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import Icon from "react-native-vector-icons/Ionicons";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleRegister = async () => {
    if (name.trim() === "" || email.trim() === "" || password.trim() === "") {
      alert("Please fill all the details");
      return;
    }
    
    setLoading(true);
    try {
      await register(email, password);
      router.replace("/");
    } catch (error: any) {
      console.error("Register error:", error);
      alert(error.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient
          colors={["#0d5ef5", "#4ECDC4"]}
          style={styles.container}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <StatusBar barStyle="light-content" />
            
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Icon name="arrow-back-outline" size={30} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Animatable.View
                animation="bounceIn"
                duration={1500}
                style={styles.logoContainer}
              >
                <Icon name="person-add-outline" size={70} color="#fff" />
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join NutriCal for personalized health tracking</Text>
              </Animatable.View>

              <Animatable.View
                animation="fadeInUp"
                delay={300}
                style={styles.inputContainer}
              >
                <View style={styles.inputWrapper}>
                  <Icon name="person-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Icon name="mail-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Icon name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                <TouchableOpacity 
                  style={styles.registerButton} 
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#0d5ef5" />
                  ) : (
                    <Text style={styles.registerButtonText}>CREATE ACCOUNT</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.loginLink}
                  onPress={() => router.back()}
                >
                  <Text style={styles.loginText}>
                    Already have an account? <Text style={styles.loginBold}>Log In</Text>
                  </Text>
                </TouchableOpacity>
              </Animatable.View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 35,
    fontWeight: "800",
    color: "#fff",
    marginTop: 10,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 5,
    textAlign: "center",
  },
  inputContainer: {
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 15,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#fff",
    paddingVertical: 15,
    fontSize: 16,
  },
  registerButton: {
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  registerButtonText: {
    color: "#0d5ef5",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  loginLink: {
    marginTop: 25,
    alignItems: "center",
  },
  loginText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
  },
  loginBold: {
    color: "#fff",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});
