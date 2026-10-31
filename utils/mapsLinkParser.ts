export type ParsedMapLocation = {
  address: string;
  lat: number;
  lng: number;
};

const isIndiaCoord = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 6.0 &&
  lat <= 37.5 &&
  lng >= 68.0 &&
  lng <= 98.0;

const extractCoordsAndNameFromMapString = (
  input: string
): { lat?: number; lng?: number; placeHint?: string } => {
  const text = input.trim();

  // 1. Match `!3dLAT!4dLNG` (exact pin coordinates in Google Maps URLs)
  const bangMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    const lat = parseFloat(bangMatch[1]);
    const lng = parseFloat(bangMatch[2]);
    if (isIndiaCoord(lat, lng)) {
      const placeMatch = text.match(/\/place\/([^/@?]+)/);
      const placeHint = placeMatch
        ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        : undefined;
      return { lat, lng, placeHint };
    }
  }

  // 2. Match `@LAT,LNG` in Google Maps URLs
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isIndiaCoord(lat, lng)) {
      const placeMatch = text.match(/\/place\/([^/@?]+)/);
      const placeHint = placeMatch
        ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        : undefined;
      return { lat, lng, placeHint };
    }
  }

  // 3. Match `?q=LAT,LNG` or `ll=LAT,LNG` or `geo:LAT,LNG` or raw `LAT, LNG`
  const coordPairMatch = text.match(
    /(?:[?&](?:q|ll|query)=|geo:|^)\s*(\d{1,2}\.\d{3,8})\s*,\s*(\d{2,3}\.\d{3,8})/i
  );
  if (coordPairMatch) {
    const lat = parseFloat(coordPairMatch[1]);
    const lng = parseFloat(coordPairMatch[2]);
    if (isIndiaCoord(lat, lng)) {
      return { lat, lng };
    }
  }

  // 4. Match `/place/Place+Name` or `?q=Place+Name`
  const placePathMatch = text.match(/\/place\/([^/@?]+)/);
  if (placePathMatch) {
    return {
      placeHint: decodeURIComponent(placePathMatch[1].replace(/\+/g, ' ')),
    };
  }

  const queryParamMatch = text.match(/[?&](?:q|query)=([^&]+)/);
  if (queryParamMatch) {
    return {
      placeHint: decodeURIComponent(queryParamMatch[1].replace(/\+/g, ' ')),
    };
  }

  return {};
};

export const looksLikeMapsLinkOrCoords = (input: string): boolean => {
  const t = input.trim();
  if (/^https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(t)) {
    return true;
  }
  if (/^geo:\s*\d{1,2}\.\d+/i.test(t)) {
    return true;
  }
  if (/^\s*\d{1,2}\.\d{3,8}\s*,\s*\d{2,3}\.\d{3,8}\s*$/.test(t)) {
    return true;
  }
  return false;
};

/**
 * Resolves a pasted Google Maps link (including shortened `maps.app.goo.gl` URLs),
 * `geo:` URI, or raw `lat, lng` coordinates into `{ address, lat, lng }`.
 */
export const resolveMapsLinkOrCoords = async (
  rawInput: string
): Promise<ParsedMapLocation | null> => {
  let target = rawInput.trim();
  if (!looksLikeMapsLinkOrCoords(target)) {
    return null;
  }

  // Follow redirect if it's a shortened maps.app.goo.gl or goo.gl/maps URL
  if (/^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(target)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(target, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.url && res.url !== target) {
        target = res.url;
      }
    } catch {}
  }

  const { lat, lng, placeHint } = extractCoordsAndNameFromMapString(target);

  if (typeof lat === 'number' && typeof lng === 'number') {
    let address = placeHint || '';
    try {
      const res = await fetch(
        `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=en`
      );
      const data = await res.json();
      const p = data?.features?.[0]?.properties;
      if (p) {
        const rev = [p.name, p.street, p.city, p.state]
          .filter(Boolean)
          .join(', ');
        if (rev) {
          address = placeHint && !rev.toLowerCase().includes(placeHint.toLowerCase())
            ? `${placeHint}, ${rev}`
            : rev;
        }
      }
    } catch {}

    return {
      lat,
      lng,
      address: address || `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    };
  }

  if (placeHint) {
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(
          placeHint + ' India'
        )}&bbox=68.1,6.5,97.4,35.7&limit=1&lang=en`
      );
      const data = await res.json();
      const f = data?.features?.[0];
      if (f) {
        const p = f.properties || {};
        const full = [p.name, p.street, p.city, p.state]
          .filter(Boolean)
          .join(', ');
        return {
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          address: full || placeHint,
        };
      }
    } catch {}
  }

  return null;
};
