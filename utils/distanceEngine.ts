export type RouteCoords = { lat: number; lng: number };

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

const normalizeLocationInput = (input: LocationInput): { address: string; coords?: RouteCoords } => {
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

export const getRoadDistance = async (
  originInput: LocationInput,
  destinationInput: LocationInput,
  cityName?: string
): Promise<RoadDistanceResult | null> => {
  try {
    const geocode = async (address: string): Promise<RouteCoords | null> => {
      const trimmed = address.trim();
      const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
      const simplified = parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : null;

      const queries = [
        trimmed + ' India',
        cityName ? `${trimmed} ${cityName} India` : null,
        simplified ? `${simplified} India` : null,
        parts[0] && cityName ? `${parts[0]} ${cityName} India` : null,
      ].filter(Boolean) as string[];

      for (const query of queries) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&bbox=68.1,6.5,97.4,35.7&limit=1&lang=en`;
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

    const origin = parsedOrigin.coords ?? (await geocode(parsedOrigin.address));

    // Only pause if both endpoints required remote geocoding
    if (!parsedOrigin.coords && !parsedDest.coords) {
      await sleep(300);
    }

    const dest = parsedDest.coords ?? (await geocode(parsedDest.address));

    if (!origin || !dest) {
      console.error('Geocoding failed for one or both addresses');
      return null;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
      const routeRes = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeout);
      const routeData = await routeRes.json();

      if (routeData.code === 'Ok' && routeData.routes?.length > 0) {
        const route = routeData.routes[0];
        const distanceKm = Math.max(0.5, route.distance / 1000);
        const durationMin = Math.max(3, (route.duration / 60) * 1.4);

        return {
          distanceKm: Math.round(distanceKm * 10) / 10,
          durationMin: Math.round(durationMin),
          originCoords: origin,
          destCoords: dest,
        };
      }
    } catch {
      console.warn('OSRM routing failed, falling back to Haversine road estimate');
    }

    // Fallback to Haversine * 1.3 road winding factor if OSRM is unavailable
    const straightKm = haversineKm(origin, dest);
    const estimatedRoadKm = Math.max(1, Math.round(straightKm * 1.3 * 10) / 10);
    const estimatedDurationMin = Math.max(5, Math.round((estimatedRoadKm / 22) * 60));

    return {
      distanceKm: estimatedRoadKm,
      durationMin: estimatedDurationMin,
      originCoords: origin,
      destCoords: dest,
      isEstimatedRoute: true,
    };
  } catch (err) {
    console.error('Distance engine error:', String(err));
    return null;
  }
};