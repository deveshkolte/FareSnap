const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getRoadDistance = async (
  originAddress: string,
  destinationAddress: string,
  cityName?: string
): Promise<{ distanceKm: number; durationMin: number } | null> => {
  try {
    const geocode = async (address: string): Promise<{ lat: number; lng: number } | null> => {
      const queries = [
        address + ' India',
        cityName ? address + ' ' + cityName + ' India' : null,
      ].filter(Boolean) as string[];

      for (const query of queries) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].geometry.coordinates;
            return { lat, lng };
          }
        } catch (e) {
          console.warn('Photon geocode failed for:', query);
        }
      }
      return null;
    };

  const origin = await geocode(originAddress);

    await sleep(1000);

    const dest = await geocode(destinationAddress);

    if (!origin || !dest) {
      console.error('Geocoding failed for one or both addresses');
      return null;
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const routeRes = await fetch(osrmUrl);
    const routeData = await routeRes.json();

    if (routeData.code !== 'Ok') return null;

    const route = routeData.routes[0];
    const distanceKm = route.distance / 1000;
    const durationMin = (route.duration / 60) * 1.4;

    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMin: Math.round(durationMin)
    };
  } catch (err) {
    console.error('Distance engine error:', String(err));
    return null;
  }
};