import { useState, useEffect } from 'react';
import {
  estimateDaylightState,
  SolarEstimate,
} from '../../../core/services/twilightService';
import {
  calculateContextCoverage,
  ContextScoreBreakdown,
} from '../../../core/services/contextScoringService';
import {
  computeRouteIntelligence,
  RouteIntelligenceReport,
  SPEED_PRESETS,
} from '../../../core/services/routeIntelligenceService';
import {
  getAmenitiesAlongRoute,
  RouteAmenitySummary,
} from '../services/amenityAdapter';
import type { LocationPoint } from '../services/geocodingService';
import type { PanoramaxSearchResult } from '../services/imageryAdapter';

export interface UseRouteContextReturn {
  daylightEstimate: SolarEstimate | null;
  amenitySummary: RouteAmenitySummary | null;
  contextScore: ContextScoreBreakdown | null;
  routeIntelligence: RouteIntelligenceReport | null;
}

export function useRouteContext(
  activeRoute: any,
  origin: LocationPoint | null,
  imageryResult: PanoramaxSearchResult | null
): UseRouteContextReturn {
  const [amenitySummary, setAmenitySummary] = useState<RouteAmenitySummary | null>(null);
  const [contextScore, setContextScore] = useState<ContextScoreBreakdown | null>(null);
  const [routeIntelligence, setRouteIntelligence] = useState<RouteIntelligenceReport | null>(null);

  const daylightEstimate: SolarEstimate | null = origin
    ? estimateDaylightState(origin.latitude, origin.longitude)
    : null;

  useEffect(() => {
    let active = true;
    if (activeRoute?.geometry?.coordinates) {
      getAmenitiesAlongRoute(activeRoute.geometry.coordinates).then((amenities) => {
        if (!active) return;
        setAmenitySummary(amenities);

        // 1. Context Coverage Score
        const score = calculateContextCoverage({
          distanceMeters: activeRoute.distanceMeters,
          amenities: amenities.features,
          solar: {
            state: daylightEstimate?.solarState || 'UNKNOWN',
            elevationDeg: daylightEstimate?.solarElevationDeg || 0,
          },
          imagery: {
            available: imageryResult?.hasImagery || false,
            capturedAt: imageryResult?.images?.[0]?.captureDate || undefined,
          },
        });
        setContextScore(score);

        // 2. High-Value Route Context Intelligence (NightWise Model)
        const intel = computeRouteIntelligence({
          polyline: activeRoute.geometry.coordinates,
          distanceMeters: activeRoute.distanceMeters,
          durationSeconds: activeRoute.durationSeconds,
          steps: activeRoute.steps || [],
          amenities: amenities.features || [],
          options: {
            walkingSpeedMs: SPEED_PRESETS.standard,
            departureTime: new Date().toISOString(),
          },
        });
        setRouteIntelligence(intel);
      });
    } else {
      setAmenitySummary(null);
      setContextScore(null);
      setRouteIntelligence(null);
    }

    return () => {
      active = false;
    };
  }, [
    activeRoute?.id,
    activeRoute?.distanceMeters,
    activeRoute?.durationSeconds,
    daylightEstimate?.solarState,
    daylightEstimate?.solarElevationDeg,
    imageryResult?.hasImagery,
    imageryResult?.images,
  ]);

  return {
    daylightEstimate,
    amenitySummary,
    contextScore,
    routeIntelligence,
  };
}
