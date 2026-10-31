const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const CLOUD_BAP_URL = (
  process.env.EXPO_PUBLIC_ONDC_BAP_URL ||
  'https://faresnap-ondc-bap-gateway.onrender.com'
).replace(/\/$/, '');

export type FareReport = {
  app: string;
  city: string;
  pickup_area: string;
  distance_km: number;
  quoted_fare: number;
  app_version: string;
};

const recentSubmissions = new Map<string, number>();
const SUBMISSION_COOLDOWN_MS = 60_000;

export async function reportFare(data: FareReport): Promise<void> {
  if (
    !data.app ||
    !data.city ||
    !Number.isFinite(data.quoted_fare) ||
    !Number.isFinite(data.distance_km) ||
    data.quoted_fare < 15 ||
    data.quoted_fare >= 10000 ||
    data.distance_km <= 0
  ) {
    return;
  }

  // Sanity check fare-per-km to reject bogus/spam entries
  const effectiveKm = Math.max(1, data.distance_km);
  const perKmRate = data.quoted_fare / effectiveKm;
  if (perKmRate < 3 || perKmRate > 350) {
    return;
  }

  const dedupeKey = `${data.app}:${data.city}:${data.pickup_area}:${Math.round(
    data.distance_km
  )}`;
  const lastSubmittedAt = recentSubmissions.get(dedupeKey) ?? 0;
  if (Date.now() - lastSubmittedAt < SUBMISSION_COOLDOWN_MS) {
    return;
  }
  recentSubmissions.set(dedupeKey, Date.now());

  // 1. Primary Cloud Surge Pool (Render Backend: https://faresnap-ondc-bap-gateway.onrender.com)
  fetch(`${CLOUD_BAP_URL}/fare-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});

  // 2. Optional Secondary Supabase Sync (only if EXPO_PUBLIC_SUPABASE_URL is configured)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/fare_reports`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(data),
      });
    } catch {}
  }
}

export async function fetchRecentCrowdsourcedFares(
  city: string,
  distanceKm: number
): Promise<Record<string, number>> {
  if (!city || distanceKm <= 0) return {};

  const minKm = Math.max(0.5, distanceKm * 0.7);
  const maxKm = distanceKm * 1.3;

  try {
    let rows: any[] = [];

    // 1. Query primary Render Cloud Surge Pool first (fast, zero dead-placeholder delay)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2800);
      const cloudRes = await fetch(
        `${CLOUD_BAP_URL}/fare-reports?city=${encodeURIComponent(
          city
        )}&minKm=${minKm.toFixed(1)}&maxKm=${maxKm.toFixed(1)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (cloudRes.ok) {
        const parsed = await cloudRes.json();
        if (Array.isArray(parsed)) rows = parsed;
      }
    } catch {}

    // 2. Optional Supabase fallback if configured
    if (rows.length === 0 && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const url = `${SUPABASE_URL}/rest/v1/fare_reports?city=eq.${encodeURIComponent(
        city
      )}&distance_km=gte.${minKm.toFixed(1)}&distance_km=lte.${maxKm.toFixed(
        1
      )}&select=app,quoted_fare,distance_km&order=id.desc&limit=25`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (res.ok) {
        const parsed = await res.json();
        if (Array.isArray(parsed)) rows = parsed;
      }
    }

    if (rows.length === 0) return {};

    // Normalize reported fares to the current route's distance
    const byApp: Record<string, number[]> = {};
    for (const r of rows) {
      if (r?.app && Number(r.quoted_fare) > 15 && Number(r.distance_km) > 0) {
        const scaled = Math.round(
          (Number(r.quoted_fare) / Number(r.distance_km)) * distanceKm
        );
        if (scaled >= 20 && scaled < 10000) {
          byApp[r.app] = byApp[r.app] || [];
          byApp[r.app].push(scaled);
        }
      }
    }

    const averages: Record<string, number> = {};
    for (const [app, vals] of Object.entries(byApp)) {
      averages[app] = Math.round(
        vals.reduce((a, b) => a + b, 0) / vals.length
      );
    }
    return averages;
  } catch {
    return {};
  }
}

/**
 * Computes Waze-style live area surge multipliers (`0.85x` to `1.85x`) per app
 * from recent crowdsourced rider reports in the same city / pickup neighborhood.
 */
export async function fetchLiveAreaSurgeMultipliers(
  city: string,
  pickupArea?: string
): Promise<Record<string, number>> {
  if (!city) return {};

  try {
    let rows: any[] = [];

    // 1. Query primary Render Cloud Surge Pool first
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2800);
      const cloudRes = await fetch(
        `${CLOUD_BAP_URL}/fare-reports?city=${encodeURIComponent(city)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (cloudRes.ok) {
        const parsed = await cloudRes.json();
        if (Array.isArray(parsed)) rows = parsed;
      }
    } catch {}

    // 2. Optional Supabase fallback if configured
    if (rows.length === 0 && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const url = `${SUPABASE_URL}/rest/v1/fare_reports?city=eq.${encodeURIComponent(
        city
      )}&select=app,pickup_area,quoted_fare,distance_km&order=id.desc&limit=30`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (res.ok) {
        const parsed = await res.json();
        if (Array.isArray(parsed)) rows = parsed;
      }
    }

    if (rows.length === 0) return {};

    const cleanArea = (pickupArea || '').toLowerCase().trim();
    const ratiosByApp: Record<string, number[]> = {};

    for (const r of rows) {
      const km = Number(r?.distance_km || 0);
      const fare = Number(r?.quoted_fare || 0);
      const app = String(r?.app || '').trim();
      if (!app || km < 1 || fare < 20) continue;

      const baseline =
        app === 'Rapido'
          ? 22 + km * 7.5
          : app === 'Namma Yatri'
            ? 36 + km * 13.0
            : 58 + km * 24.0;

      const rawRatio = fare / Math.max(30, baseline);
      if (rawRatio < 0.7 || rawRatio > 2.4) continue;

      const clamped = Math.max(0.85, Math.min(1.85, rawRatio));
      const isSameArea =
        cleanArea.length >= 3 &&
        String(r?.pickup_area || '')
          .toLowerCase()
          .includes(cleanArea);

      ratiosByApp[app] = ratiosByApp[app] || [];
      // Weight same-neighborhood reports 2x higher than city-wide reports
      ratiosByApp[app].push(clamped);
      if (isSameArea) {
        ratiosByApp[app].push(clamped);
      }
    }

    const multipliers: Record<string, number> = {};
    for (const [app, list] of Object.entries(ratiosByApp)) {
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      multipliers[app] = Math.round(avg * 100) / 100;
    }
    return multipliers;
  } catch {
    return {};
  }
}
