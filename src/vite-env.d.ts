/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * SHA-256 hex digest of the admin password. Compared against the hash of
   * whatever the user types into the password gate at /admin. The plaintext
   * password is never embedded in the bundle.
   *
   * Generate via the in-app Setup screen at /admin when this is unset, then
   * paste the hash into .env.local and restart `npm run dev`.
   */
  readonly VITE_ADMIN_PASSWORD_HASH?: string;

  /**
   * Supabase project URL — same as SUPABASE_URL but VITE-prefixed so it can
   * reach the client bundle. Enables Realtime subscriptions on `site_content`
   * so the live site updates within seconds of an admin save anywhere.
   */
  readonly VITE_SUPABASE_URL?: string;

  /**
   * Supabase ANON (public) key. Safe to ship in the bundle: it can only do
   * what Row Level Security policies allow. The migration grants SELECT and
   * nothing else.
   */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
