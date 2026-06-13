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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
