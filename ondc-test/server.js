const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Auto-load root .env file if present (zero external dependencies)
(function loadDotEnv() {
  const envPaths = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '.env'),
  ];
  for (const envPath of envPaths) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const content = fs.readFileSync(envPath, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = line.slice(0, eqIdx).trim();
        const val = line
          .slice(eqIdx + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    } catch {}
  }
})();

const PORT = Number(process.env.PORT || 4040);
const ONDC_GATEWAY_URL = process.env.ONDC_GATEWAY_URL || '';
const ONDC_BAP_ID = process.env.ONDC_BAP_ID || 'faresnap.bap.ondc.org';
const ONDC_BAP_URI = process.env.ONDC_BAP_URI || `http://localhost:${PORT}/ondc`;
const ONDC_BAP_PRIVATE_KEY = process.env.ONDC_BAP_PRIVATE_KEY || '';
const ONDC_UNIQUE_KEY_ID = process.env.ONDC_UNIQUE_KEY_ID || 'faresnap-key-1';
const GROQ_API_KEY =
  process.env.GROQ_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// In-memory store of active ONDC transaction_id -> { status, quotes, createdAt, request }
const transactions = new Map();

// Waze-style crowdsourced fare & surge report pool (file-backed ring buffer of last 500 reports)
const DATA_DIR = path.resolve(__dirname, 'data');
const FARE_REPORTS_FILE = path.resolve(DATA_DIR, 'fare_reports.json');

const SEED_FARE_REPORTS = [
  { id: 1, app: 'Namma Yatri', city: 'bangalore', pickup_area: 'MG Road', distance_km: 6.4, quoted_fare: 118, created_at: new Date().toISOString() },
  { id: 2, app: 'Rapido', city: 'bangalore', pickup_area: 'Koramangala', distance_km: 5.2, quoted_fare: 62, created_at: new Date().toISOString() },
  { id: 3, app: 'Uber', city: 'bangalore', pickup_area: 'Indiranagar', distance_km: 7.5, quoted_fare: 215, created_at: new Date().toISOString() },
  { id: 4, app: 'Ola', city: 'mumbai', pickup_area: 'Andheri West', distance_km: 8.1, quoted_fare: 230, created_at: new Date().toISOString() },
  { id: 5, app: 'Uber', city: 'delhi', pickup_area: 'Connaught Place', distance_km: 9.0, quoted_fare: 225, created_at: new Date().toISOString() },
];

function loadPersistedFareReports() {
  try {
    if (fs.existsSync(FARE_REPORTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FARE_REPORTS_FILE, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 500);
      }
    }
  } catch {}
  return [...SEED_FARE_REPORTS];
}

function savePersistedFareReports(pool) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FARE_REPORTS_FILE, JSON.stringify(pool.slice(0, 500), null, 2));
  } catch {}
}

const fareReportsPool = loadPersistedFareReports();

// Monetization click & conversion telemetry store
const MONETIZATION_STATS_FILE = path.resolve(DATA_DIR, 'monetization_stats.json');
function loadMonetizationStats() {
  try {
    if (fs.existsSync(MONETIZATION_STATS_FILE)) {
      return JSON.parse(fs.readFileSync(MONETIZATION_STATS_FILE, 'utf8'));
    }
  } catch {}
  return {
    totalClicks: 0,
    bySlot: {
      airport_chauffeur_affiliate: 0,
      spend_lens_cashback_card: 0,
      payment_sheet_upi_reward: 0,
      post_ride_partner_perk: 0,
    },
    recentClicks: [],
  };
}
const monetizationStats = loadMonetizationStats();
function saveMonetizationStats() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      MONETIZATION_STATS_FILE,
      JSON.stringify(monetizationStats, null, 2)
    );
  } catch {}
}

// Cleanup old transactions every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [txId, val] of transactions.entries()) {
    if (val.createdAt < cutoff) {
      transactions.delete(txId);
    }
  }
}, 5 * 60 * 1000).unref();

// Self-keepalive ping every 12 minutes to prevent Render free-tier 15m cold sleep
const SELF_PING_URL =
  process.env.RENDER_EXTERNAL_URL ||
  'https://faresnap-ondc-bap-gateway.onrender.com';
setInterval(() => {
  fetch(`${SELF_PING_URL.replace(/\/$/, '')}/health`).catch(() => {});
}, 12 * 60 * 1000).unref();

const CITY_STD_CODES = {
  bangalore: 'std:080',
  mumbai: 'std:022',
  delhi: 'std:011',
  hyderabad: 'std:040',
  chennai: 'std:044',
  pune: 'std:020',
  kolkata: 'std:033',
  ahmedabad: 'std:079',
  jaipur: 'std:0141',
  default: 'std:080',
};

/**
 * Generates Beckn Ed25519 Authorization header when ONDC_BAP_PRIVATE_KEY is configured.
 */
function createBecknAuthorizationHeader(bodyString) {
  const created = Math.floor(Date.now() / 1000);
  const expires = created + 300;
  const digest = crypto
    .createHash('blake2b512')
    .update(bodyString)
    .digest('base64');
  const signingString = `(created): ${created}\n(expires): ${expires}\ndigest: BLAKE-512=${digest}`;

  if (!ONDC_BAP_PRIVATE_KEY) {
    const mockSig = crypto
      .createHash('sha256')
      .update(signingString)
      .digest('base64');
    return `Signature keyId="${ONDC_BAP_ID}|${ONDC_UNIQUE_KEY_ID}|ed25519",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${mockSig}"`;
  }

  try {
    const privateKeyObj = crypto.createPrivateKey({
      key: Buffer.from(ONDC_BAP_PRIVATE_KEY, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    const signature = crypto
      .sign(null, Buffer.from(signingString, 'utf8'), privateKeyObj)
      .toString('base64');
    return `Signature keyId="${ONDC_BAP_ID}|${ONDC_UNIQUE_KEY_ID}|ed25519",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${signature}"`;
  } catch {
    return '';
  }
}

/**
 * Builds a spec-compliant ONDC:TRV10 v2.0.0 `/search` payload for ride-hailing.
 */
function buildBecknSearchPayload(transactionId, reqData) {
  const cityCode = CITY_STD_CODES[reqData.city] || CITY_STD_CODES.default;
  const startGps = `${Number(reqData.pickup?.lat || 12.9716).toFixed(6)},${Number(
    reqData.pickup?.lng || 77.5946
  ).toFixed(6)}`;
  const endGps = `${Number(reqData.destination?.lat || 12.9352).toFixed(6)},${Number(
    reqData.destination?.lng || 77.6245
  ).toFixed(6)}`;

  return {
    context: {
      domain: 'ONDC:TRV10',
      country: 'IND',
      city: cityCode,
      action: 'search',
      core_version: '2.0.0',
      bap_id: ONDC_BAP_ID,
      bap_uri: ONDC_BAP_URI,
      transaction_id: transactionId,
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ttl: 'PT30S',
    },
    message: {
      intent: {
        fulfillment: {
          stops: [
            {
              type: 'START',
              location: {
                gps: startGps,
                address: reqData.pickup?.address || 'Pickup',
              },
            },
            {
              type: 'END',
              location: {
                gps: endGps,
                address: reqData.destination?.address || 'Destination',
              },
            },
          ],
        },
        payment: {
          collected_by: 'BPP',
        },
      },
    },
  };
}

/**
 * Parses an incoming Beckn `/on_search` catalog into FareSnap's `FareQuote[]` format.
 */
function parseBecknOnSearchCatalog(BecknBody, distanceKm) {
  const quotes = [];
  const providers = BecknBody?.message?.catalog?.providers || [];

  for (const provider of providers) {
    const providerName = provider?.descriptor?.name || 'ONDC Mobility Partner';
    const fulfillmentsById = new Map();
    for (const f of provider?.fulfillments || []) {
      fulfillmentsById.set(f.id, f);
    }

    for (const item of provider?.items || []) {
      const priceVal = parseFloat(
        item?.price?.value ?? item?.price?.estimated_value ?? '0'
      );
      if (!Number.isFinite(priceVal) || priceVal <= 0) continue;

      const maxVal = parseFloat(
        item?.price?.maximum_value ?? String(Math.round(priceVal * 1.1))
      );
      const f = fulfillmentsById.get(
        item?.fulfillment_ids?.[0] || item?.fulfillment_id
      );
      const vehicleCategory =
        f?.vehicle?.category || item?.descriptor?.code || 'AUTO_RICKSHAW';
      const itemName = item?.descriptor?.name || vehicleCategory;

      let rideType = 'Cab';
      if (/AUTO/i.test(vehicleCategory) || /Auto/i.test(itemName)) {
        rideType = 'Auto';
      } else if (
        /BIKE|TWO_WHEELER|MOTO/i.test(vehicleCategory) ||
        /Bike/i.test(itemName)
      ) {
        rideType = 'Bike';
      }

      quotes.push({
        providerId: `${
          provider.id || providerName.toLowerCase().replace(/\s+/g, '_')
        }_${item.id || rideType.toLowerCase()}`,
        providerName,
        rideType: itemName,
        price: Math.round(priceVal * 100) / 100,
        currency: item?.price?.currency || 'INR',
        etaMinutes: 4,
        distanceKm: distanceKm || null,
        source: 'live_provider',
        confidence: 'live',
        fetchedAt: new Date().toISOString(),
        isAvailable: true,
        metadata: {
          highEstimate: Math.round(maxVal),
          becknProviderId: provider.id,
          becknItemId: item.id,
          vehicleCategory,
        },
      });
    }
  }

  return quotes;
}

/**
 * Generates a realistic Beckn `/on_search` catalog for Namma Yatri & Bharat Cab
 * when operating in local sandbox mode without an external BPP webhook URL.
 */
function buildSandboxBecknOnSearch(transactionId, reqData) {
  const km = Math.max(1, Number(reqData.distanceKm || 5));
  const min = Math.max(3, Number(reqData.durationMin || 15));
  const city = reqData.city || 'bangalore';

  const autoBase = city === 'bangalore' ? 36 : city === 'delhi' ? 32 : 34;
  const autoPerKm = city === 'bangalore' ? 11.0 : city === 'delhi' ? 10.0 : 10.5;
  const autoPerMin = city === 'bangalore' ? 0.75 : 0.7;
  const autoPrice = Math.max(
    55,
    Math.round(autoBase + km * autoPerKm + min * autoPerMin)
  );

  const cabBase = city === 'bangalore' ? 50 : 46;
  const cabPerKm = city === 'bangalore' ? 15.2 : 14.2;
  const cabPerMin = city === 'bangalore' ? 1.25 : 1.15;
  const cabPrice = Math.max(
    90,
    Math.round(cabBase + km * cabPerKm + min * cabPerMin)
  );

  return {
    context: {
      domain: 'ONDC:TRV10',
      action: 'on_search',
      transaction_id: transactionId,
      bpp_id: 'api.nammayatri.in',
      bpp_uri: 'https://api.nammayatri.in/beckn',
      timestamp: new Date().toISOString(),
    },
    message: {
      catalog: {
        descriptor: { name: 'ONDC Mobility Network' },
        providers: [
          {
            id: 'namma_yatri_ondc',
            descriptor: { name: 'Namma Yatri' },
            fulfillments: [
              { id: 'f_auto', vehicle: { category: 'AUTO_RICKSHAW' } },
              { id: 'f_cab_non_ac', vehicle: { category: 'HATCHBACK' } },
              { id: 'f_cab_ac', vehicle: { category: 'SEDAN' } },
            ],
            items: [
              {
                id: 'ny_auto_direct',
                descriptor: { name: 'Auto Direct', code: 'AUTO_RICKSHAW' },
                fulfillment_id: 'f_auto',
                price: {
                  currency: 'INR',
                  value: String(autoPrice),
                  maximum_value: String(Math.round(autoPrice * 1.08)),
                },
              },
              {
                id: 'ny_cab_ac',
                descriptor: { name: 'Cab AC', code: 'SEDAN' },
                fulfillment_id: 'f_cab_ac',
                price: {
                  currency: 'INR',
                  value: String(cabPrice),
                  maximum_value: String(Math.round(cabPrice * 1.1)),
                },
              },
            ],
          },
          {
            id: 'bharat_cab_ondc',
            descriptor: { name: 'Bharat Cab' },
            fulfillments: [
              { id: 'f_bharat_mini', vehicle: { category: 'HATCHBACK' } },
            ],
            items: [
              {
                id: 'bc_mini',
                descriptor: { name: 'Bharat Mini', code: 'HATCHBACK' },
                fulfillment_id: 'f_bharat_mini',
                price: {
                  currency: 'INR',
                  value: String(Math.round(cabPrice * 0.94)),
                  maximum_value: String(Math.round(cabPrice * 1.04)),
                },
              },
            ],
          },
        ],
      },
    },
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Prefer',
  });
  res.end(body);
}

function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      return sendJson(res, 200, { ok: true });
    }

    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // Health check
    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        status: 'ok',
        bapId: ONDC_BAP_ID,
        aiProxyReady: Boolean(GROQ_API_KEY || GEMINI_API_KEY),
        activeTransactions: transactions.size,
        pooledFareReports: fareReportsPool.length,
      });
    }

    // Remote Hot-Updatable WebView Scraper Selector Config (Phase 1)
    if (req.method === 'GET' && url.pathname === '/scraper-config') {
      return sendJson(res, 200, {
        version: 2,
        domSelectorQuery:
          'li, [role="option"], [data-testid*="product"], [class*="ride"], div',
        knownProductNames: [
          'Uber Go',
          'UberXS',
          'Go Non AC',
          'Premier',
          'UberXL',
          'Moto',
          'Uber Auto',
          'Auto',
          'Bike Direct',
          'Auto Seat Share',
          'Auto Pet',
          'Cab Non AC',
          'Cab AC',
          'Cab Premium',
          'Ola Mini',
          'Mini',
          'Prime Sedan',
          'Prime SUV',
          'Ola Auto',
          'Ola Bike',
          'Bike',
        ],
        extraPriceKeys: ['totalFare', 'finalFare', 'upfrontFare'],
      });
    }

    // Remote Monetization Config & Click Telemetry Endpoints
    if (req.method === 'GET' && url.pathname === '/monetization-config') {
      return sendJson(res, 200, {
        enabled: true,
        cuelinksPubId: process.env.CUELINKS_PUB_ID || '',
        savaariAffiliateUrl:
          process.env.SAVAARI_AFFILIATE_URL ||
          'https://www.savaari.com/?utm_source=faresnap&utm_medium=affiliate',
        cashbackCardTitle:
          process.env.CASHBACK_CARD_TITLE ||
          'Get 5% Cashback on Uber, Ola & Rapido',
        cashbackCardSubtitle:
          process.env.CASHBACK_CARD_SUBTITLE ||
          'Commuters save an extra 5% on every cab, auto & bike ride with zero-fee UPI & RuPay cashback.',
        cashbackCardCta:
          process.env.CASHBACK_CARD_CTA || 'Unlock 5% Ride Cashback →',
        cashbackOfferUrl:
          process.env.CASHBACK_OFFER_URL ||
          'https://super.money/?utm_source=faresnap',
        upiRewardTitle:
          process.env.UPI_REWARD_TITLE ||
          '🎁 Get up to 5% cashback on Ride UPI payments →',
        upiReferralUrl:
          process.env.UPI_REFERRAL_URL ||
          'https://super.money/?utm_source=faresnap_upi',
        postRidePerkTitle:
          process.env.POST_RIDE_PERK_TITLE ||
          '💳 Earn 5% back on this ride with Super UPI / Cashback →',
        postRidePerkUrl:
          process.env.POST_RIDE_PERK_URL ||
          'https://super.money/?utm_source=faresnap_postride',
      });
    }

    if (req.method === 'POST' && url.pathname === '/monetization-click') {
      try {
        const body = await readJsonBody(req);
        const slotId = String(body?.slotId || 'unknown');
        monetizationStats.totalClicks =
          (monetizationStats.totalClicks || 0) + 1;
        monetizationStats.bySlot[slotId] =
          (monetizationStats.bySlot[slotId] || 0) + 1;
        monetizationStats.recentClicks.unshift({
          slotId,
          providerOrLabel: String(body?.providerOrLabel || ''),
          estimatedRideValue: Number(body?.estimatedRideValue || 0),
          timestamp: new Date().toISOString(),
        });
        if (monetizationStats.recentClicks.length > 100) {
          monetizationStats.recentClicks.length = 100;
        }
        saveMonetizationStats();
        return sendJson(res, 201, { ok: true });
      } catch (err) {
        return sendJson(res, 400, { error: String(err.message || err) });
      }
    }

    if (req.method === 'GET' && url.pathname === '/monetization-stats') {
      return sendJson(res, 200, monetizationStats);
    }

    // Phone QR Launcher (Expo Go Tunnel + Web + APK)
    if (req.method === 'GET' && url.pathname === '/phone') {
      let tunnelUrl =
        process.env.EXPO_TUNNEL_URL ||
        'exp://3gde_ay-deveshkolte-8090.exp.direct';
      try {
        const mfRes = await fetch('http://localhost:8090', {
          headers: { 'expo-platform': 'android' },
        });
        if (mfRes.ok) {
          const mfJson = await mfRes.json();
          const hostUri = mfJson?.extra?.expoClient?.hostUri;
          if (hostUri) {
            tunnelUrl = `exp://${hostUri}`;
          }
        }
      } catch {}

      const lanUrl = process.env.PHONE_WEB_URL || 'http://192.168.254.93:8090';
      const apkBuildUrl =
        process.env.EAS_APK_BUILD_URL ||
        'https://expo.dev/accounts/devesh.kolte/projects/faresnap/builds/62c4ec4f-a7f4-44ea-b269-b85dd2c32688';
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scan with Expo Go (Tunnel Active)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; display: flex; flex-direction: column; align-items: center; }
    h1 { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
    p.sub { color: #64748b; margin-top: 0; margin-bottom: 28px; font-size: 15px; max-width: 720px; text-align: center; line-height: 1.5; }
    .grid { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; max-width: 1120px; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; width: 310px; text-align: center; box-shadow: 0 4px 16px rgba(15,23,42,0.05); }
    .card-featured { border: 2px solid #2563eb; box-shadow: 0 8px 24px rgba(37,99,235,0.14); }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
    .badge-blue { background: #eff6ff; color: #2563eb; }
    .badge-green { background: #f0fdf4; color: #16a34a; }
    h2 { font-size: 19px; margin: 4px 0 8px; }
    .desc { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 16px; }
    img.qr { width: 220px; height: 220px; border-radius: 12px; border: 1px solid #e2e8f0; padding: 8px; background: #fff; }
    a.btn { display: block; margin-top: 16px; padding: 12px 16px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; }
    a.btn-blue { background: #2563eb; color: #fff; }
    a.btn-indigo { background: #4338ca; color: #fff; }
    code { display: block; margin-top: 10px; font-size: 12px; color: #0f172a; font-weight: 700; background: #f1f5f9; padding: 8px; border-radius: 6px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>🚀 Open FareSnap in Expo Go on Your Phone</h1>
  <p class="sub">Your Wi-Fi network (<code>192.168.254.93</code>) blocks direct LAN connections between devices. I started an <b>Expo Cloud Tunnel</b> so your phone connects from <b>any Wi-Fi or 5G network</b>!</p>
  <div class="grid">
    <div class="card card-featured">
      <span class="badge badge-green">WORKS ON ANY WIFI OR 5G · EXPO GO</span>
      <h2>1. Scan with Expo Go App</h2>
      <p class="desc">Scan this QR code inside the <b>Expo Go</b> app on Android (or iPhone Camera), or paste the URL manually into Expo Go:</p>
      <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
        tunnelUrl
      )}" alt="Expo Go Tunnel QR" />
      <code>${tunnelUrl}</code>
    </div>
    <div class="card">
      <span class="badge badge-blue">STANDALONE ANDROID APK</span>
      <h2>2. Install Native Android APK</h2>
      <p class="desc">Want a standalone Android app without Expo Go? Scan to open the EAS APK Download page:</p>
      <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
        apkBuildUrl
      )}" alt="EAS APK QR" />
      <code>EAS Build #62c4ec4f</code>
      <a class="btn btn-indigo" href="${apkBuildUrl}" target="_blank">Open APK Download Page →</a>
    </div>
  </div>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    // 1. POST /ondc/search — Initiates a Beckn ONDC:TRV10 search
    if (req.method === 'POST' && url.pathname === '/ondc/search') {
      try {
        const reqData = await readJsonBody(req);
        const transactionId = crypto.randomUUID();
        const becknSearchPayload = buildBecknSearchPayload(
          transactionId,
          reqData
        );
        const bodyString = JSON.stringify(becknSearchPayload);
        const authHeader = createBecknAuthorizationHeader(bodyString);

        transactions.set(transactionId, {
          status: 'searching',
          quotes: [],
          createdAt: Date.now(),
          request: reqData,
        });

        // If a real ONDC gateway URL is configured, forward the signed Beckn search request
        if (ONDC_GATEWAY_URL) {
          fetch(`${ONDC_GATEWAY_URL.replace(/\/$/, '')}/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: bodyString,
          }).catch(() => {});
        } else {
          // Simulate asynchronous BPP `/on_search` webhook arriving 350ms later
          setTimeout(() => {
            const tx = transactions.get(transactionId);
            if (!tx) return;
            const sandboxCallback = buildSandboxBecknOnSearch(
              transactionId,
              reqData
            );
            const parsedQuotes = parseBecknOnSearchCatalog(
              sandboxCallback,
              reqData.distanceKm
            );
            tx.quotes.push(...parsedQuotes);
            tx.status = 'completed';
          }, 350);
        }

        return sendJson(res, 200, {
          ack: { status: 'ACK' },
          transactionId,
          becknContext: becknSearchPayload.context,
        });
      } catch (err) {
        return sendJson(res, 400, { error: String(err.message || err) });
      }
    }

    // 2. POST /ondc/on_search — Standard Beckn BPP webhook callback
    if (req.method === 'POST' && url.pathname === '/ondc/on_search') {
      try {
        const body = await readJsonBody(req);
        const txId = body?.context?.transaction_id;
        if (txId && transactions.has(txId)) {
          const tx = transactions.get(txId);
          const newQuotes = parseBecknOnSearchCatalog(
            body,
            tx.request?.distanceKm
          );
          tx.quotes.push(...newQuotes);
          tx.status = 'completed';
        }
        return sendJson(res, 200, {
          message: { ack: { status: 'ACK' } },
        });
      } catch (err) {
        return sendJson(res, 400, { error: String(err.message || err) });
      }
    }

    // 3. GET /ondc/quotes/:transactionId — Poll/fetch resolved ONDC quotes
    if (req.method === 'GET' && url.pathname.startsWith('/ondc/quotes/')) {
      const txId = url.pathname.replace('/ondc/quotes/', '').trim();
      const tx = transactions.get(txId);
      if (!tx) {
        return sendJson(res, 404, { error: 'Transaction not found' });
      }
      return sendJson(res, 200, {
        transactionId: txId,
        status: tx.status,
        quotes: tx.quotes,
      });
    }

    // ONDC Domain Verification & Registry Challenge Endpoints (Phase 4)
    if (req.method === 'GET' && url.pathname === '/ondc-site-verification.html') {
      const signedToken = process.env.ONDC_SITE_VERIFICATION_SIGNED_TOKEN || 'ONDC_VERIFICATION_READY';
      const html = `<!DOCTYPE html><html><head><meta name="ondc-site-verification" content="${signedToken}" /></head><body>ONDC Site Verification: ${ONDC_BAP_ID}</body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'POST' && url.pathname === '/ondc/on_subscribe') {
      try {
        const body = await readJsonBody(req);
        return sendJson(res, 200, {
          answer: body?.challenge || 'ONDC_SUBSCRIBE_ACK',
        });
      } catch (err) {
        return sendJson(res, 400, { error: String(err.message || err) });
      }
    }

    // Play Store Privacy Policy & Independent Utility Disclosure Page (Phase 4)
    if (req.method === 'GET' && url.pathname === '/privacy') {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FareSnap Privacy Policy & Disclosure</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #f8fafc; color: #0f172a; max-width: 720px; margin: 0 auto; padding: 32px 20px; line-height: 1.6; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
    h1 { font-size: 24px; margin-top: 0; }
    h2 { font-size: 17px; margin-top: 20px; color: #1e293b; }
    p, li { font-size: 14px; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <h1>FareSnap Privacy Policy & Independent Utility Disclosure</h1>
    <p><strong>Effective Date:</strong> October 2026</p>
    <h2>1. Independent Commuter Comparison Utility</h2>
    <p>FareSnap is an independent commuter fare comparison and analytics utility. FareSnap is not affiliated with, endorsed by, or sponsored by Uber, Ola, Rapido, Namma Yatri, InDrive, Meru Cabs, Savaari, or Bharat Cab.</p>
    <h2>2. Local Device Session & OTP Privacy</h2>
    <p>When you optionally link a ride-hailing account via an integrated browser or OTP, all session cookies and authentication tokens are stored strictly locally on your mobile device (<code>AsyncStorage</code> / device WebView cookie jar). FareSnap never transmits or stores your passwords, OTPs, or personal account cookies on any external server.</p>
    <h2>3. Location & Route Data</h2>
    <p>Pickup and destination coordinates are used solely to calculate road distance, local weather-radar surge forecasts, Smart Pickup walking junctions, and multi-modal Metro split routes.</p>
    <h2>4. Anonymous Community Fare Calibration</h2>
    <p>Aggregated, non-identifiable route distance and fare amounts may be contributed to the community surge pool to help commuters see neighborhood surge multipliers.</p>
  </div>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    // 4. POST & GET /fare-reports — Waze-style crowdsourced fare & neighborhood surge pool
    if (url.pathname === '/fare-reports') {
      if (req.method === 'POST') {
        try {
          const body = await readJsonBody(req);
          if (
            body &&
            body.app &&
            body.city &&
            Number(body.quoted_fare) > 15 &&
            Number(body.distance_km) > 0
          ) {
            fareReportsPool.unshift({
              id: fareReportsPool.length + 1,
              app: String(body.app),
              city: String(body.city).toLowerCase(),
              pickup_area: String(body.pickup_area || ''),
              distance_km: Number(body.distance_km),
              quoted_fare: Number(body.quoted_fare),
              created_at: new Date().toISOString(),
            });
            if (fareReportsPool.length > 500) {
              fareReportsPool.length = 500;
            }
            savePersistedFareReports(fareReportsPool);
          }
          return sendJson(res, 201, { ok: true });
        } catch (err) {
          return sendJson(res, 400, { error: String(err.message || err) });
        }
      }

      if (req.method === 'GET') {
        const city = (url.searchParams.get('city') || '').toLowerCase();
        const minKm = Number(url.searchParams.get('minKm') || 0);
        const maxKm = Number(url.searchParams.get('maxKm') || 9999);
        const filtered = fareReportsPool
          .filter(
            (r) =>
              (!city || r.city === city) &&
              r.distance_km >= minKm &&
              r.distance_km <= maxKm
          )
          .slice(0, 30);
        return sendJson(res, 200, filtered);
      }
    }

    // 5. POST /proxy/ai-insight — Server-side Groq + Gemini fallback proxy so API keys stay off the client APK
    if (req.method === 'POST' && url.pathname === '/proxy/ai-insight') {
      try {
        const body = await readJsonBody(req);

        // Try Groq first if configured
        if (GROQ_API_KEY) {
          try {
            const upstream = await fetch(
              'https://api.groq.com/openai/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify(body),
              }
            );
            if (upstream.ok) {
              const data = await upstream.json();
              return sendJson(res, 200, data);
            }
          } catch {}
        }

        // Fallback to Google Gemini if Groq is unavailable or rate-limited
        if (GEMINI_API_KEY) {
          const promptText =
            body?.messages?.[0]?.content ||
            'Analyze Indian ride-hailing fares and return JSON.';
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
              GEMINI_API_KEY
            )}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
              }),
            }
          );
          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const text =
              geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return sendJson(res, 200, {
              choices: [{ message: { content: text } }],
            });
          }
        }

        return sendJson(res, 503, {
          error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY succeeded on server',
        });
      } catch (err) {
        return sendJson(res, 500, { error: String(err.message || err) });
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `FareSnap ONDC BAP Gateway, Surge Pool & AI Proxy listening on http://0.0.0.0:${PORT}`
    );
  });
}

module.exports = {
  createServer,
  buildBecknSearchPayload,
  parseBecknOnSearchCatalog,
  createBecknAuthorizationHeader,
};
