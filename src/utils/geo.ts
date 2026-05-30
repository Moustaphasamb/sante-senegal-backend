/**
 * Calcule la distance en kilomètres entre deux points GPS (formule Haversine).
 * @returns Distance en km (vol d'oiseau)
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcule la bounding box (deltas lat/lng) pour pré-filtrer en DB avant Haversine.
 * @param lat Latitude du centre
 * @param radiusKm Rayon en km
 */
export function boundingBox(lat: number, radiusKm: number): { latDelta: number; lngDelta: number } {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { latDelta, lngDelta };
}
