import Constants from "expo-constants";
import {
  AppLanguage,
  AuthResponse,
  SettingsPayload,
  UserProfile,
  VerseCardData,
  VerseHistoryItem,
} from "../types";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const fromConfig = extra.backendUrl;
const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;

const resolvedBaseUrl =
  fromConfig && !fromConfig.includes("${") ? fromConfig : fromEnv;

const API_BASE = `${resolvedBaseUrl}/api`;

let authToken = "";

export const setAuthToken = (token: string) => {
  authToken = token;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = "Request failed";
    try {
      const parsed = JSON.parse(raw);
      message = parsed.detail ?? parsed.message ?? message;
    } catch {
      message = raw || message;
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  signup: (name: string, email: string, password: string) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<UserProfile>("/auth/me"),

  todayVerse: (language: AppLanguage) =>
    request<VerseCardData>(`/verse/today?language=${language}`),

  verseById: (verseId: string) => request<VerseCardData>(`/verse/${verseId}`),

  refreshVerse: (language: AppLanguage) =>
    request<VerseCardData>("/verse/refresh", {
      method: "POST",
      body: JSON.stringify({ language }),
    }),

  history: (language: AppLanguage) =>
    request<VerseHistoryItem[]>(`/history?language=${language}&limit=30`),

  favorites: (language: AppLanguage) =>
    request<VerseCardData[]>(`/favorites?language=${language}`),

  toggleFavorite: (verseId: string) =>
    request<{ saved: boolean }>(`/favorites/${verseId}`, { method: "POST" }),

  markReading: (verseId: string, verseDate: string) =>
    request<{ streak: number }>("/readings/mark", {
      method: "POST",
      body: JSON.stringify({ verse_id: verseId, verse_date: verseDate }),
    }),

  streak: () => request<{ streak: number }>("/streak"),

  settings: () => request<SettingsPayload>("/settings"),

  updateSettings: (payload: SettingsPayload) =>
    request<SettingsPayload>("/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  registerPushToken: (token: string) =>
    request<{ sent_count: number }>("/push/register", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  sendTestPush: () => request<{ sent_count: number }>("/push/send-test", { method: "POST" }),

  sendDailyPush: () => request<{ sent_count: number }>("/push/send-daily", { method: "POST" }),
};

export default api;
