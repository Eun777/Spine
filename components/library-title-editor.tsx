"use client";

import { useEffect, useState } from "react";
import type { LibraryPreferences } from "@/lib/types";

type LibraryTitleEditorProps = {
  preferences: LibraryPreferences;
  isSaving: boolean;
  onSave: (preferences: LibraryPreferences) => Promise<boolean>;
};

export default function LibraryTitleEditor({
  preferences,
  isSaving,
  onSave,
}: LibraryTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(preferences);

  useEffect(() => {
    if (!isEditing) setDraft(preferences);
  }, [isEditing, preferences]);

  async function save() {
    const saved = await onSave(draft);
    if (saved) setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <div className="library-title-block">
        <p className="eyebrow">Your personal collection</p>
        <div className="library-title-row">
          <h1>{preferences.title}</h1>
          <button className="inline-edit-button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        </div>
        <p className="lede">{preferences.subtitle}</p>
      </div>
    );
  }

  return (
    <div className="library-title-block library-title-editor">
      <p className="eyebrow">Your personal collection</p>
      <label>
        Library name
        <input
          value={draft.title}
          maxLength={80}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="My library"
        />
      </label>
      <label>
        Subtitle
        <textarea
          value={draft.subtitle}
          maxLength={180}
          rows={2}
          onChange={(event) => setDraft((current) => ({ ...current, subtitle: event.target.value }))}
          placeholder="Every shelf tells a story. Keep yours close."
        />
      </label>
      <div className="inline-edit-actions">
        <button className="secondary" onClick={() => { setDraft(preferences); setIsEditing(false); }}>
          Cancel
        </button>
        <button className="primary" disabled={isSaving} onClick={save}>
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
