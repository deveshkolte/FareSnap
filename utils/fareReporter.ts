const SUPABASE_URL = 'https://xkfusgddkiutasbwigij.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrZnVzZ2Rka2l1dGFzYndpZ2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjI2NDEsImV4cCI6MjA5ODc5ODY0MX0.Y27HCTSZI9mVmSbwsGjCRxojVCFys3NQ9kq3UAWQZj4';

export type FareReport = {
  app: string;
  city: string;
  pickup_area: string;
  distance_km: number;
  quoted_fare: number;
  app_version: string;
};

export async function reportFare(data: FareReport): Promise<void> {
  if (!data.app || !data.city || data.quoted_fare <= 0 || data.quoted_fare >= 10000 || data.distance_km <= 0) {
    return;
  }

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
