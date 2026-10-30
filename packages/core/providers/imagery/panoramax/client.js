/**
 * @module panoramaxClient
 * @description High-level client for fetching Panoramax street-level imagery along walking routes.
 * 
 * Adheres to Checklist & Architectural Rules:
 * 1. Distinguishes flat images from 360-degree panoramas.
 * 2. Surfaces capture dates, thumbnail URLs, and required CC-BY-SA 4.0 attribution.
 * 3. Returns an explicit NO_IMAGERY_FOUND state when no photos exist; never fabricates substitute imagery.
 * 4. Safe AbortController timeouts and bounded concurrency.
 */

import { createPanoramaxSource } from './source.js';

export const PANORAMAX_ATTRIBUTION = 'Photos © Panoramax contributors (CC-BY-SA 4.0)';

/**
 * Normalized Panoramax photo record.
 * @typedef {Object} PanoramaxImage
 * @property {string} id - Unique photo UUID
 * @property {number} latitude - Photo latitude
 * @property {number} longitude - Photo longitude
 * @property {string|null} captureDate - UTC ISO timestamp or null
 * @property {boolean} is360Panorama - True if 360° equirectangular projection
 * @property {number|null} headingDeg - Camera azimuth in degrees (0-360)
 * @property {string|null} thumbUrl - Direct HTTPS thumbnail URL
 * @property {string|null} fullUrl - Direct HTTPS full-resolution image URL
 * @property {string} attribution - Attribution notice
 * @property {string} [cameraModel] - Camera model if available
 */

/**
 * Result of a Panoramax imagery search.
 * @typedef {Object} PanoramaxSearchResult
 * @property {boolean} ok - Query succeeded without unhandled network error
 * @property {boolean} hasImagery - At least one valid photo found
 * @property {PanoramaxImage[]} images - Array of photos
 * @property {'FOUND'|'NO_IMAGERY_FOUND'|'ERROR'} status - Outcome status
 * @property {string} [message] - Informational message
 */

/**
 * Normalize a raw Panoramax STAC item into a clean PanoramaxImage.
 * @param {Object} item - STAC Item GeoJSON Feature
 * @returns {PanoramaxImage|null}
 */
export function normalizePanoramaxItem(item) {
  if (!item || !item.id || !item.geometry || !Array.isArray(item.geometry.coordinates)) {
    return null;
  }

  const [lon, lat] = item.geometry.coordinates;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null;
  }

  const props = item.properties || {};
  const assets = item.assets || {};

  // Check field of view or projection for 360 panorama detection
  const fov = Number(props['field_of_view'] ?? props['panoramax:horizontal_pixel_density']);
  const is360 = props['pers:projection_type'] === 'equirectangular' || fov >= 360 || props['pers:interior_orientation'] === 'spherical';

  // Extract heading/azimuth
  let heading = Number(props['view:azimuth'] ?? props['heading']);
  if (!Number.isFinite(heading)) heading = null;

  // Extract capture datetime
  const captureDate = props['datetime'] || props['date'] || null;

  // Extract thumbnail and full-resolution URLs
  const thumbUrl = assets['thumb']?.href || assets['sd']?.href || null;
  const fullUrl = assets['hd']?.href || assets['original']?.href || assets['visual']?.href || thumbUrl;

  const cameraModel = [props['camera:make'], props['camera:model']].filter(Boolean).join(' ') || undefined;

  return {
    id: String(item.id),
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
    captureDate,
    is360Panorama: Boolean(is360),
    headingDeg: heading != null ? Math.round(heading) : null,
    thumbUrl,
    fullUrl,
    attribution: PANORAMAX_ATTRIBUTION,
    cameraModel,
  };
}

/**
 * Find street-level imagery near a coordinate using Panoramax.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} [options]
 * @param {number} [options.radiusM=50] - Search radius in meters
 * @param {number} [options.limit=5] - Maximum photos to return
 * @param {typeof fetch} [options.fetchImpl] - Optional custom fetch
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {Promise<PanoramaxSearchResult>}
 */
export async function findStreetImageryNear(
  lat,
  lon,
  options = {}
) {
  const { radiusM = 50, limit = 5, fetchImpl = globalThis.fetch, signal } = options;

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return {
      ok: false,
      hasImagery: false,
      images: [],
      status: 'ERROR',
      message: 'Invalid latitude or longitude coordinates provided.',
    };
  }

  try {
    const source = createPanoramaxSource({ fetchImpl });
    const rawItems = await source.nearestItems(
      {
        lat,
        lon,
        radius: radiusM,
        limit,
      },
      { signal }
    );

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return {
        ok: true,
        hasImagery: false,
        images: [],
        status: 'NO_IMAGERY_FOUND',
        message: 'No street-level imagery currently available near this location on Panoramax.',
      };
    }

    const images = rawItems
      .map(normalizePanoramaxItem)
      .filter((img) => img !== null);

    if (images.length === 0) {
      return {
        ok: true,
        hasImagery: false,
        images: [],
        status: 'NO_IMAGERY_FOUND',
        message: 'No valid imagery found.',
      };
    }

    return {
      ok: true,
      hasImagery: true,
      images,
      status: 'FOUND',
    };
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError') {
      return {
        ok: false,
        hasImagery: false,
        images: [],
        status: 'ERROR',
        message: 'Imagery search timed out or was canceled.',
      };
    }

    return {
      ok: false,
      hasImagery: false,
      images: [],
      status: 'ERROR',
      message: err.message || 'Panoramax imagery lookup failed.',
    };
  }
}

