import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type TabKey = "home" | "history" | "favorites" | "settings";

type TabItem = {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  labels: Record<TabKey, string>;
};

export function BottomTabBar({ activeTab, onChange, labels }: Props) {
  const items: TabItem[] = [
    { key: "home", label: labels.home, icon: "home-outline" },
    { key: "history", label: labels.history, icon: "time-outline" },
    { key: "favorites", label: labels.favorites, icon: "heart-outline" },
    { key: "settings", label: labels.settings, icon: "settings-outline" },
  ];

  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const active = item.key === activeTab;
        return (
          <Pressable
            testID={`tab-${item.key}`}
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.itemPressed]}
          >
            <Ionicons name={active ? item.icon.replace("-outline", "") as keyof typeof Ionicons.glyphMap : item.icon} size={20} color={active ? "#1F3C63" : "#6A7A92"} />
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default BottomTabBar;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 8,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: "#0F2746",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    borderRadius: 16,
    gap: 3,
  },
  itemActive: { backgroundColor: "#E9F2FF" },
  itemPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  label: { fontSize: 12, color: "#6A7A92" },
  labelActive: { color: "#1F3C63", fontWeight: "700" },
});
