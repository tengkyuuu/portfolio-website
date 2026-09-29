import { useEffect, useState } from "react";
import { AUTH_LOST_EVENT } from "../lib/api";
import { getAuthMode, isAdminAuthed, setAdminUser } from "../lib/auth";
import { syncFromServer } from "../lib/content";
import { fetchMe } from "../lib/team-api";
import { AboutEditor } from "./admin/AboutEditor";
import { ActivityEditor } from "./admin/ActivityEditor";
import {
  AdminLayout,
  hashToSection,
  type SectionId,
} from "./admin/AdminLayout";
import { BlogEditor } from "./admin/BlogEditor";
import { ChatEditor } from "./admin/ChatEditor";
import { ContactEditor } from "./admin/ContactEditor";
import { CredentialsEditor } from "./admin/CredentialsEditor";
import { GalleryEditor } from "./admin/GalleryEditor";
import { HeroEditor } from "./admin/HeroEditor";
import { HistoryPanel } from "./admin/HistoryPanel";
import { InboxEditor } from "./admin/InboxEditor";
import { PasswordGate } from "./admin/PasswordGate";
import { ProjectsEditor } from "./admin/ProjectsEditor";
import { SkillsEditor } from "./admin/SkillsEditor";
import { TeamPanel } from "./admin/TeamPanel";
import { ToolsPanel } from "./admin/ToolsPanel";

const SESSION_LOST =
  "Your session ended — it expired, or the document owner changed your access. Sign in again to keep editing.";

export function AdminPage() {
  const [authed, setAuthed] = useState(isAdminAuthed);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState<SectionId>(() =>
    typeof window !== "undefined" ? hashToSection() : "hero"
  );

  // Any refused request clears the session (see clearStaleAdminAuth);
  // follow it back to the sign-in screen instead of failing saves quietly.
  useEffect(() => {
    const onLost = () => {
      setNotice(SESSION_LOST);
      setAuthed(false);
    };
    window.addEventListener(AUTH_LOST_EVENT, onLost);
    return () => window.removeEventListener(AUTH_LOST_EVENT, onLost);
  }, []);

  // Re-check the session when the console opens and whenever the tab comes
  // back. An admin the owner just removed finds out here, not on the next
  // save — and a renamed admin sees their new name.
  useEffect(() => {
    if (!authed || getAuthMode() !== "server") return;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      void fetchMe().then((r) => {
        if (r.ok) setAdminUser(r.data.user);
      });
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [authed]);

  // Editors start from what is published, never from this browser's
  // cache or the shipped defaults. The cache can be days old, or missing
  // (a new admin, a new device), or ignored after a deploy changes the
  // defaults — and an edit made on top of any of those re-published every
  // other section as that stale copy had it.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setLoaded(false);
    void syncFromServer().finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  if (!authed) {
    return (
      <PasswordGate
        notice={notice}
        onAuth={() => {
          setNotice(null);
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <AdminLayout
      active={section}
      onChange={setSection}
      onLogout={() => setAuthed(false)}
    >
      {!loaded && (
        <p role="status" className="font-ui text-[13px] text-ink-subtle">
          Loading the published document…
        </p>
      )}
      {loaded && section === "hero" && <HeroEditor />}
      {loaded && section === "activity" && <ActivityEditor />}
      {loaded && section === "about" && <AboutEditor />}
      {loaded && section === "skills" && <SkillsEditor />}
      {loaded && section === "projects" && <ProjectsEditor />}
      {loaded && section === "gallery" && <GalleryEditor />}
      {loaded && section === "blog" && <BlogEditor />}
      {loaded && section === "credentials" && <CredentialsEditor />}
      {loaded && section === "contact" && <ContactEditor />}
      {loaded && section === "inbox" && <InboxEditor />}
      {loaded && section === "chat" && <ChatEditor />}
      {loaded && section === "history" && <HistoryPanel />}
      {loaded && section === "team" && <TeamPanel />}
      {loaded && section === "tools" && <ToolsPanel />}
    </AdminLayout>
  );
}
