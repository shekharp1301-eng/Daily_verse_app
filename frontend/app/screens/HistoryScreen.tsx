import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppLanguage, VerseHistoryItem } from "../types";
import { getCopy } from "../constants/copy";

type Props = {
  language: AppLanguage;
  items: VerseHistoryItem[];
  onOpen: (id: string) => void;
};

export function HistoryScreen({ language, items, onOpen }: Props) {
  const copy = getCopy(language);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{copy.history}</Text>
      {items.length === 0 ? (
        <EmptyCard text={copy.noHistory} />
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onOpen(item.id)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.date}>{item.verse_date}</Text>
              <View style={styles.themeBadge}>
                <Text style={styles.themeText}>{item.theme}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={styles.preview}>
              {item.verse_preview}
            </Text>
            <Text style={styles.reference}>{item.reference}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

export default HistoryScreen;

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 100, gap: 12 },
  title: { fontSize: 28, color: "#1A3150", fontWeight: "700" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    gap: 7,
    shadowColor: "#0F2746",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { color: "#2C4568", fontSize: 14, fontWeight: "600" },
  themeBadge: {
    backgroundColor: "#EAF3FF",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  themeText: { color: "#2A4B78", fontSize: 12, fontWeight: "700" },
  preview: { color: "#192E4C", fontSize: 16, fontWeight: "600" },
  reference: { color: "#6880A1", fontSize: 14, fontStyle: "italic" },
  cardPressed: { opacity: 0.8 },
  emptyCard: {
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  emptyText: { color: "#556C8A", textAlign: "center", fontSize: 15 },
});
