import { useCallback, useEffect, useState } from "react";
import {
  CONTENT_EVENT,
  getContent,
  resetSection,
  saveSection,
  type SiteContent,
} from "../../lib/content";

/**
 * Auto-saving hook for a single section of SiteContent.
 *
 * Returns the current value of `section` and a setter that persists every change
 * to localStorage. Cross-tab updates (storage events) and admin-internal updates
 * (CONTENT_EVENT) are picked up automatically so multiple editors stay in sync.
 */
export function useEditableSection<K extends keyof SiteContent>(section: K) {
  const [value, setValue] = useState<SiteContent[K]>(() => getContent()[section]);

  useEffect(() => {
    const refresh = () => setValue(getContent()[section]);
    window.addEventListener(CONTENT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CONTENT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [section]);

  const update = useCallback(
    (next: SiteContent[K]) => {
      setValue(next);
      saveSection(section, next);
    },
    [section]
  );

  const reset = useCallback(() => {
    const defaultValue = resetSection(section);
    setValue(defaultValue);
  }, [section]);

  return { value, update, reset };
}
