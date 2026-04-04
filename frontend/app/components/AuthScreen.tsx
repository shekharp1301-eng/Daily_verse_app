import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  loading: boolean;
  error: string;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
};

export function AuthScreen({ loading, error, onSignIn, onSignUp }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    if (isLogin) {
      await onSignIn(email.trim(), password);
      return;
    }
    await onSignUp(name.trim(), email.trim(), password);
  };

  return (
    <LinearGradient colors={["#0E1A2B", "#1B3D6E", "#DCA94E"]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardArea}
      >
        <View style={styles.card}>
          <Ionicons name="sparkles-outline" size={30} color="#F6D37A" style={styles.icon} />
          <Text style={styles.title}>Daily Verse</Text>
          <Text style={styles.subtitle}>Today&apos;s God&apos;s Word</Text>

          {!isLogin && (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor="#8A9BB2"
              style={styles.input}
            />
          )}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#8A9BB2"
            style={styles.input}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            placeholderTextColor="#8A9BB2"
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, loading && styles.disabled]}
          >
            <Text style={styles.primaryText}>{loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}</Text>
          </Pressable>

          <Pressable onPress={() => setIsLogin((prev) => !prev)} style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isLogin ? "New here? Create account" : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

export default AuthScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  keyboardArea: { flex: 1, justifyContent: "center", paddingHorizontal: 22 },
  card: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  icon: { textAlign: "center" },
  title: { fontSize: 32, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#D8E8FF", textAlign: "center", marginBottom: 6 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "rgba(10,22,40,0.65)",
    color: "#FFFFFF",
    paddingHorizontal: 14,
  },
  error: { color: "#FFD1D1", textAlign: "center", fontSize: 13 },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#F2C462",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#1D2B44", fontWeight: "700", fontSize: 16 },
  switchRow: { paddingVertical: 8, alignItems: "center" },
  switchText: { color: "#E6EDFF", fontSize: 14 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.6 },
});
