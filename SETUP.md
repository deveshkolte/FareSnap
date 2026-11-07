# FareSnap — Developer Setup Guide

> **Goal:** Get `npx expo start` and `node ondc-test/server.js` running in under 5 minutes.

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Node.js | 20.x LTS | https://nodejs.org |
| npm | 10.x | Included with Node.js |
| Expo CLI | Latest | `npm install -g expo-cli` |
| Expo Go app | SDK 58 | [iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent) |
| Git | Any recent | https://git-scm.com |

You do **not** need Android Studio or Xcode to run the app via Expo Go on a physical device.

---

## 1. Clone & Install

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/FareSnap.git
cd FareSnap
npm install
```

---

## 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` in your editor and fill in the values below. Only the **Required** keys are needed to get the app running immediately; everything else is optional.

### 2a. Required Keys

#### Ola Maps API Key *(for Indian place autocomplete & routing)*
1. Go to [https://olamaps.io/developers](https://olamaps.io/developers)
2. Sign up / Log in → Create a project → Copy the API key
3. Set: `EXPO_PUBLIC_OLA_MAPS_API_KEY=your_key_here`

> **Without this key:** Autocomplete falls back to free Nominatim (OpenStreetMap) + Photon only. The app still works but may be slower.

#### Backend URL *(for AI insights & ONDC surge pool)*
- **Local development** (see step 4): `EXPO_PUBLIC_ONDC_BAP_URL=http://localhost:4040`
- **Cloud deployment**: Set to your Render/Railway/etc. URL

### 2b. Backend Server Keys *(go in `.env` for `ondc-test/server.js`)*

#### Groq API Key *(AI price surge predictions — primary model)*
1. Go to [https://console.groq.com](https://console.groq.com) and sign up
2. Create an API key (free tier available)
3. Set: `GROQ_API_KEY=your_groq_api_key_here`

#### Google Gemini API Key *(AI fallback)*
1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create a key (free tier available)
3. Set: `GEMINI_API_KEY=your_gemini_api_key_here`

> **Without AI keys:** The AI price forecast card in the results screen will silently not appear. Everything else works normally.

### 2c. Optional Keys

| Key | Purpose | Where to get it |
|-----|---------|----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Global crowdsourced fare pooling | [https://supabase.com](https://supabase.com) — free tier |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same as above | Same Supabase project |
| `EXPO_PUBLIC_CUELINKS_PUB_ID` | Affiliate monetization | [https://cuelinks.com](https://cuelinks.com) |

#### Supabase setup (optional, 3 minutes):
1. Create a free project at [https://supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the contents of `supabase/schema.sql`
3. Click **Run**
4. Copy `Project URL` and `anon public` key from **Settings → API** into `.env`

---

## 3. Start the Backend Server

The backend is a zero-dependency Node.js server. It handles:
- **AI price insights** (Groq + Gemini proxy — keeps API keys off the mobile device)
- **ONDC Beckn BAP gateway** (`/ondc/search`, `/ondc/on_search`)
- **Crowdsourced surge pool** (`/fare-reports`)
- **Remote scraper config** (`/scraper-config`)
- **Monetization config** (`/monetization-config`)

```bash
# From the project root
npm run backend
# or directly:
node ondc-test/server.js
```

Expected output:
```
FareSnap ONDC BAP Gateway running on http://0.0.0.0:4040
AI Proxy: Groq (openai/gpt-oss-120b) + Gemini fallback
```

Verify it's healthy:
```bash
curl http://localhost:4040/health
# → {"status":"ok","aiProxyReady":true,"activeTransactions":0,"pooledFareReports":5}
```

The backend listens on **port 4040** by default. Set `PORT=` in `.env` to change it.

> **Cloud deployment:** The backend is a standard Node.js HTTP server with zero npm dependencies in `ondc-test/`. It deploys to Render, Railway, Fly.io, or any VPS with `node ondc-test/server.js`. See `render.yaml` for a one-click Render config.

---

## 4. Start the Expo App

```bash
npx expo start
```

This opens the Metro bundler. You'll see a QR code in the terminal.

**To run on a physical device:**
1. Install [Expo Go](https://expo.dev/go) (SDK 58) on your iPhone or Android phone
2. Make sure your phone and computer are on the **same Wi-Fi network**
3. Scan the QR code with:
   - **Android**: the Expo Go app's QR scanner
   - **iPhone**: the native Camera app

**To run on an emulator:**
```bash
npx expo start --android   # Android emulator (requires Android Studio)
npx expo start --ios       # iOS simulator (requires Xcode on macOS)
npx expo start --web       # Web browser (limited native features)
```

**Cloud tunnel (phone on different network):**
```bash
npm run tunnel
# or: npx expo start --tunnel
```

---

## 5. Building a Production APK

FareSnap uses [EAS Build](https://docs.expo.dev/build/introduction/).

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build a preview APK (Android only, no Play Store submission)
npm run build:apk
# or: eas build -p android --profile preview
```

The build runs in the cloud. EAS will give you a download link when complete.

**Before building:**
- Update `android.package` in `app.json` to your own reverse-domain identifier (e.g. `com.yourcompany.faresnap`)
- Update `ios.bundleIdentifier` in `app.json` similarly
- Configure `eas.json` with your EAS project ID (run `eas init` to link)

---

## 6. ONDC Network Registration *(Optional — Advanced)*

To list FareSnap as an official Buyer App on the ONDC network:

```bash
# Generate Ed25519 & X25519 keypairs
node ondc-test/generate-keys.js

# Output: signing_private_key, signing_public_key, encryption_public_key
# Save these securely — you'll need them for ONDC Registry submission
```

Then:
1. Add `ONDC_BAP_PRIVATE_KEY` to your server's environment
2. Set `ONDC_BAP_ID` (e.g. `faresnap.yourdomain.com`) and `ONDC_BAP_URI` (your deployed backend URL)
3. Register at [https://ref.ondc.org](https://ref.ondc.org) (sandbox) or the ONDC staging portal
4. The backend's `/ondc-site-verification.html` and `/ondc/on_subscribe` endpoints handle the registry challenge automatically

---

## 7. Project Structure at a Glance

```
FareSnap/
├── .env.example          ← Template — copy to .env
├── SETUP.md              ← This file
├── app/                  ← Expo Router screens
│   ├── (tabs)/index.tsx  ← Home screen
│   ├── location.tsx      ← Pickup/drop search
│   └── results.tsx       ← Fare comparison & booking
├── components/           ← UI components (maps, modals, scrapers)
├── utils/                ← All business logic engines
├── ondc-test/
│   ├── server.js         ← Backend (run this with node)
│   └── generate-keys.js  ← ONDC key generator
├── supabase/schema.sql   ← Run once in Supabase SQL Editor
└── tests/engines.test.js ← Unit tests (run: npm test)
```

---

## 8. Running Tests

```bash
npm test
```

Expected output:
```
✔ ONDC server: buildBecknSearchPayload creates valid Beckn TRV10 payload
✔ ONDC server: parseBecknOnSearchCatalog parses multiple vehicle tiers per provider
✔ ONDC server: createBecknAuthorizationHeader produces valid header
✔ QuoteEngine: deduplication preserves distinct ride types for the same provider
ℹ tests 4 | pass 4 | fail 0
```

---

## 9. Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_ONDC_BAP_URL` | ✅ | — | URL of the backend server |
| `EXPO_PUBLIC_AI_PROXY_URL` | ✅ | Derived from above | AI proxy endpoint |
| `EXPO_PUBLIC_OLA_MAPS_API_KEY` | Recommended | — | Ola Maps for autocomplete & routing |
| `GROQ_API_KEY` | For AI features | — | Groq LLM key (server-side only) |
| `GEMINI_API_KEY` | For AI features | — | Gemini fallback key (server-side only) |
| `EXPO_PUBLIC_SUPABASE_URL` | Optional | — | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Optional | — | Supabase anonymous key |
| `ONDC_BAP_ID` | ONDC only | — | Your registered BAP domain |
| `ONDC_BAP_URI` | ONDC only | — | Your deployed backend URL |
| `ONDC_BAP_PRIVATE_KEY` | ONDC only | — | Base64 Ed25519 private key |
| `PORT` | Optional | `4040` | Backend server port |

---

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Metro bundler failed to start` | Delete `.expo/` folder and run `npx expo start` again |
| `Could not connect to development server` | Ensure phone and laptop are on the same Wi-Fi. Try `npx expo start --tunnel` |
| `Ola Maps autocomplete not working` | Check `EXPO_PUBLIC_OLA_MAPS_API_KEY` is set in `.env`. App falls back to Nominatim automatically. |
| `AI forecast card missing` | Set `GROQ_API_KEY` and `GEMINI_API_KEY` in `.env` and restart the backend |
| `Backend /health returns error` | Check port 4040 is free. Run `lsof -i :4040` and kill any conflicting process |
| `npm install fails` | Ensure Node.js ≥ 20. Try deleting `node_modules/` and `package-lock.json` then re-running `npm install` |
| `TypeScript errors` | Run `npx tsc --noEmit`. Current codebase: **0 errors** |

---

## Support

Questions about the codebase? Check the inline JSDoc comments in each `utils/` file — they document every engine's data flow and API contracts.
