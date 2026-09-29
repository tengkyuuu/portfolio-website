# Spotify and Blue setup

## Connect your Spotify account

1. Create an app at https://developer.spotify.com/dashboard. Add this exact redirect URI: `http://127.0.0.1:8888/callback`.
2. Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to `.env.local`. Keep them unprefixed; `VITE_` variables are public.
3. Run `npm run spotify:connect`. Open the printed authorization link and approve access. The helper listens only on your computer, validates the authorization state, and writes `SPOTIFY_REFRESH_TOKEN` to the ignored `.env.local` file without printing it.
4. Restart the local dev server. In **Admin → My status**, use **Check connection**. Play a track on Spotify, then open the JV profile button in the site's title bar.
5. For production, add all three `SPOTIFY_` variables to the Vercel project's environment settings and redeploy. The helper changes only your local file.

The app requests `user-read-currently-playing`, `user-read-recently-played`, and `user-top-read`. Public visitors do not authorize anything. A paused or closed player shows a quiet state; connection failures have their own message. Polling runs while the profile is open and the page is visible.

The profile's Spotify card includes album artwork, track and album details, elapsed time, and an external Spotify link. **My top songs & more** opens a listening room with top songs, recent tracks, and favorite artists. Top songs and artists can be viewed for approximately four weeks, six months, or one year. These use the existing scopes; no new authorization is needed if all three scopes were already granted. Lists load only when expanded, and the server caches each period separately. See [Spotify's top-items reference](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks).

References: [Spotify authorization code flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow) and [redirect URI requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).

## Activity and Blue

**Admin → My status** saves an activity label, optional note, and one of the Blue images or a custom uploaded meme. The profile uses `Asia/Manila` (Philippine Standard Time, UTC+8), independent of the visitor's timezone. The activity timestamp records a manual update; it is not inferred online presence.

The coffee image is Blue's circular chat button. Other memes appear in opened interactions. Gemini returns both the answer and a reaction from seven allowed names; unknown choices fall back to coffee. Replies from a human admin are labelled James and do not receive AI reactions.

Run [migration 008](../supabase/migrations/008_blue_reactions.sql) in Supabase to retain reactions in chat history. Until it is applied, chat still saves plain replies and shows the selected reaction during the current visit. The migration adds one optional column and leaves existing messages intact.

The existing blog, graphic-design gallery, and team-admin features use migrations 006 and 007; see the README. Activity uses the existing content store and section-scoped publishing.

## Portrait deployment

The cover portrait is imported from `src/assets/portrait.jpg` and `src/assets/portrait-shades.png`. Vite emits content-hashed asset URLs, so replacement images get a new cache key and missing source files fail the build. If the hover image cannot load, the base portrait stays visible. The service worker cache version was bumped to remove old cached assets. Keep the files in `public/` for older deployed clients that still refer to those URLs.
