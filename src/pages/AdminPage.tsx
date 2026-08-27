import { useState } from "react";
import { isAdminAuthed } from "../lib/auth";
import { AboutEditor } from "./admin/AboutEditor";
import {
  AdminLayout,
  hashToSection,
  type SectionId,
} from "./admin/AdminLayout";
import { ChatEditor } from "./admin/ChatEditor";
import { ContactEditor } from "./admin/ContactEditor";
import { CredentialsEditor } from "./admin/CredentialsEditor";
import { HeroEditor } from "./admin/HeroEditor";
import { HistoryPanel } from "./admin/HistoryPanel";
import { InboxEditor } from "./admin/InboxEditor";
import { PasswordGate } from "./admin/PasswordGate";
import { ProjectsEditor } from "./admin/ProjectsEditor";
import { SkillsEditor } from "./admin/SkillsEditor";
import { ToolsPanel } from "./admin/ToolsPanel";

export function AdminPage() {
  const [authed, setAuthed] = useState(isAdminAuthed);
  const [section, setSection] = useState<SectionId>(() =>
    typeof window !== "undefined" ? hashToSection() : "hero"
  );

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return (
    <AdminLayout
      active={section}
      onChange={setSection}
      onLogout={() => setAuthed(false)}
    >
      {section === "hero" && <HeroEditor />}
      {section === "about" && <AboutEditor />}
      {section === "skills" && <SkillsEditor />}
      {section === "projects" && <ProjectsEditor />}
      {section === "credentials" && <CredentialsEditor />}
      {section === "contact" && <ContactEditor />}
      {section === "inbox" && <InboxEditor />}
      {section === "chat" && <ChatEditor />}
      {section === "history" && <HistoryPanel />}
      {section === "tools" && <ToolsPanel />}
    </AdminLayout>
  );
}
