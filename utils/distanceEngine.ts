export type RouteCoords = { lat: number; lng: number };

export type RouteStepJunction = {
  name: string;
  distanceMeters: number;
  location: RouteCoords;
  maneuverType: string;
  modifier?: string;
};

export type LocationInput =
  | string
  | {
      address: string;
      lat?: number;
      lng?: number;
    };

export type RoadDistanceResult = {
  distanceKm: number;
  durationMin: number;
  freeFlowMin: number;
  intersectionCount: number;
  turnCount: number;
  uTurnCount: number;
  entrySteps: RouteStepJunction[];
  originCoords: RouteCoords;
  destCoords: RouteCoords;
  isEstimatedRoute?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const haversineKm = (a: RouteCoords, b: RouteCoords): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const normalizeLocationInput = (
  input: LocationInput
): { address: string; coords?: RouteCoords } => {
  if (typeof input === 'string') {
    return { address: input };
  }
  const hasValidCoords =
    typeof input.lat === 'number' &&
    typeof input.lng === 'number' &&
    !isNaN(input.lat) &&
    !isNaN(input.lng);
  return {
    address: input.address,
    coords: hasValidCoords ? { lat: input.lat!, lng: input.lng! } : undefined,
  };
};

/**
 * Computes realistic Indian city driving duration from OSRM free-flow time +
 * actual road-network intersection count, turn penalties, and time-of-day traffic factor.
 */
const computeUrbanTrafficDurationMin = (opts: {
  freeFlowSeconds: number;
  distanceKm: number;
  intersectionCount: number;
  turnCount: number;
  uTurnCount: number;
  cityName?: string;
}): number => {
  const {
    freeFlowSeconds,
    distanceKm,
    intersectionCount,
    turnCount,
    uTurnCount,
    cityName,
  } = opts;

  const hour = new Date().getHours();
  const isPeak = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21);
  const isNight = hour >= 23 || hour < 6;

  const lowerCity = (cityName || '').toLowerCase();
  const cityCongestionFactor =
    lowerCity.includes('bangalore') || lowerCity.includes('mumbai')
      ? 1.05
      : lowerCity.includes('delhi') ||
          lowerCity.includes('hyderabad') ||
          lowerCity.includes('pune') ||
          lowerCity.includes('kolkata')
        ? 1.0
        : 0.92;

  const perIntersectionSec = isNight ? 8 : isPeak ? 25 : 22;
  const perTurnSec = isNight ? 12 : 30;
  const perUTurnSec = isNight ? 20 : 45;

  const signalDelaySec =
    intersectionCount * perIntersectionSec * cityCongestionFactor;
  const turnDelaySec = turnCount * perTurnSec + uTurnCount * perUTurnSec;

  const totalMinutes =
    (freeFlowSeconds + signalDelaySec + turnDelaySec) / 60;

  // Enforce realistic urban speed bounds (11 km/h to 38 km/h in city limits)
  const minRealisticMin = Math.round((distanceKm / 38) * 60);
  const maxRealisticMin = Math.round((distanceKm / 11) * 60);

  return Math.max(
    3,
    Math.min(maxRealisticMin, Math.max(minRealisticMin, Math.round(totalMinutes)))
  );
};

export const getRoadDistance = async (
  originInput: LocationInput,
  destinationInput: LocationInput,
  cityName?: string
): Promise<RoadDistanceResult | null> => {
  try {
    const geocode = async (
      address: string,
      biasCoords?: RouteCoords
    ): Promise<RouteCoords | null> => {
      const trimmed = address.trim();
      const olaApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;
      const d = 0.6;
      const viewboxParam = biasCoords
        ? `&viewbox=${(biasCoords.lng - d).toFixed(4)},${(
            biasCoords.lat + d
          ).toFixed(4)},${(biasCoords.lng + d).toFixed(4)},${(
            biasCoords.lat - d
          ).toFixed(4)}&bounded=1`
        : '';
      const photonBboxParam = biasCoords
        ? `lat=${biasCoords.lat}&lon=${biasCoords.lng}&bbox=${(
            biasCoords.lng - d
          ).toFixed(4)},${(biasCoords.lat - d).toFixed(4)},${(
            biasCoords.lng + d
          ).toFixed(4)},${(biasCoords.lat + d).toFixed(4)}`
        : 'bbox=68.1,6.5,97.4,35.7';

      // 1. Try Ola Maps Geocode if API key is configured
      if (olaApiKey) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4500);
          const olaUrl = `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(
            cityName ? `${trimmed}, ${cityName}` : trimmed
          )}&language=en&api_key=${encodeURIComponent(olaApiKey)}`;
          const res = await fetch(olaUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (res.ok) {
            const data = await res.json();
            const loc = data?.geocodingResults?.[0]?.geometry?.location;
            if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
              return { lat: loc.lat, lng: loc.lng };
            }
          }
        } catch {}
      }

      const parts = trimmed
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const simplified =
        parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : null;

      // 2. Try Nominatim India (indexes Indian building, mall, and society names)
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const nomQuery = cityName ? `${parts[0]}, ${cityName}` : trimmed;
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          nomQuery
        )}&countrycodes=in${viewboxParam}&format=json&limit=1`;
        const res = await fetch(nomUrl, {
          headers: {
            'User-Agent': 'FareSnap/1.0 (https://github.com/YOUR_GITHUB_USERNAME/FareSnap)',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              return { lat, lng };
            }
          }
        }
      } catch {}

      // 3. Fallback to Photon India bbox
      const queries = [
        trimmed + ' India',
        cityName ? `${trimmed} ${cityName} India` : null,
        simplified ? `${simplified} India` : null,
        parts[0] && cityName ? `${parts[0]} ${cityName} India` : null,
      ].filter(Boolean) as string[];

      for (const query of queries) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
            query
          )}&${photonBboxParam}&limit=1&lang=en`;
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].geometry.coordinates;
            return { lat, lng };
          }
        } catch {
          console.warn('Photon geocode failed for:', query);
        }
      }
      return null;
    };

    const parsedOrigin = normalizeLocationInput(originInput);
    const parsedDest = normalizeLocationInput(destinationInput);

    const origin =
      parsedOrigin.coords ?? (await geocode(parsedOrigin.address));

    if (!parsedOrigin.coords && !parsedDest.coords) {
      await sleep(300);
    }

    const dest =
      parsedDest.coords ??
      (await geocode(parsedDest.address, origin ?? undefined));

    if (!origin || !dest) {
      console.error('Geocoding failed for one or both addresses');
      return null;
    }

    // Run Ola Maps Directions (traffic_metadata=true) and OSRM (steps=true) concurrently
    const olaApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;
    const olaTrafficPromise = (async (): Promise<number | null> => {
      if (!olaApiKey) return null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3200);
        const olaRouteUrl = `https://api.olamaps.io/routing/v1/directions?origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&traffic_metadata=true&api_key=${encodeURIComponent(
          olaApiKey
        )}`;
        const olaRes = await fetch(olaRouteUrl, {
          method: 'POST',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (olaRes.ok) {
          const olaData = await olaRes.json();
          const leg = olaData?.routes?.[0]?.legs?.[0];
          const sec = Number(leg?.duration_in_traffic ?? leg?.duration ?? 0);
          if (sec > 60) {
            return Math.round(sec / 60);
          }
        }
      } catch {}
      return null;
    })();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false&steps=true`;
      const [olaTrafficDurationMin, routeRes] = await Promise.all([
        olaTrafficPromise,
        fetch(osrmUrl, { signal: controller.signal }),
      ]);
      clearTimeout(timeout);
      if (!routeRes.ok) throw new Error(`OSRM status ${routeRes.status}`);
      const routeData = await routeRes.json();

      if (routeData.code === 'Ok' && routeData.routes?.length > 0) {
        const route = routeData.routes[0];
        const distanceKm = Math.max(0.5, route.distance / 1000);
        const rawSteps: any[] = route.legs?.[0]?.steps || [];

        const intersectionCount = rawSteps.reduce(
          (sum, s) => sum + (Array.isArray(s.intersections) ? s.intersections.length : 0),
          0
        );
        const turnCount = rawSteps.filter(
          (s) =>
            s?.maneuver?.type === 'turn' ||
            s?.maneuver?.type === 'end of road'
        ).length;
        const uTurnCount = rawSteps.filter(
          (s) => s?.maneuver?.modifier === 'uturn'
        ).length;

        const entrySteps: RouteStepJunction[] = rawSteps
          .slice(0, 4)
          .filter(
            (s) =>
              Array.isArray(s?.maneuver?.location) &&
              s.maneuver.location.length >= 2
          )
          .map((s) => ({
            name: String(s.name || '').trim(),
            distanceMeters: Math.round(Number(s.distance || 0)),
            location: {
              lng: Number(s.maneuver.location[0]),
              lat: Number(s.maneuver.location[1]),
            },
            maneuverType: String(s.maneuver.type || ''),
            modifier: s.maneuver.modifier
              ? String(s.maneuver.modifier)
              : undefined,
          }));

        const durationMin =
          olaTrafficDurationMin ??
          computeUrbanTrafficDurationMin({
            freeFlowSeconds: route.duration,
            distanceKm,
            intersectionCount,
            turnCount,
            uTurnCount,
            cityName,
          });

        return {
          distanceKm: Math.round(distanceKm * 10) / 10,
          durationMin,
          freeFlowMin: Math.max(2, Math.round(route.duration / 60)),
          intersectionCount,
          turnCount,
          uTurnCount,
          entrySteps,
          originCoords: origin,
          destCoords: dest,
        };
      }
    } catch {
      console.warn(
        'OSRM routing failed, falling back to Haversine road estimate'
      );
    }

    const straightKm = haversineKm(origin, dest);
    const estimatedRoadKm = Math.max(
      1,
      Math.round(straightKm * 1.3 * 10) / 10
    );
    const estimatedDurationMin = Math.max(
      5,
      Math.round((estimatedRoadKm / 18) * 60)
    );

    return {
      distanceKm: estimatedRoadKm,
      durationMin: estimatedDurationMin,
      freeFlowMin: Math.max(3, Math.round((estimatedRoadKm / 35) * 60)),
      intersectionCount: Math.round(estimatedRoadKm * 5),
      turnCount: 2,
      uTurnCount: 0,
      entrySteps: [],
      originCoords: origin,
      destCoords: dest,
      isEstimatedRoute: true,
    };
  } catch (err) {
    console.error('Distance engine error:', String(err));
    return null;
  }
};
