import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { AuthScreen } from "./components/AuthScreen";
import { BottomTabBar, TabKey } from "./components/BottomTabBar";
import { getCopy } from "./constants/copy";
import { FavoritesScreen } from "./screens/FavoritesScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { api, setAuthToken } from "./services/api";
import { AppLanguage, SettingsPayload, UserProfile, VerseCardData, VerseHistoryItem } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const AUTH_TOKEN_KEY = "daily-verse-token";

export default function Index() {
  const [showSplash, setShowSplash] = useState(true);
  const [authToken, setAuthTokenState] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [verse, setVerse] = useState<VerseCardData | null>(null);
  const [history, setHistory] = useState<VerseHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<VerseCardData[]>([]);
  const [settings, setSettings] = useState<SettingsPayload>({
    default_language: "en",
    notification_time: "06:00",
    theme: "light",
    timezone: "UTC",
    notification_enabled: true,
  });
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const copy = useMemo(() => getCopy(language), [language]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2300);
    return () => clearTimeout(timer);
  }, []);

  const loadSession = useCallback(async (token: string) => {
    try {
      setBusy(true);
      setAuthToken(token);
      setAuthTokenState(token);

      const profile = await api.me();
      const lang = profile.default_language;
      const [today, historyRows, favoriteRows, profileSettings] = await Promise.all([
        api.todayVerse(lang),
        api.history(lang),
        api.favorites(lang),
        api.settings(),
      ]);

      setUser(profile);
      setLanguage(lang);
      setVerse(today);
      setHistory(historyRows);
      setFavorites(favoriteRows);
      setSettings(profileSettings);

      await api.markReading(today.id, today.verse_date);
      await registerPushToken();
    } catch {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthToken("");
      setAuthTokenState("");
      setUser(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const savedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (savedToken) {
        await loadSession(savedToken);
      }
    };
    void bootstrap();
  }, [loadSession]);

  const registerPushToken = async () => {
    if (!Device.isDevice) return;
    const permission = await Notifications.getPermissionsAsync();
    let finalStatus = permission.status;

    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== "granted") return;

    const pushToken = await Notifications.getExpoPushTokenAsync();
    if (pushToken.data) {
      await api.registerPushToken(pushToken.data);
    }
  };

  const handleAuthResponse = async (token: string) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    await loadSession(token);
  };

  const onSignIn = async (email: string, password: string) => {
    try {
      setAuthBusy(true);
      setError("");
      if (!email || !password) {
        setError("Please enter email and password.");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setError("Please enter a valid email address.");
        return;
      }
      const data = await api.login(email, password);
      await handleAuthResponse(data.access_token);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Login failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const onSignUp = async (name: string, email: string, password: string) => {
    try {
      setAuthBusy(true);
      setError("");
      if (!name || !email || !password) {
        setError("Please fill name, email, and password.");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setError("Please enter a valid email address.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      const data = await api.signup(name, email, password);
      await handleAuthResponse(data.access_token);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Signup failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const refreshForLanguage = async (nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    setSettings((prev) => ({ ...prev, default_language: nextLanguage }));
    const [today, historyRows, favoriteRows] = await Promise.all([
      api.todayVerse(nextLanguage),
      api.history(nextLanguage),
      api.favorites(nextLanguage),
    ]);
    setVerse(today);
    setHistory(historyRows);
    setFavorites(favoriteRows);
  };

  const onFavorite = async () => {
    if (!verse) return;
    await api.toggleFavorite(verse.id);
    const [today, favoriteRows] = await Promise.all([api.todayVerse(language), api.favorites(language)]);
    setVerse(today);
    setFavorites(favoriteRows);
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      const updated = await api.refreshVerse(language);
      setVerse(updated);
      const historyRows = await api.history(language);
      setHistory(historyRows);
      await api.markReading(updated.id, updated.verse_date);
      const streak = await api.streak();
      setUser((prev) => (prev ? { ...prev, streak: streak.streak } : prev));
    } finally {
      setRefreshing(false);
    }
  };

  const onOpenVerse = async (id: string) => {
    const fullVerse = await api.verseById(id);
    setVerse(fullVerse);
    await api.markReading(fullVerse.id, fullVerse.verse_date);
    const streak = await api.streak();
    setUser((prev) => (prev ? { ...prev, streak: streak.streak } : prev));
    setActiveTab("home");
  };

  const removeFavorite = async (id: string) => {
    await api.toggleFavorite(id);
    const rows = await api.favorites(language);
    setFavorites(rows);
    if (verse?.id === id) {
      setVerse({ ...verse, is_favorite: false });
    }
  };

  const saveSettings = async () => {
    const payload = {
      ...settings,
      default_language: language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    };
    const updated = await api.updateSettings(payload);
    setSettings(updated);
    setLanguage(updated.default_language);
    await refreshForLanguage(updated.default_language);
    Alert.alert("Saved", "Your settings are updated.");
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken("");
    setAuthTokenState("");
    setUser(null);
    setVerse(null);
    setHistory([]);
    setFavorites([]);
  };

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!authToken || !user) {
    return <AuthScreen loading={authBusy} error={error} onSignIn={onSignIn} onSignUp={onSignUp} />;
  }

  if (busy) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.loadingText}>Loading your devotional space...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, settings.theme === "dark" && styles.safeDark]}>
      <View style={styles.body}>
        {activeTab === "home" && (
          <HomeScreen
            verse={verse}
            language={language}
            streak={user.streak}
            isRefreshing={refreshing}
            onLanguageChange={(next) => void refreshForLanguage(next)}
            onFavorite={onFavorite}
            onRefresh={onRefresh}
            onOpenSettings={() => setActiveTab("settings")}
          />
        )}

        {activeTab === "history" && <HistoryScreen language={language} items={history} onOpen={(id) => void onOpenVerse(id)} />}

        {activeTab === "favorites" && (
          <FavoritesScreen
            language={language}
            items={favorites}
            onOpen={(id) => void onOpenVerse(id)}
            onRemove={removeFavorite}
          />
        )}

        {activeTab === "settings" && (
          <SettingsScreen
            language={language}
            settings={settings}
            saving={false}
            onChangeLanguage={(value) => setSettings((prev) => ({ ...prev, default_language: value }))}
            onChangeTheme={(value) => setSettings((prev) => ({ ...prev, theme: value }))}
            onChangeTime={(value) => setSettings((prev) => ({ ...prev, notification_time: value }))}
            onToggleNotification={(value) => setSettings((prev) => ({ ...prev, notification_enabled: value }))}
            onSave={saveSettings}
            onTestPush={async () => {
              const result = await api.sendTestPush();
              Alert.alert("Push", `${result.sent_count} notification sent`);
            }}
            onDailyPush={async () => {
              const result = await api.sendDailyPush();
              Alert.alert("Daily Push", `${result.sent_count} notifications sent`);
            }}
            onLogout={logout}
          />
        )}
      </View>

      <BottomTabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        labels={{
          home: copy.home,
          history: copy.history,
          favorites: copy.favorites,
          settings: copy.settings,
        }}
      />
    </SafeAreaView>
  );
}

function SplashScreen() {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 850 });
    scale.value = withTiming(1, { duration: 850 });
  }, [opacity, scale]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  return (
    <LinearGradient colors={["#0B1730", "#2A4E85", "#E2B867"]} style={styles.centered}>
      <Animated.View style={[styles.splashInner, style]}>
        <Ionicons name="sparkles-outline" size={34} color="#F7D17B" />
        <Text style={styles.splashTitle}>Daily Verse</Text>
        <Text style={styles.splashSub}>Today&apos;s God&apos;s Word</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F8FF" },
  safeDark: { backgroundColor: "#091226" },
  body: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#3C567A", fontSize: 16 },
  splashInner: { alignItems: "center", gap: 8 },
  splashTitle: { color: "#FFFFFF", fontSize: 34, fontWeight: "700" },
  splashSub: { color: "#EAF1FF", fontSize: 16 },
});
