import { useState } from "react";
import { isAdminAuthed } from "../lib/auth";
import { PasswordGate } from "../pages/admin/PasswordGate";

/**
 * Wraps a route in the admin sign-in gate. If already authed (session
 * token present) it renders children; otherwise it shows the same
 * Word-style sign-in dialog used by /admin and swaps to children on
 * success. No redirect — the URL you asked for is the URL you get.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => isAdminAuthed());
  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;
  return <>{children}</>;
}
