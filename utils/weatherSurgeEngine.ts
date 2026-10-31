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
  upcomingSlotMultipliers: number[];
  rainRadarAdvice: string | null;
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
  upcomingSlotMultipliers: [1.0, 1.0, 1.0, 1.0, 1.0],
  rainRadarAdvice: null,
  fetchedAt: new Date().toISOString(),
};

const getCabMultiplierForRainAndCode = (
  precipMm: number,
  wCode: number
): number => {
  if (precipMm >= 4.0 || wCode >= 95 || wCode === 65 || wCode === 82) {
    return 1.52;
  }
  if (precipMm >= 1.0 || wCode === 63 || wCode === 81) {
    return 1.32;
  }
  if (
    precipMm > 0.1 ||
    (wCode >= 51 && wCode <= 61) ||
    wCode === 80
  ) {
    return 1.16;
  }
  return 1.0;
};

/**
 * Queries Open-Meteo's real-time + 15-minute radar forecast API (free, keyless)
 * at the exact pickup GPS coordinates to detect active rain and upcoming showers
 * over the next 60 minutes.
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
    )}&current=temperature_2m,precipitation,rain,showers,weather_code,wind_speed_10m&minutely_15=precipitation,weather_code&forecast_minutely_15=5&timezone=Asia%2FKolkata`;

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

    const cabMultiplier = getCabMultiplierForRainAndCode(
      precipitationMm,
      weatherCode
    );
    const isRaining = cabMultiplier > 1.0;

    // Parse 15-minute radar slots (Now, +15m, +30m, +45m, +60m)
    const min15Precip: number[] = Array.isArray(data?.minutely_15?.precipitation)
      ? data.minutely_15.precipitation.map(Number)
      : [];
    const min15Code: number[] = Array.isArray(data?.minutely_15?.weather_code)
      ? data.minutely_15.weather_code.map(Number)
      : [];

    const upcomingSlotMultipliers: number[] = [0, 1, 2, 3, 4].map((idx) => {
      if (idx === 0) return cabMultiplier;
      const p = min15Precip[idx] ?? precipitationMm;
      const c = min15Code[idx] ?? weatherCode;
      return getCabMultiplierForRainAndCode(p, c);
    });

    let rainRadarAdvice: string | null = null;
    if (
      !isRaining &&
      (upcomingSlotMultipliers[1] > 1.0 || upcomingSlotMultipliers[2] > 1.0)
    ) {
      rainRadarAdvice =
        '🌧️ Rain radar: Showers starting in ~15–30 mins. Book now before rain surge hits!';
    } else if (
      isRaining &&
      (upcomingSlotMultipliers[1] === 1.0 || upcomingSlotMultipliers[2] === 1.0)
    ) {
      rainRadarAdvice =
        '☀️ Rain radar: Showers clearing in ~15–30 mins. Waiting 15 mins can avoid rain surge.';
    }

    if (cabMultiplier >= 1.5) {
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
        upcomingSlotMultipliers,
        rainRadarAdvice,
        fetchedAt: new Date().toISOString(),
      };
    }

    if (cabMultiplier >= 1.3) {
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
        upcomingSlotMultipliers,
        rainRadarAdvice,
        fetchedAt: new Date().toISOString(),
      };
    }

    if (cabMultiplier > 1.0) {
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
        upcomingSlotMultipliers,
        rainRadarAdvice,
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
        temperatureC >= 38
          ? `Hot ${Math.round(temperatureC)}°C ☀️`
          : `Clear ${Math.round(temperatureC)}°C ☀️`,
      cabMultiplier: 1.0,
      autoMultiplier: 1.0,
      bikeMultiplier: 1.0,
      upcomingSlotMultipliers,
      rainRadarAdvice,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return DEFAULT_CLEAR_WEATHER;
  }
};
