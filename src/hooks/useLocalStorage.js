import { useState, useEffect } from "react";

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — fail silently, reading still works
    }
  }, [key, value]);

  return [value, setValue];
}

/**
 * Produces a stable-ish key for a given PDF file so bookmarks/progress
 * can be associated with "this book" across sessions without a backend.
 */
export function fileIdentity(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
