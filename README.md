# Evenly

**Scan a grocery receipt, split it item-by-item, and share each person's exact total.**

Built for a real problem: when you front the bill for a houseful of roommates, the pain isn't paying — it's the per-item exclusion math ("don't split the tomatoes for me, I don't eat them"). Evenly photographs the receipt, extracts the line items with AI, lets you toggle who's in or out **per item**, and computes provably-exact per-person totals — tax and fees split proportionally, down to the cent.

## Features

- 📸 **Receipt scanning** — snap a photo or import a PDF; line items are extracted by Gemini 2.5 Flash (Vertex AI)
- ➗ **Item-exact splits** — toggle each roommate in/out per item; tax, fees, and discounts split proportionally
- 🎯 **Exact to the cent** — integer-cent largest-remainder rounding, so per-person totals always sum to the receipt total — no lost or extra pennies
- 👥 **Roommates** — add them manually or from your contacts; "You" is an optional participant
- 🔐 **Biometric lock** — Face ID / fingerprint gate on launch
- 🌗 **Light / dark / automatic** theming
- 📤 **Share** — copy each person's breakdown to request payment in any app

## Download

- **Android** — grab the `.apk` from the [latest release](https://github.com/Sriram-52/evenly/releases/latest) and sideload it
- **iOS** — no Apple Developer account, so it runs as a local build on your own device (see [Development](#development))

## Tech

| | |
|---|---|
| **App** | Expo SDK 56 + Expo Router, React Native 0.85, React 19, TypeScript |
| **Backend** | Convex — reactive DB, file storage, scheduled actions |
| **Auth** | Better Auth (email/password + Google), biometric gate |
| **AI extraction** | Gemini 2.5 Flash on Vertex AI via the Vercel AI SDK, structured output |
| **CI/CD** | EAS cloud builds → GitHub Releases; Convex deploys via GitHub Actions |

## The interesting parts

- **[`convex/lib/split.ts`](convex/lib/split.ts)** — the split is pure and integer-only. Per-item equal split plus proportional tax/fees, both via largest-remainder, with a per-item index rotation so the rounding pennies don't always land on the same person. Every per-person total sums exactly to the receipt grand total. Covered by tests (`pnpm test`).
- **[`convex/extract.ts`](convex/extract.ts)** — receipt/PDF → structured line items. Downscales images to keep token cost low, detects PDF vs image, constrains the model to a schema, and flags low-confidence reads for review.

## Development

```bash
pnpm install
```

**Provision Convex** (interactive — logs in / creates a project, writes `CONVEX_DEPLOYMENT` + `EXPO_PUBLIC_CONVEX_URL` to `.env.local`, generates `convex/_generated/`). Leave it running:

```bash
npx convex dev
```

**Set the backend env vars** (second terminal). Auth needs a secret and the `.site` URL; receipt scanning needs a Google service-account JSON and a Google OAuth client:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL "https://<your-deployment>.convex.site"
npx convex env set GOOGLE_SERVICE_ACCOUNT_KEY "$(cat service-account.json)"
npx convex env set GOOGLE_CLIENT_ID "..."          # optional: Google sign-in
npx convex env set GOOGLE_CLIENT_SECRET "..."
```

**Add the client env** — copy `.env.example` → `.env.local` and set `EXPO_PUBLIC_CONVEX_SITE_URL` (your `.cloud` URL with `.site`) and `EXPO_PUBLIC_GOOGLE_AUTH=true` to show the Google button.

**Run it:**

```bash
pnpm start                    # Expo bundler
pnpm android                  # or a native Android dev build
bash scripts/ios.sh --device  # iOS dev build (wraps the local Swift toolchain fix)
```

> Biometrics: simulators/emulators have none, so the launch gate passes through by design — test Face ID / fingerprint on a real device.

Other:

```bash
pnpm test    # split-math unit tests
pnpm lint
```

## Releasing

Bump `version` in `app.json`, then **Actions → Release → Run workflow** — EAS builds the APK and publishes it to GitHub Releases. The Convex backend deploys automatically on any `convex/**` change.

---

A [codebyram.dev](https://codebyram.dev) project.
