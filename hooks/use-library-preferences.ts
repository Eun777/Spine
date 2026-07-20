"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_LIBRARY_PREFERENCES,
  libraryPreferencesService,
} from "@/lib/library-preferences";
import type { LibraryPreferences } from "@/lib/types";

export function useLibraryPreferences(showToast: (message: string, duration?: number) => void) {
  const [preferences, setPreferences] = useState<LibraryPreferences>(DEFAULT_LIBRARY_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);
  const [storage, setStorage] = useState<"local" | "supabase">("local");

  useEffect(() => {
    fetch("/api/library-preferences")
      .then((response) => response.json())
      .then((data) => {
        if (data.storage === "supabase") {
          setStorage("supabase");
          setPreferences(libraryPreferencesService.normalize(data.preferences));
        } else {
          setPreferences(libraryPreferencesService.getLocal());
        }
      })
      .catch(() => setPreferences(libraryPreferencesService.getLocal()));
  }, []);

  const savePreferences = useCallback(async (nextPreferences: LibraryPreferences) => {
    const normalized = libraryPreferencesService.normalize(nextPreferences);
    setIsSaving(true);

    try {
      const response = await fetch("/api/library-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || "Could not save library details");

      if (data.storage === "supabase") {
        setStorage("supabase");
        setPreferences(libraryPreferencesService.normalize(data.preferences));
      } else {
        setPreferences(libraryPreferencesService.saveLocal(normalized));
      }

      showToast("Library details updated");
      return true;
    } catch (error) {
      if (storage === "local") setPreferences(libraryPreferencesService.saveLocal(normalized));
      showToast(error instanceof Error ? error.message : "Could not save library details", 2600);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [showToast, storage]);

  return {
    preferences,
    isSaving,
    savePreferences,
  };
}
