export type AppLanguage = "en" | "te";
export type ThemeMode = "light" | "dark";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  default_language: AppLanguage;
  notification_time: string;
  theme: ThemeMode;
  timezone: string;
  streak: number;
}

export interface VerseCardData {
  id: string;
  verse_date: string;
  language: AppLanguage;
  verse_text: string;
  reference: string;
  theme: string;
  explanation: string;
  message: string;
  prayer: string;
  image_hint: string;
  is_favorite: boolean;
}

export interface VerseHistoryItem {
  id: string;
  verse_date: string;
  language: AppLanguage;
  verse_preview: string;
  reference: string;
  theme: string;
}

export interface SettingsPayload {
  default_language: AppLanguage;
  notification_time: string;
  theme: ThemeMode;
  timezone: string;
  notification_enabled: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export default function TypesRoutePlaceholder() {
  return null;
}
