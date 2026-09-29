# Invitations

Open **Admin → Invitations**. Add up to ten addresses, edit the subject and message, then choose **Preview invitation**. The preview uses the same HTML and plain text that the server sends. Recipients are deduplicated, and each gets a separate email.

## Use Gmail now

Without a custom sending domain, preview the invitation and choose **Open in Gmail** for each person. Gmail opens a plain-text draft with the invitation and portfolio link. Select your Gmail account, review it, and send it there. Opening the draft does not send anything.

The current website URL is `https://engrjamescalunsag.vercel.app`. Use `jamescalunsag13@gmail.com` as the Reply-To address for future Resend emails.

## Enable Resend

Resend requires a domain you own and verify. An `@gmail.com` address cannot be your Resend sender. The `onboarding@resend.dev` test sender can only reach the email associated with your Resend account. See [verified domains](https://resend.com/docs/dashboard/domains/introduction) and [test sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Set these server environment variables locally in `.env.local` and in your Vercel project:

```dotenv
SITE_URL=https://engrjamescalunsag.vercel.app
RESEND_API_KEY=your-key
RESEND_FROM="James Calunsag <hello@your-verified-domain.com>"
RESEND_REPLY_TO=jamescalunsag13@gmail.com
```

Restart `npm run dev` locally, or redeploy on Vercel. `RESEND_FROM` above is a placeholder; replace it after verifying your own domain. Never prefix the key with `VITE_`.

Once configured, the preview enables **Send invitations**. A successful API response means Resend accepted the emails; delivery and bounce information remain in the Resend dashboard. No visitor or admin accounts are created by these invitations.

## Implementation

- The authenticated operation is `GET/POST /api/inquiries?op=invitations`. Public inquiry submission remains separate. The existing admin-session check revalidates team admins on each request.
- `POST` with `preview: true` builds the email without contacting Resend. Preview needs a valid `SITE_URL`, but no Resend key, so Gmail drafts work before domain setup.
- Sending uses [Resend's batch endpoint](https://resend.com/docs/api-reference/emails/send-batch-emails), with one recipient per email and both HTML and plain text.
- Each draft keeps a request identifier across preview and retries, including a page reload in the same browser tab. Resend's [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) prevent duplicate processing for 24 hours. Editing the draft creates a new identifier. After an uncertain send, retry the same draft or check the Resend dashboard before starting a different one.
- User text is HTML-escaped. The admin preview lives in a sandboxed iframe. Sender, Reply-To and website destination come from the server environment.
- This reuses an existing Vercel function, preserving the twelve-function limit. Local Vite uses the same invitation implementation after validating its local admin session.

Tests mock Resend. They do not send live emails.
