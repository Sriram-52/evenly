# Evenly — local setup

Grocery bill splitter. Expo (iOS + Android) + Convex + Better Auth (email/password,
single admin) with a biometric launch gate. Receipt extraction (added later) runs on
Gemini 2.5 Flash via Vertex AI inside a Convex action.

## One-time setup

1. **Provision Convex + generate types** (interactive — opens a browser to log in /
   create a project, then watches for changes):

   ```bash
   npx convex dev
   ```

   This writes `CONVEX_DEPLOYMENT` and `EXPO_PUBLIC_CONVEX_URL` to `.env.local` and
   creates `convex/_generated/`. Leave it running.

2. **Set the deployment env vars** (in a second terminal):

   ```bash
   npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   # Take EXPO_PUBLIC_CONVEX_URL from .env.local, swap .cloud -> .site:
   npx convex env set SITE_URL "https://<your-deployment>.convex.site"
   ```

3. **Add the site URL for the client** — append to `.env.local`:

   ```
   EXPO_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
   ```

4. **Run the app:**

   ```bash
   npx expo start
   ```

   Press `i` (iOS simulator) or scan the QR with Expo Go on a physical device.
   Biometrics: a simulator has none, so the gate passes through by design; test
   Face ID / Touch ID on a real device.

## Verifying auth (the de-risk milestone)

- Launch → sign up with email/password → you land on the temporary home showing
  "Signed in as <you>".
- Kill and reopen the app → it should restore the session (no re-login) and prompt
  the biometric gate on a real device.
- Tap "Sign out" → returns to the sign-in screen.
