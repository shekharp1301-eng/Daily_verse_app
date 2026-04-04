import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { AppLanguage, SettingsPayload, ThemeMode } from "../types";
import { getCopy } from "../constants/copy";

type Props = {
  language: AppLanguage;
  settings: SettingsPayload;
  saving: boolean;
  onChangeLanguage: (value: AppLanguage) => void;
  onChangeTheme: (value: ThemeMode) => void;
  onChangeTime: (value: string) => void;
  onToggleNotification: (value: boolean) => void;
  onSave: () => Promise<void>;
  onTestPush: () => Promise<void>;
  onDailyPush: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export function SettingsScreen({
  language,
  settings,
  saving,
  onChangeLanguage,
  onChangeTheme,
  onChangeTime,
  onToggleNotification,
  onSave,
  onTestPush,
  onDailyPush,
  onLogout,
}: Props) {
  const copy = getCopy(language);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{copy.settings}</Text>

      <SettingBlock label={copy.language}>
        <DualToggle
          value={settings.default_language}
          left={{ key: "en", label: "EN" }}
          right={{ key: "te", label: "తెలుగు" }}
          onChange={onChangeLanguage}
        />
      </SettingBlock>

      <SettingBlock label={copy.theme}>
        <DualToggle
          value={settings.theme}
          left={{ key: "light", label: copy.light }}
          right={{ key: "dark", label: copy.dark }}
          onChange={onChangeTheme}
        />
      </SettingBlock>

      <SettingBlock label={copy.notificationTime}>
        <TextInput
          value={settings.notification_time}
          onChangeText={onChangeTime}
          placeholder="06:00"
          keyboardType="numbers-and-punctuation"
          style={styles.timeInput}
        />
      </SettingBlock>

      <View style={styles.switchRow}>
        <Text style={styles.label}>{copy.notificationEnabled}</Text>
        <Switch
          value={settings.notification_enabled}
          onValueChange={onToggleNotification}
          trackColor={{ false: "#C8D4E8", true: "#7DA8E6" }}
          thumbColor="#FFFFFF"
        />
      </View>

      <PrimaryButton label={copy.saveSettings} onPress={onSave} loading={saving} />
      <GhostButton label={copy.sendTest} onPress={onTestPush} />
      <GhostButton label={copy.sendDaily} onPress={onDailyPush} />
      <GhostButton label={copy.logout} onPress={onLogout} danger />
    </ScrollView>
  );
}

export default SettingsScreen;

function SettingBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function DualToggle<T extends string>({
  value,
  left,
  right,
  onChange,
}: {
  value: T;
  left: { key: T; label: string };
  right: { key: T; label: string };
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.dualWrap}>
      {[left, right].map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [styles.dualItem, active && styles.dualItemActive, pressed && styles.pressed]}
          >
            <Text style={[styles.dualText, active && styles.dualTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PrimaryButton({ label, onPress, loading }: { label: string; onPress: () => Promise<void>; loading?: boolean }) {
  return (
    <Pressable onPress={() => void onPress()} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <Text style={styles.primaryText}>{loading ? "Saving..." : label}</Text>
    </Pressable>
  );
}

function GhostButton({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => Promise<void>;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={() => void onPress()}
      style={({ pressed }) => [styles.ghost, danger && styles.ghostDanger, pressed && styles.pressed]}
    >
      <Text style={[styles.ghostText, danger && styles.ghostTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110, gap: 14 },
  title: { fontSize: 28, color: "#1A3150", fontWeight: "700" },
  block: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 10,
    shadowColor: "#0F2746",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  label: { color: "#304A71", fontSize: 16, fontWeight: "600" },
  dualWrap: { flexDirection: "row", gap: 10 },
  dualItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C9D5E8",
    alignItems: "center",
    justifyContent: "center",
  },
  dualItemActive: { backgroundColor: "#1F3C63", borderColor: "#1F3C63" },
  dualText: { color: "#516887", fontWeight: "600" },
  dualTextActive: { color: "#FFFFFF" },
  timeInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C9D5E8",
    minHeight: 44,
    paddingHorizontal: 12,
    color: "#1A3150",
    fontSize: 16,
  },
  switchRow: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  primary: {
    borderRadius: 999,
    minHeight: 50,
    backgroundColor: "#1F3C63",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  ghost: {
    borderRadius: 999,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#C9D5E8",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  ghostDanger: { borderColor: "#F2C5CA", backgroundColor: "#FFF4F5" },
  ghostText: { color: "#32507A", fontWeight: "700" },
  ghostTextDanger: { color: "#922D39" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
