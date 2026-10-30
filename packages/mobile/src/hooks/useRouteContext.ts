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
  getAmenitiesAlongRoute,
  RouteAmenitySummary,
} from '../services/amenityAdapter';
import type { LocationPoint } from '../services/geocodingService';
import type { PanoramaxSearchResult } from '../services/imageryAdapter';

export interface UseRouteContextReturn {
  daylightEstimate: SolarEstimate | null;
  amenitySummary: RouteAmenitySummary | null;
  contextScore: ContextScoreBreakdown | null;
}

export function useRouteContext(
  activeRoute: any,
  origin: LocationPoint | null,
  imageryResult: PanoramaxSearchResult | null
): UseRouteContextReturn {
  const [amenitySummary, setAmenitySummary] = useState<RouteAmenitySummary | null>(null);
  const [contextScore, setContextScore] = useState<ContextScoreBreakdown | null>(null);

  const daylightEstimate: SolarEstimate | null = origin
    ? estimateDaylightState(origin.latitude, origin.longitude)
    : null;

  useEffect(() => {
    let active = true;
    if (activeRoute?.geometry?.coordinates) {
      getAmenitiesAlongRoute(activeRoute.geometry.coordinates).then((amenities) => {
        if (!active) return;
        setAmenitySummary(amenities);

        const score = calculateContextCoverage({
          distanceMeters: activeRoute.distanceMeters,
          amenities: amenities.features,
          solar: {
            state: daylightEstimate?.solarState || 'DAYLIGHT',
            elevationDeg: daylightEstimate?.solarElevationDeg || 0,
          },
          imagery: {
            available: imageryResult?.hasImagery || false,
            capturedAt: imageryResult?.images?.[0]?.captureDate || undefined,
          },
        });
        setContextScore(score);
      });
    } else {
      setAmenitySummary(null);
      setContextScore(null);
    }

    return () => {
      active = false;
    };
  }, [
    activeRoute?.id,
    daylightEstimate?.solarState,
    daylightEstimate?.solarElevationDeg,
    imageryResult?.hasImagery,
    imageryResult?.images,
  ]);

  return {
    daylightEstimate,
    amenitySummary,
    contextScore,
  };
}
