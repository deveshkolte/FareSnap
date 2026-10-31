export type LiveWeatherSurgeInfo = {
  temperatureC: number;
  precipitationMm: number;
  weatherCode: number;
  windSpeedKmh: number;
  isRaining: boolean;
  conditionLabel: string;
  cabMultiplier: number;
  autoMultiplier: number;
  bikeMultiplier: number;
  fetchedAt: string;
};

const DEFAULT_CLEAR_WEATHER: LiveWeatherSurgeInfo = {
  temperatureC: 28,
  precipitationMm: 0,
  weatherCode: 0,
  windSpeedKmh: 8,
  isRaining: false,
  conditionLabel: 'Clear ☀️',
  cabMultiplier: 1.0,
  autoMultiplier: 1.0,
  bikeMultiplier: 1.0,
  fetchedAt: new Date().toISOString(),
};

/**
 * Queries Open-Meteo's real-time weather API (free, keyless) at the exact pickup
 * GPS coordinates to detect active rain, showers, or thunderstorms that trigger
 * real-world surge pricing on Uber, Ola, and Rapido.
 */
export const fetchLiveWeatherSurge = async (
  lat?: number,
  lng?: number
): Promise<LiveWeatherSurgeInfo> => {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    isNaN(lat) ||
    isNaN(lng)
  ) {
    return DEFAULT_CLEAR_WEATHER;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
      4
    )}&longitude=${lng.toFixed(
      4
    )}&current=temperature_2m,precipitation,rain,showers,weather_code,wind_speed_10m&timezone=Asia%2FKolkata`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return DEFAULT_CLEAR_WEATHER;

    const data = await res.json();
    const cur = data?.current;
    if (!cur) return DEFAULT_CLEAR_WEATHER;

    const temperatureC = Number(cur.temperature_2m ?? 28);
    const precipitationMm = Math.max(
      Number(cur.precipitation ?? 0),
      Number(cur.rain ?? 0) + Number(cur.showers ?? 0)
    );
    const weatherCode = Number(cur.weather_code ?? 0);
    const windSpeedKmh = Number(cur.wind_speed_10m ?? 0);

    // Heavy Rain or Thunderstorm (WMO 65, 82, 95, 96, 99 or >= 4mm/hr)
    if (
      precipitationMm >= 4.0 ||
      weatherCode >= 95 ||
      weatherCode === 65 ||
      weatherCode === 82
    ) {
      return {
        temperatureC,
        precipitationMm,
        weatherCode,
        windSpeedKmh,
        isRaining: true,
        conditionLabel: 'Heavy Rain ⛈️',
        cabMultiplier: 1.52,
        autoMultiplier: 1.45,
        bikeMultiplier: 1.28,
        fetchedAt: new Date().toISOString(),
      };
    }

    // Moderate Rain / Showers (WMO 63, 81 or >= 1.0mm/hr)
    if (precipitationMm >= 1.0 || weatherCode === 63 || weatherCode === 81) {
      return {
        temperatureC,
        precipitationMm,
        weatherCode,
        windSpeedKmh,
        isRaining: true,
        conditionLabel: 'Rainy 🌧️',
        cabMultiplier: 1.32,
        autoMultiplier: 1.26,
        bikeMultiplier: 1.18,
        fetchedAt: new Date().toISOString(),
      };
    }

    // Light Rain / Drizzle (WMO 51-61, 80 or > 0.1mm/hr)
    if (
      precipitationMm > 0.1 ||
      (weatherCode >= 51 && weatherCode <= 61) ||
      weatherCode === 80
    ) {
      return {
        temperatureC,
        precipitationMm,
        weatherCode,
        windSpeedKmh,
        isRaining: true,
        conditionLabel: 'Light Rain 🌦️',
        cabMultiplier: 1.16,
        autoMultiplier: 1.14,
        bikeMultiplier: 1.08,
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      temperatureC,
      precipitationMm: 0,
      weatherCode,
      windSpeedKmh,
      isRaining: false,
      conditionLabel:
        temperatureC >= 38 ? `Hot ${Math.round(temperatureC)}°C ☀️` : `Clear ${Math.round(temperatureC)}°C ☀️`,
      cabMultiplier: 1.0,
      autoMultiplier: 1.0,
      bikeMultiplier: 1.0,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return DEFAULT_CLEAR_WEATHER;
  }
};
