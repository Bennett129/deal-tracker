// Triggers a price sync on the running app:  npm run sync
// Demo a price drop (development only):       npm run sync -- --demo-drop
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const demo = process.argv.includes("--demo-drop") ? "?demo=drop" : "";
const headers = process.env.SYNC_SECRET
  ? { Authorization: `Bearer ${process.env.SYNC_SECRET}` }
  : {};

try {
  const response = await fetch(`${base}/api/sync${demo}`, { method: "POST", headers });
  console.log(response.status, await response.text());
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.error(`Could not reach ${base}. Is the app running?`, error.message);
  process.exit(1);
}
