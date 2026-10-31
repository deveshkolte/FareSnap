const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xkfusgddkiutasbwigij.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrZnVzZ2Rka2l1dGFzYndpZ2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjI2NDEsImV4cCI6MjA5ODc5ODY0MX0.Y27HCTSZI9mVmSbwsGjCRxojVCFys3NQ9kq3UAWQZj4';

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

  const dedupeKey = `${data.app}:${data.city}:${data.pickup_area}:${Math.round(data.distance_km)}`;
  const lastSubmittedAt = recentSubmissions.get(dedupeKey) ?? 0;
  if (Date.now() - lastSubmittedAt < SUBMISSION_COOLDOWN_MS) {
    return;
  }
  recentSubmissions.set(dedupeKey, Date.now());

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
  } catch {
    // silently ignore
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
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
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return {};
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return {};

    // Normalize reported fares to the current route's distance
    const byApp: Record<string, number[]> = {};
    for (const r of rows) {
      if (r?.app && Number(r.quoted_fare) > 15 && Number(r.distance_km) > 0) {
        const scaled = Math.round((Number(r.quoted_fare) / Number(r.distance_km)) * distanceKm);
        if (scaled >= 20 && scaled < 10000) {
          byApp[r.app] = byApp[r.app] || [];
          byApp[r.app].push(scaled);
        }
      }
    }

    const averages: Record<string, number> = {};
    for (const [app, vals] of Object.entries(byApp)) {
      averages[app] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return averages;
  } catch {
    return {};
  }
}
