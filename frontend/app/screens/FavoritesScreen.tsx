import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppLanguage, VerseCardData } from "../types";
import { getCopy } from "../constants/copy";

type Props = {
  language: AppLanguage;
  items: VerseCardData[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => Promise<void>;
};

export function FavoritesScreen({ language, items, onOpen, onRemove }: Props) {
  const copy = getCopy(language);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{copy.favorites}</Text>
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{copy.noFavorites}</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Pressable testID={`favorite-open-${item.id}`} onPress={() => onOpen(item.id)}>
              <Text style={styles.date}>{item.verse_date}</Text>
              <Text style={styles.text} numberOfLines={2}>
                {item.verse_text}
              </Text>
              <Text style={styles.reference}>{item.reference}</Text>
            </Pressable>
            <Pressable testID={`favorite-remove-${item.id}`} onPress={() => void onRemove(item.id)} style={styles.removeBtn}>
              <Ionicons name="heart-dislike-outline" size={16} color="#9A202F" />
              <Text style={styles.removeText}>{copy.remove}</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

export default FavoritesScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 100, gap: 12 },
  title: { fontSize: 28, color: "#1A3150", fontWeight: "700" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    gap: 10,
    shadowColor: "#0F2746",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  date: { color: "#6A7D98", fontSize: 13, fontWeight: "600" },
  text: { color: "#1A3150", fontSize: 16, lineHeight: 24, fontWeight: "600", marginTop: 4 },
  reference: { color: "#5F7698", fontSize: 14, fontStyle: "italic", marginTop: 4 },
  removeBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEECEE",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  removeText: { color: "#9A202F", fontWeight: "700", fontSize: 12 },
  emptyCard: { borderRadius: 18, backgroundColor: "#FFFFFF", padding: 20 },
  emptyText: { color: "#556C8A", textAlign: "center", fontSize: 15 },
});
