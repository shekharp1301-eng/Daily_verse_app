import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { getCopy } from "../constants/copy";
import { AppLanguage, VerseCardData } from "../types";
import { VerseCard } from "../components/VerseCard";

type Props = {
  verse: VerseCardData | null;
  language: AppLanguage;
  streak: number;
  isRefreshing: boolean;
  onLanguageChange: (language: AppLanguage) => void;
  onFavorite: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onOpenSettings: () => void;
};

export function HomeScreen({
  verse,
  language,
  streak,
  isRefreshing,
  onLanguageChange,
  onFavorite,
  onRefresh,
  onOpenSettings,
}: Props) {
  const copy = getCopy(language);

  const onShare = async () => {
    if (!verse) return;
    await Share.share({
      title: "Daily Verse",
      message: `${verse.verse_text}\n\n${verse.reference}\n\n${verse.message}`,
    });
  };

  const today = new Date().toLocaleDateString(language === "te" ? "te-IN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.date}>{today}</Text>
          <View style={styles.streakRow}>
            <Ionicons name="flame-outline" size={14} color="#A86C18" />
            <Text style={styles.streakLabel}>{copy.streak}: {streak}</Text>
          </View>
        </View>
        <View style={styles.rightHeader}>
          <View style={styles.toggleRow}>
            {(["en", "te"] as AppLanguage[]).map((item) => {
              const active = language === item;
              return (
                <Pressable
                  testID={`language-toggle-${item}`}
                  key={item}
                  onPress={() => onLanguageChange(item)}
                  style={[styles.togglePill, active && styles.toggleActive]}
                >
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{item.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable testID="open-settings-button" onPress={onOpenSettings} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color="#1F3C63" />
          </Pressable>
        </View>
      </View>

      {verse ? (
        <>
          <VerseCard verse={verse} />

          <Section title={copy.explanation} body={verse.explanation} />
          <Section title={copy.message} body={verse.message} highlighted />
          <Section title={copy.prayer} body={verse.prayer} italic />

          <View style={styles.actionRow}>
            <CircleAction
              label={copy.favorite}
              icon={verse.is_favorite ? "heart" : "heart-outline"}
              onPress={onFavorite}
              active={verse.is_favorite}
              testID="home-favorite-button"
            />
            <CircleAction label={copy.share} icon="share-social-outline" onPress={onShare} testID="home-share-button" />
            <CircleAction
              label={copy.refresh}
              icon="refresh-outline"
              onPress={onRefresh}
              loading={isRefreshing}
              testID="home-refresh-button"
            />
          </View>
        </>
      ) : (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading today&apos;s verse...</Text>
        </View>
      )}
    </ScrollView>
  );
}

export default HomeScreen;

function Section({
  title,
  body,
  highlighted,
  italic,
}: {
  title: string;
  body: string;
  highlighted?: boolean;
  italic?: boolean;
}) {
  return (
    <View style={[styles.section, highlighted && styles.highlighted]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={[styles.sectionBody, italic && styles.italic]}>{body}</Text>
    </View>
  );
}

function CircleAction({
  label,
  icon,
  onPress,
  loading,
  active,
  testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  active?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={loading}
      testID={testID}
      style={({ pressed }) => [styles.actionBtn, active && styles.actionBtnActive, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={20} color={active ? "#9A202F" : "#2D4264"} />
      <Text style={styles.actionText}>{loading ? "..." : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110, gap: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 18, color: "#1D3557", fontWeight: "600" },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  streakLabel: { color: "#4B607D", fontSize: 14 },
  rightHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleRow: { flexDirection: "row", gap: 6 },
  togglePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C8D4E8",
    minWidth: 46,
    minHeight: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleActive: { backgroundColor: "#1F3C63", borderColor: "#1F3C63" },
  toggleText: { color: "#4D607E", fontWeight: "600", fontSize: 12 },
  toggleTextActive: { color: "#FFFFFF" },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F1FF",
  },
  section: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 8,
    shadowColor: "#16335B",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 2,
  },
  highlighted: { backgroundColor: "#FFF8E7" },
  sectionTitle: { fontSize: 20, color: "#1A3150", fontWeight: "700" },
  sectionBody: { fontSize: 16, color: "#2F4569", lineHeight: 24 },
  italic: { fontStyle: "italic" },
  actionRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 6 },
  actionBtn: {
    width: 92,
    minHeight: 92,
    borderRadius: 999,
    backgroundColor: "#F7FAFF",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    shadowColor: "#0F2746",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  actionBtnActive: { backgroundColor: "#FEECEE" },
  actionText: { fontSize: 12, color: "#2D4264", fontWeight: "600", textAlign: "center" },
  actionPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  loadingWrap: {
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    marginTop: 20,
  },
  loadingText: { color: "#4B607D", fontSize: 16 },
});
