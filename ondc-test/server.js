const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4040);
const ONDC_GATEWAY_URL = process.env.ONDC_GATEWAY_URL || '';
const ONDC_BAP_ID = process.env.ONDC_BAP_ID || 'faresnap.bap.ondc.org';
const ONDC_BAP_URI = process.env.ONDC_BAP_URI || `http://localhost:${PORT}/ondc`;
const ONDC_BAP_PRIVATE_KEY = process.env.ONDC_BAP_PRIVATE_KEY || '';
const ONDC_UNIQUE_KEY_ID = process.env.ONDC_UNIQUE_KEY_ID || 'faresnap-key-1';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

// In-memory store of active ONDC transaction_id -> { status, quotes, createdAt, request }
const transactions = new Map();

// Cleanup old transactions every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [txId, val] of transactions.entries()) {
    if (val.createdAt < cutoff) {
      transactions.delete(txId);
    }
  }
}, 5 * 60 * 1000).unref();

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
  const digest = crypto.createHash('blake2b512').update(bodyString).digest('base64');
  const signingString = `(created): ${created}\n(expires): ${expires}\ndigest: BLAKE-512=${digest}`;

  if (!ONDC_BAP_PRIVATE_KEY) {
    const mockSig = crypto.createHash('sha256').update(signingString).digest('base64');
    return `Signature keyId="${ONDC_BAP_ID}|${ONDC_UNIQUE_KEY_ID}|ed25519",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${mockSig}"`;
  }

  try {
    const privateKeyObj = crypto.createPrivateKey({
      key: Buffer.from(ONDC_BAP_PRIVATE_KEY, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    const signature = crypto.sign(null, Buffer.from(signingString, 'utf8'), privateKeyObj).toString('base64');
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
      const priceVal = parseFloat(item?.price?.value ?? item?.price?.estimated_value ?? '0');
      if (!Number.isFinite(priceVal) || priceVal <= 0) continue;

      const maxVal = parseFloat(item?.price?.maximum_value ?? String(Math.round(priceVal * 1.1)));
      const f = fulfillmentsById.get(item?.fulfillment_ids?.[0] || item?.fulfillment_id);
      const vehicleCategory = f?.vehicle?.category || item?.descriptor?.code || 'AUTO_RICKSHAW';
      const itemName = item?.descriptor?.name || vehicleCategory;

      let rideType = 'Cab';
      if (/AUTO/i.test(vehicleCategory) || /Auto/i.test(itemName)) {
        rideType = 'Auto';
      } else if (/BIKE|TWO_WHEELER|MOTO/i.test(vehicleCategory) || /Bike/i.test(itemName)) {
        rideType = 'Bike';
      }

      quotes.push({
        providerId: `${provider.id || providerName.toLowerCase().replace(/\s+/g, '_')}_${item.id || rideType.toLowerCase()}`,
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
 * Generates a realistic Beckn `/on_search` catalog for Namma Yatri & Bharat Taxi
 * when operating in local sandbox mode without an external BPP webhook URL.
 */
function buildSandboxBecknOnSearch(transactionId, reqData) {
  const km = Math.max(1, Number(reqData.distanceKm || 5));
  const min = Math.max(3, Number(reqData.durationMin || 15));
  const city = reqData.city || 'bangalore';

  const autoBase = city === 'bangalore' ? 30 : city === 'delhi' ? 25 : 28;
  const autoPerKm = city === 'bangalore' ? 15 : city === 'delhi' ? 11 : 14;
  const autoPrice = Math.max(50, Math.round(autoBase + Math.max(0, km - 2) * autoPerKm));

  const cabBase = city === 'bangalore' ? 42 : 40;
  const cabPerKm = city === 'bangalore' ? 13.5 : 12.5;
  const cabPrice = Math.max(75, Math.round(cabBase + km * cabPerKm + min * 0.5));

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
            fulfillments: [{ id: 'f_bharat_mini', vehicle: { category: 'HATCHBACK' } }],
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
        activeTransactions: transactions.size,
      });
    }

    // 1. POST /ondc/search — Initiates a Beckn ONDC:TRV10 search
    if (req.method === 'POST' && url.pathname === '/ondc/search') {
      try {
        const reqData = await readJsonBody(req);
        const transactionId = crypto.randomUUID();
        const becknSearchPayload = buildBecknSearchPayload(transactionId, reqData);
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
            const sandboxCallback = buildSandboxBecknOnSearch(transactionId, reqData);
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
          const newQuotes = parseBecknOnSearchCatalog(body, tx.request?.distanceKm);
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

    // 4. POST /proxy/ai-insight — Server-side Groq proxy so API keys stay off the client APK
    if (req.method === 'POST' && url.pathname === '/proxy/ai-insight') {
      try {
        const body = await readJsonBody(req);
        if (!GROQ_API_KEY) {
          return sendJson(res, 503, { error: 'GROQ_API_KEY not configured on server' });
        }
        const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify(body),
        });
        const data = await upstream.json();
        return sendJson(res, upstream.status, data);
      } catch (err) {
        return sendJson(res, 500, { error: String(err.message || err) });
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`FareSnap ONDC BAP Gateway & AI Proxy listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer,
  buildBecknSearchPayload,
  parseBecknOnSearchCatalog,
  createBecknAuthorizationHeader,
};
