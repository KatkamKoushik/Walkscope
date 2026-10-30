/**
 * OpenStreetMap Route Amenity Adapter for Mobile Client
 * 
 * Retrieves mapped amenities along walking route corridors via Gateway or Overpass.
 * Enforces honest context: all features are tagged as mapped_unverified.
 */

import {
  fetchCorridorAmenities,
  AmenityFeature,
  OVERPASS_DISCLAIMER,
} from '@walking-companion/core';
import { GATEWAY_BASE_URL } from './routingAdapter';

export interface RouteAmenitySummary {
  features: AmenityFeature[];
  transitCount: number;
  emergencyCount: number;
  servicesCount: number;
  lightingCount: number;
  disclaimer: string;
  error?: string;
}

/**
 * Fetches amenities along the corridor of a GeoJSON LineString
 */
export async function getAmenitiesAlongRoute(
  coordinates: Array<[number, number]>
): Promise<RouteAmenitySummary> {
  if (!coordinates || coordinates.length === 0) {
    return {
      features: [],
      transitCount: 0,
      emergencyCount: 0,
      servicesCount: 0,
      lightingCount: 0,
      disclaimer: OVERPASS_DISCLAIMER,
    };
  }

  // 1. Try querying Geospatial Gateway
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/api/v1/context/corridor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates,
        maxCorridorDistanceMeters: 120,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return {
        features: data.features || [],
        transitCount: data.categoryBreakdown?.transit || 0,
        emergencyCount: data.categoryBreakdown?.emergency || 0,
        servicesCount: data.categoryBreakdown?.services || 0,
        lightingCount: data.categoryBreakdown?.lighting || 0,
        disclaimer: data.disclaimer || OVERPASS_DISCLAIMER,
        error: data.error,
      };
    }
  } catch {
    clearTimeout(timer);
  }

  // 2. Fallback to direct client Overpass retrieval
  const result = await fetchCorridorAmenities(coordinates, {
    bufferDegrees: 0.0015,
    maxCorridorDistanceMeters: 120,
    timeoutMs: 8000,
  });

  const features = result.features || [];
  let transitCount = 0;
  let emergencyCount = 0;
  let servicesCount = 0;
  let lightingCount = 0;

  for (const feat of features) {
    if (feat.category === 'transit') transitCount++;
    else if (feat.category === 'emergency') emergencyCount++;
    else if (feat.category === 'services') servicesCount++;
    else if (feat.category === 'lighting') lightingCount++;
  }

  return {
    features,
    transitCount,
    emergencyCount,
    servicesCount,
    lightingCount,
    disclaimer: OVERPASS_DISCLAIMER,
    error: result.error,
  };
}
