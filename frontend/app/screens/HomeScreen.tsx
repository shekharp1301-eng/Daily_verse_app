import { useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import { Alert, ImageBackground, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { getCopy } from "../constants/copy";
import { VERSE_BG_IMAGE } from "../constants/images";
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
  type ShareShotRef = { capture: () => Promise<string> };

  const copy = getCopy(language);
  const portraitShareRef = useRef<ShareShotRef | null>(null);
  const squareShareRef = useRef<ShareShotRef | null>(null);
  const shareResultType: "tmpfile" | "data-uri" = Platform.OS === "web" ? "data-uri" : "tmpfile";

  const trimText = (value: string, maxLength: number) => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength).trimEnd()}...`;
  };

  const shareCard = async (size: "portrait" | "square") => {
    if (!verse) return;

    try {
      const targetRef = size === "portrait" ? portraitShareRef.current : squareShareRef.current;
      if (!targetRef) {
        throw new Error("Share template not ready");
      }

      const uri = await targetRef.capture();

      if (Platform.OS === "web" && uri.startsWith("data:image")) {
        const doc = globalThis.document;
        if (doc) {
          const link = doc.createElement("a");
          link.href = uri;
          link.download = `daily-verse-${size}.png`;
          doc.body.appendChild(link);
          link.click();
          doc.body.removeChild(link);
          Alert.alert("Image downloaded", "Your devotional image is ready to share.");
          return;
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: "Share Daily Verse" });
        return;
      }

      await Share.share({
        title: "Daily Verse",
        url: uri,
      });
      return;
    } catch (error) {
      console.warn("Image share failed:", error);
      Alert.alert("Image share failed", "Couldn’t generate share image. Please try again.");
    }
  };

  const onShare = async () => {
    if (!verse) return;
    Alert.alert("Share as Image", "Choose devotional card size", [
      { text: "Portrait", onPress: () => void shareCard("portrait") },
      { text: "Square", onPress: () => void shareCard("square") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const today = new Date().toLocaleDateString(language === "te" ? "te-IN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const shareVerse = verse
    ? {
        verseText: trimText(verse.verse_text, 260),
        explanation: trimText(verse.explanation, 180),
        message: trimText(verse.message, 140),
        prayer: trimText(verse.prayer, 180),
      }
    : null;

  return (
    <>
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

      {verse && shareVerse ? (
        <View style={styles.hiddenRenderArea} pointerEvents="none">
          <ViewShot
            ref={portraitShareRef}
            style={styles.shareCanvasPortrait}
            options={{ format: "png", quality: 1, result: shareResultType }}
            collapsable={false}
          >
            <ShareCardTemplate
              verse={verse}
              verseText={shareVerse.verseText}
              explanation={shareVerse.explanation}
              message={shareVerse.message}
              prayer={shareVerse.prayer}
              language={language}
              today={today}
              square={false}
            />
          </ViewShot>

          <ViewShot
            ref={squareShareRef}
            style={styles.shareCanvasSquare}
            options={{ format: "png", quality: 1, result: shareResultType }}
            collapsable={false}
          >
            <ShareCardTemplate
              verse={verse}
              verseText={shareVerse.verseText}
              explanation={shareVerse.explanation}
              message={shareVerse.message}
              prayer={shareVerse.prayer}
              language={language}
              today={today}
              square
            />
          </ViewShot>
        </View>
      ) : null}
    </>
  );
}

export default HomeScreen;

function ShareCardTemplate({
  verse,
  verseText,
  explanation,
  message,
  prayer,
  language,
  today,
  square,
}: {
  verse: VerseCardData;
  verseText: string;
  explanation: string;
  message: string;
  prayer: string;
  language: AppLanguage;
  today: string;
  square: boolean;
}) {
  const copy = getCopy(language);

  return (
    <ImageBackground source={{ uri: VERSE_BG_IMAGE }} resizeMode="cover" style={styles.shareBg}>
      <LinearGradient
        colors={["rgba(7,16,30,0.25)", "rgba(7,16,30,0.88)"]}
        style={[styles.shareOverlay, square && styles.shareOverlaySquare]}
      >
        <View style={styles.shareTopRow}>
          <View style={styles.shareBrandPill}>
            <Ionicons name="sparkles-outline" size={14} color="#FFD88A" />
            <Text style={styles.shareBrandText}>Daily Verse</Text>
          </View>
          <Text style={styles.shareDate}>{today}</Text>
        </View>

        <View style={[styles.shareVerseBlock, square && styles.shareVerseBlockSquare]}>
          <Text style={[styles.shareVerseText, square && styles.shareVerseTextSquare]}>{verseText}</Text>
          <Text style={styles.shareReference}>{verse.reference}</Text>
        </View>

        <View style={styles.shareSectionCard}>
          <Text style={styles.shareSectionTitle}>{copy.explanation}</Text>
          <Text style={styles.shareSectionBody}>{explanation}</Text>
        </View>

        <View style={styles.shareSectionCardWarm}>
          <Text style={styles.shareSectionTitle}>{copy.message}</Text>
          <Text style={styles.shareSectionBody}>{message}</Text>
        </View>

        <View style={styles.shareSectionCard}>
          <Text style={styles.shareSectionTitle}>{copy.prayer}</Text>
          <Text style={[styles.shareSectionBody, styles.sharePrayer]}>{prayer}</Text>
        </View>

        <Text style={styles.shareFooter}>Daily Verse • Today&apos;s God&apos;s Word</Text>
      </LinearGradient>
    </ImageBackground>
  );
}

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
  hiddenRenderArea: {
    position: "absolute",
    left: -6000,
    top: -6000,
  },
  shareCanvasPortrait: {
    width: 900,
    height: 1600,
  },
  shareCanvasSquare: {
    width: 900,
    height: 900,
    marginTop: 20,
  },
  shareBg: {
    width: "100%",
    height: "100%",
  },
  shareOverlay: {
    flex: 1,
    padding: 56,
    gap: 20,
    justifyContent: "flex-start",
  },
  shareOverlaySquare: {
    padding: 44,
    gap: 14,
  },
  shareTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shareBrandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,216,138,0.65)",
    backgroundColor: "rgba(21,33,55,0.66)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shareBrandText: {
    color: "#FFE4A9",
    fontWeight: "700",
    fontSize: 16,
  },
  shareDate: {
    color: "#DFE9FF",
    fontSize: 15,
    fontWeight: "600",
  },
  shareVerseBlock: {
    marginTop: 16,
    gap: 12,
  },
  shareVerseBlockSquare: {
    marginTop: 8,
  },
  shareVerseText: {
    color: "#FFFFFF",
    fontSize: 50,
    lineHeight: 68,
    fontWeight: "700",
  },
  shareVerseTextSquare: {
    fontSize: 42,
    lineHeight: 56,
  },
  shareReference: {
    color: "#DFE9FF",
    fontSize: 24,
    fontStyle: "italic",
  },
  shareSectionCard: {
    borderRadius: 22,
    backgroundColor: "rgba(18,31,52,0.68)",
    borderWidth: 1,
    borderColor: "rgba(209,226,255,0.22)",
    padding: 18,
    gap: 10,
  },
  shareSectionCardWarm: {
    borderRadius: 22,
    backgroundColor: "rgba(180,126,38,0.23)",
    borderWidth: 1,
    borderColor: "rgba(255,217,152,0.52)",
    padding: 18,
    gap: 10,
  },
  shareSectionTitle: {
    color: "#FFF5DD",
    fontSize: 24,
    fontWeight: "700",
  },
  shareSectionBody: {
    color: "#EFF5FF",
    fontSize: 24,
    lineHeight: 34,
  },
  sharePrayer: {
    fontStyle: "italic",
  },
  shareFooter: {
    marginTop: "auto",
    textAlign: "center",
    color: "#D5E4FF",
    fontSize: 20,
    fontWeight: "600",
  },
  loadingWrap: {
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    marginTop: 20,
  },
  loadingText: { color: "#4B607D", fontSize: 16 },
});
