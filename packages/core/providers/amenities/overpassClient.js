/**
 * Overpass API Client for OpenStreetMap Amenity and Context Retrieval
 * 
 * Retrieves mapped amenities along a route corridor (transit, emergency, services, lighting).
 * Strictly follows honest context principles:
 * - Every feature is marked 'mapped_unverified'
 * - Preserves ODbL OpenStreetMap attribution
 * - Filters amenities strictly by proximity to the route polyline (not just bbox)
 * - Zero inference that mapped facilities are open, staffed, or operational now
 */

/**
 * @typedef {'transit' | 'emergency' | 'services' | 'lighting' | 'other'} AmenityCategory
 * 
 * @typedef {Object} AmenityFeature
 * @property {string} id
 * @property {string} name
 * @property {AmenityCategory} category
 * @property {string} type
 * @property {[number, number]} coordinates - [longitude, latitude]
 * @property {'mapped_unverified'} verificationStatus
 * @property {string} disclaimer
 * @property {string} source
 * @property {string} fetchedAt
 * @property {number} [distanceFromRouteM] - Distance to nearest polyline segment in meters
 * @property {Record<string, string>} [tags]
 * 
 * @typedef {Object} CorridorBounds
 * @property {number} south
 * @property {number} west
 * @property {number} north
 * @property {number} east
 */

export const OVERPASS_DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const OVERPASS_DISCLAIMER = 'Mapped feature from OpenStreetMap; not verified operational, staffed, or open now.';

/**
 * Calculates a bounding box around a set of coordinates with a buffer
 * @param {Array<[number, number]>} coordinates - Array of [lon, lat] points
 * @param {number} [bufferDegrees=0.001] - ~100 meters
 * @returns {CorridorBounds}
 */
export function calculateCorridorBounds(coordinates, bufferDegrees = 0.001) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error('Coordinates must be a non-empty array of [lon, lat] pairs');
  }

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const point of coordinates) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const [lon, lat] = point;
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    if (isNaN(lon) || isNaN(lat)) continue;

    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  if (minLon === Infinity) {
    throw new Error('No valid numeric coordinates provided');
  }

  // Guard against runaway or malicious bounding box queries
  if ((maxLat - minLat) > 1.0 || (maxLon - minLon) > 1.0) {
    throw new Error('Route coordinates span exceeds maximum allowable pedestrian bounding box (1.0 degree)');
  }

  return {
    south: Math.max(-90, minLat - bufferDegrees),
    west: Math.max(-180, minLon - bufferDegrees),
    north: Math.min(90, maxLat + bufferDegrees),
    east: Math.min(180, maxLon + bufferDegrees),
  };
}

/**
 * Distance in meters from a point to a line segment in local equirectangular projection.
 * @param {number} pLon
 * @param {number} pLat
 * @param {number} aLon
 * @param {number} aLat
 * @param {number} bLon
 * @param {number} bLat
 * @returns {number} Distance in meters
 */
export function distancePointToSegmentM(pLon, pLat, aLon, aLat, bLon, bLat) {
  const midLatRad = ((aLat + bLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(midLatRad);
  const mPerDegLon = 111320 * cosLat;
  const mPerDegLat = 110540;

  const ax = aLon * mPerDegLon;
  const ay = aLat * mPerDegLat;
  const bx = bLon * mPerDegLon;
  const by = bLat * mPerDegLat;
  const px = pLon * mPerDegLon;
  const py = pLat * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;

  return Math.hypot(px - cx, py - cy);
}

/**
 * Minimum distance in meters from a point to an arbitrary polyline
 * @param {[number, number]} point - [lon, lat]
 * @param {Array<[number, number]>} polyline - Array of [lon, lat]
 * @returns {number} Distance in meters
 */
export function minDistancePointToPolylineM(point, polyline) {
  if (!Array.isArray(polyline) || polyline.length === 0) return Infinity;
  const [pLon, pLat] = point;

  if (polyline.length === 1) {
    const [aLon, aLat] = polyline[0];
    const midLatRad = ((pLat + aLat) / 2) * (Math.PI / 180);
    const mPerDegLon = 111320 * Math.cos(midLatRad);
    const mPerDegLat = 110540;
    return Math.hypot((pLon - aLon) * mPerDegLon, (pLat - aLat) * mPerDegLat);
  }

  let minM = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLon, aLat] = polyline[i];
    const [bLon, bLat] = polyline[i + 1];
    const d = distancePointToSegmentM(pLon, pLat, aLon, aLat, bLon, bLat);
    if (d < minM) {
      minM = d;
    }
  }

  return minM;
}

/**
 * Builds an Overpass QL query string for a bounding box
 * @param {CorridorBounds} bounds
 * @param {number} [timeoutSec=10]
 * @returns {string}
 */
export function buildOverpassQuery(bounds, timeoutSec = 10) {
  const { south, west, north, east } = bounds;
  const bbox = `${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}`;

  return `[out:json][timeout:${timeoutSec}];
(
  node["highway"="bus_stop"](${bbox});
  node["railway"~"subway_entrance|station"](${bbox});
  way["railway"~"subway_entrance|station"](${bbox});
  node["amenity"~"police|fire_station|hospital|pharmacy|clinic"](${bbox});
  way["amenity"~"police|fire_station|hospital|pharmacy|clinic"](${bbox});
  node["shop"="convenience"](${bbox});
  way["shop"="convenience"](${bbox});
  node["highway"="street_lamp"](${bbox});
);
out center;`;
}

/**
 * Categorizes an OSM element by its tags
 * @param {Record<string, string>} tags
 * @returns {AmenityCategory}
 */
export function categorizeOsmTags(tags = {}) {
  if (tags.highway === 'bus_stop' || tags.railway === 'subway_entrance' || tags.railway === 'station') {
    return 'transit';
  }
  if (tags.amenity === 'police' || tags.amenity === 'fire_station' || tags.amenity === 'hospital') {
    return 'emergency';
  }
  if (tags.amenity === 'pharmacy' || tags.amenity === 'clinic' || tags.shop === 'convenience') {
    return 'services';
  }
  if (tags.highway === 'street_lamp') {
    return 'lighting';
  }
  return 'other';
}

/**
 * Normalizes an OSM Overpass element into an AmenityFeature
 * @param {any} element
 * @returns {AmenityFeature | null}
 */
export function normalizeOsmElement(element) {
  if (!element || typeof element !== 'object') return null;
  const lat = typeof element.lat === 'number' ? element.lat : element.center?.lat;
  const lon = typeof element.lon === 'number' ? element.lon : element.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const tags = element.tags || {};
  const category = categorizeOsmTags(tags);
  const type = tags.amenity || tags.highway || tags.railway || tags.shop || 'amenity';
  
  const name = tags.name || 
    tags.operator || 
    (tags.highway === 'street_lamp' ? 'Mapped Street Lamp' : null) ||
    (tags.highway === 'bus_stop' ? 'Bus Stop' : null) ||
    (tags.amenity ? tags.amenity.replace(/_/g, ' ') : null) ||
    'Mapped Facility';

  return {
    id: `osm_${element.type || 'node'}_${element.id}`,
    name,
    category,
    type,
    coordinates: [lon, lat],
    verificationStatus: 'mapped_unverified',
    disclaimer: OVERPASS_DISCLAIMER,
    source: 'OpenStreetMap (ODbL)',
    fetchedAt: new Date().toISOString(),
    tags,
  };
}

/**
 * Fetches mapped amenities in the corridor around route coordinates
 * @param {Array<[number, number]>} coordinates - GeoJSON line coordinates [lon, lat]
 * @param {Object} [options]
 * @param {number} [options.bufferDegrees=0.0015] - Bounding box expansion degrees (~150m)
 * @param {number} [options.maxCorridorDistanceMeters=120] - Strict distance filter to polyline
 * @param {number} [options.timeoutMs=8000]
 * @param {string} [options.endpoint=OVERPASS_DEFAULT_ENDPOINT]
 * @param {typeof fetch} [options.fetchFn=globalThis.fetch]
 * @returns {Promise<{ features: AmenityFeature[]; error?: string }>}
 */
export async function fetchCorridorAmenities(coordinates, options = {}) {
  const {
    bufferDegrees = 0.0015,
    maxCorridorDistanceMeters = 120,
    timeoutMs = 8000,
    endpoint = OVERPASS_DEFAULT_ENDPOINT,
    fetchFn = globalThis.fetch,
  } = options;

  let bounds;
  try {
    bounds = calculateCorridorBounds(coordinates, bufferDegrees);
  } catch (err) {
    return { features: [], error: err.message };
  }

  const query = buildOverpassQuery(bounds, Math.ceil(timeoutMs / 1000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'WalkingContextCompanion/1.0',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      if (response.status === 429) {
        return { features: [], error: 'Overpass API rate-limited (HTTP 429). Please retry shortly.' };
      }
      return { features: [], error: `Overpass API returned HTTP ${response.status}` };
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.elements)) {
      return { features: [] };
    }

    const features = [];
    const seenIds = new Set();
    for (const elem of data.elements) {
      const feat = normalizeOsmElement(elem);
      if (!feat) continue;
      if (seenIds.has(feat.id)) continue;

      // Filter strictly by route polyline distance
      const distM = minDistancePointToPolylineM(feat.coordinates, coordinates);
      if (distM <= maxCorridorDistanceMeters) {
        feat.distanceFromRouteM = Math.round(distM);
        seenIds.add(feat.id);
        features.push(feat);
      }
    }

    return { features };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { features: [], error: 'Overpass API query timed out.' };
    }
    return { features: [], error: err.message || 'Failed to fetch amenities from Overpass' };
  }
}
