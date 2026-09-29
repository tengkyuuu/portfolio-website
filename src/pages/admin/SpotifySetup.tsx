import { useEffect, useState } from "react";
import { Button, Card } from "./ui";

export function SpotifySetup() {
  const [status, setStatus] = useState("Checking connection…");
  async function check() {
    setStatus("Checking connection…");
    try {
      const response = await fetch("/api/spotify", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setStatus(!data.configured ? "Not connected yet" : data.error ? "Credentials are set, but Spotify could not be reached. Reconnect if this continues." : data.playing ? `Connected · Playing ${data.title}` : "Connected · Nothing playing right now");
    } catch { setStatus("Could not check Spotify. Try again in a moment."); }
  }
  useEffect(() => { void check(); }, []);
  return <Card title="Spotify connection" description="Your profile shows the music playing on your Spotify account." actions={<Button variant="ghost" onClick={() => void check()}>Check connection</Button>}>
    <p role="status" className="font-ui text-sm text-word-blue mb-3">{status}</p>
    <ol className="list-decimal pl-5 space-y-2 font-ui text-xs text-ink-muted">
      <li>Create an app in the <a className="underline text-word-blue" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Spotify developer dashboard</a>. Register <code>http://127.0.0.1:8888/callback</code> as its redirect URI.</li>
      <li>On your computer, add <code>SPOTIFY_CLIENT_ID</code> and <code>SPOTIFY_CLIENT_SECRET</code> to <code>.env.local</code>, then run <code>npm run spotify:connect</code>. Open the link it gives you and approve access. The helper saves your refresh token locally.</li>
      <li>Copy those two values and <code>SPOTIFY_REFRESH_TOKEN</code> from <code>.env.local</code> into your Vercel project environment settings, then redeploy.</li>
    </ol>
    <p className="font-ui text-xs text-ink-muted mt-3">Credentials stay on the server. Visitors never sign in to Spotify to see your music.</p>
  </Card>;
}
