import { useEffect } from "react";
import { StyleSheet, Text, View, ImageBackground } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { VerseCardData } from "../types";
import { VERSE_BG_IMAGE } from "../constants/images";

type Props = {
  verse: VerseCardData;
};

export function VerseCard({ verse }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    translateY.value = withTiming(0, { duration: 400 });
  }, [opacity, translateY, verse.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.cardWrap, animatedStyle]}>
      <ImageBackground
        source={{ uri: VERSE_BG_IMAGE }}
        resizeMode="cover"
        imageStyle={styles.image}
        style={styles.imageContainer}
        blurRadius={2}
      >
        <LinearGradient colors={["rgba(11,22,38,0.2)", "rgba(11,22,38,0.78)"]} style={styles.overlay}>
          <Text style={styles.verseText}>{verse.verse_text}</Text>
          <Text style={styles.reference}>{verse.reference}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{verse.theme}</Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Animated.View>
  );
}

export default VerseCard;

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 14,
  },
  imageContainer: {
    minHeight: 280,
  },
  image: { borderRadius: 24 },
  overlay: {
    flex: 1,
    padding: 20,
    justifyContent: "flex-end",
    gap: 10,
  },
  verseText: {
    fontSize: 26,
    lineHeight: 34,
    color: "#FFFFFF",
    fontWeight: "700",
    textShadowColor: "rgba(255,255,255,0.4)",
    textShadowRadius: 8,
  },
  reference: { color: "#E0E8FA", fontSize: 16, fontStyle: "italic" },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(246, 198, 99, 0.24)",
    borderColor: "rgba(246, 198, 99, 0.8)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: "#FFE4AA", fontWeight: "700", fontSize: 12 },
});
