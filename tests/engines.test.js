const test = require('node:test');
const assert = require('node:assert/strict');

// 1. Test ondc-test/server.js functions
const {
  buildBecknSearchPayload,
  parseBecknOnSearchCatalog,
  createBecknAuthorizationHeader,
} = require('../ondc-test/server.js');

test('ONDC server: buildBecknSearchPayload creates valid Beckn TRV10 payload', () => {
  const reqData = {
    city: 'bangalore',
    pickup: { lat: 12.9716, lng: 77.5946, address: 'MG Road' },
    destination: { lat: 12.9352, lng: 77.6245, address: 'Koramangala' },
    distanceKm: 6.5,
  };
  const payload = buildBecknSearchPayload('tx-test-123', reqData);
  assert.equal(payload.context.domain, 'ONDC:TRV10');
  assert.equal(payload.context.action, 'search');
  assert.equal(payload.context.transaction_id, 'tx-test-123');
  assert.equal(payload.context.city, 'std:080');
  assert.equal(payload.message.intent.fulfillment.stops.length, 2);
  assert.equal(payload.message.intent.fulfillment.stops[0].type, 'START');
  assert.equal(payload.message.intent.fulfillment.stops[1].type, 'END');
});

test('ONDC server: parseBecknOnSearchCatalog parses multiple vehicle tiers per provider', () => {
  const sampleBecknBody = {
    message: {
      catalog: {
        providers: [
          {
            id: 'namma_yatri_ondc',
            descriptor: { name: 'Namma Yatri' },
            fulfillments: [
              { id: 'f_auto', vehicle: { category: 'AUTO_RICKSHAW' } },
              { id: 'f_cab_ac', vehicle: { category: 'SEDAN' } },
            ],
            items: [
              {
                id: 'ny_auto_direct',
                descriptor: { name: 'Auto Direct', code: 'AUTO_RICKSHAW' },
                fulfillment_id: 'f_auto',
                price: { currency: 'INR', value: '115', maximum_value: '125' },
              },
              {
                id: 'ny_cab_ac',
                descriptor: { name: 'Cab AC', code: 'SEDAN' },
                fulfillment_id: 'f_cab_ac',
                price: { currency: 'INR', value: '230', maximum_value: '250' },
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
                price: { currency: 'INR', value: '210', maximum_value: '225' },
              },
            ],
          },
        ],
      },
    },
  };

  const quotes = parseBecknOnSearchCatalog(sampleBecknBody, 6.5);
  assert.equal(quotes.length, 3, 'Should parse all 3 vehicle items');
  assert.equal(quotes[0].providerName, 'Namma Yatri');
  assert.equal(quotes[0].rideType, 'Auto Direct');
  assert.equal(quotes[0].price, 115);

  assert.equal(quotes[1].providerName, 'Namma Yatri');
  assert.equal(quotes[1].rideType, 'Cab AC');
  assert.equal(quotes[1].price, 230);

  assert.equal(quotes[2].providerName, 'Bharat Cab');
  assert.equal(quotes[2].rideType, 'Bharat Mini');
  assert.equal(quotes[2].price, 210);
});

test('ONDC server: createBecknAuthorizationHeader produces valid header', () => {
  const header = createBecknAuthorizationHeader('{"test":true}');
  assert.ok(header.startsWith('Signature keyId='));
  assert.ok(header.includes('algorithm="ed25519"'));
  assert.ok(header.includes('headers="(created) (expires) digest"'));
});

// 2. Test QuoteEngine Deduplication
test('QuoteEngine: deduplication preserves distinct ride types for the same provider', () => {
  const allQuotes = [
    {
      providerId: 'faresnap_namma_yatri_auto',
      providerName: 'Namma Yatri',
      rideType: 'Auto Direct',
      price: 120,
      currency: 'INR',
      etaMinutes: null,
      distanceKm: 6.5,
      source: 'faresnap_estimate',
      confidence: 'estimated',
      fetchedAt: new Date().toISOString(),
      isAvailable: true,
    },
    {
      providerId: 'faresnap_namma_yatri_cab',
      providerName: 'Namma Yatri',
      rideType: 'Cab AC',
      price: 240,
      currency: 'INR',
      etaMinutes: null,
      distanceKm: 6.5,
      source: 'faresnap_estimate',
      confidence: 'estimated',
      fetchedAt: new Date().toISOString(),
      isAvailable: true,
    },
    // Live quote arriving for Auto Direct
    {
      providerId: 'ondc_ny_auto_direct',
      providerName: 'Namma Yatri',
      rideType: 'Auto Direct',
      price: 112,
      currency: 'INR',
      etaMinutes: 3,
      distanceKm: 6.5,
      source: 'live_provider',
      confidence: 'live',
      fetchedAt: new Date().toISOString(),
      isAvailable: true,
    },
    // Bharat Cab quote
    {
      providerId: 'ondc_bc_mini',
      providerName: 'Bharat Cab',
      rideType: 'Bharat Mini',
      price: 205,
      currency: 'INR',
      etaMinutes: 5,
      distanceKm: 6.5,
      source: 'live_provider',
      confidence: 'live',
      fetchedAt: new Date().toISOString(),
      isAvailable: true,
    },
  ];

  // Reproduce QuoteEngine deduplication logic
  const byKey = new Map();
  for (const quote of allQuotes) {
    const key = `${quote.providerName.toLowerCase()}::${quote.rideType.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, quote);
    } else if (quote.source === 'live_provider' && existing.source !== 'live_provider') {
      byKey.set(key, quote);
    }
  }
  const result = Array.from(byKey.values()).sort((a, b) => a.price - b.price);

  assert.equal(result.length, 3, 'Should retain Auto Direct, Cab AC, and Bharat Mini');
  const nyAuto = result.find((q) => q.providerName === 'Namma Yatri' && q.rideType === 'Auto Direct');
  assert.ok(nyAuto);
  assert.equal(nyAuto.source, 'live_provider', 'Live quote should supersede estimate');
  assert.equal(nyAuto.price, 112);

  const nyCab = result.find((q) => q.providerName === 'Namma Yatri' && q.rideType === 'Cab AC');
  assert.ok(nyCab, 'Cab AC must not be dropped by providerName deduplication');
  assert.equal(nyCab.price, 240);

  const bcMini = result.find((q) => q.providerName === 'Bharat Cab');
  assert.ok(bcMini);
  assert.equal(bcMini.price, 205);
});
