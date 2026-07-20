import type { LibraryPreferences } from "./types";

export const DEFAULT_LIBRARY_PREFERENCES: LibraryPreferences = {
  title: "My library",
  subtitle: "Every shelf tells a story. Keep yours close.",
};

const LOCAL_KEY = "spine-library-preferences";
const MAX_TITLE_LENGTH = 80;
const MAX_SUBTITLE_LENGTH = 180;

export class LibraryPreferencesService {
  normalize(input: unknown): LibraryPreferences {
    if (!input || typeof input !== "object") return DEFAULT_LIBRARY_PREFERENCES;
    const value = input as Partial<LibraryPreferences>;

    return {
      title: this.cleanText(value.title, DEFAULT_LIBRARY_PREFERENCES.title, MAX_TITLE_LENGTH),
      subtitle: this.cleanText(value.subtitle, DEFAULT_LIBRARY_PREFERENCES.subtitle, MAX_SUBTITLE_LENGTH),
    };
  }

  getLocal(): LibraryPreferences {
    if (typeof window === "undefined") return DEFAULT_LIBRARY_PREFERENCES;
    try {
      return this.normalize(JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"));
    } catch {
      return DEFAULT_LIBRARY_PREFERENCES;
    }
  }

  saveLocal(preferences: LibraryPreferences) {
    const normalized = this.normalize(preferences);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }

  private cleanText(value: unknown, fallback: string, maxLength: number) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim().slice(0, maxLength);
    return trimmed || fallback;
  }
}

export const libraryPreferencesService = new LibraryPreferencesService();
