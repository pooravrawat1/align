import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Profile } from "./types";
import { ProfileEditor } from "./profileEditor";

export function clearSessionProfileDrafts(sessionId: string | null) {
  if (!sessionId) return;
  try {
    const prefix = `align-profile-draft:v1:${sessionId}:`;
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* The in-memory owner is disposed when the session changes. */ }
}

export function useProfileEditor(profile: Profile, sessionId: string | null) {
  const editor = useMemo(() => {
    let storage: Storage | undefined;
    try { storage = sessionStorage; } catch { /* The editor retains an in-memory draft. */ }
    return new ProfileEditor(profile, sessionId, storage);
    // Profile updates rebase the existing owner; only identity changes replace it.
  }, [profile.id, sessionId]);
  const previous = useRef(editor);
  useEffect(() => {
    if (previous.current !== editor) previous.current.dispose();
    previous.current = editor;
    editor.rebase(profile);
  }, [editor, profile]);
  const snapshot = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  return { editor, snapshot };
}
