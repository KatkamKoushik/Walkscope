import { useState, useEffect } from 'react';
import {
  activeImageryProvider,
  PanoramaxSearchResult,
  RouteImageryCoverageResult,
} from '../services/imageryAdapter';
import type { LocationPoint } from '../services/geocodingService';

export interface UseStreetImageryReturn {
  imageryResult: (PanoramaxSearchResult & Partial<RouteImageryCoverageResult>) | null;
  isLoadingImagery: boolean;
  showImagery: boolean;
  setShowImagery: (show: boolean) => void;
  checkStreetImagery: () => Promise<void>;
}

export function useStreetImagery(
  origin: LocationPoint | null,
  activeRoute?: any
): UseStreetImageryReturn {
  const [imageryResult, setImageryResult] = useState<(PanoramaxSearchResult & Partial<RouteImageryCoverageResult>) | null>(null);
  const [isLoadingImagery, setIsLoadingImagery] = useState(false);
  const [showImagery, setShowImagery] = useState(false);

  // Automatically fetch street imagery along route checkpoints or origin
  useEffect(() => {
    let active = true;

    if (activeRoute?.geometry?.coordinates && activeRoute.geometry.coordinates.length >= 2) {
      // 1. Full route corridor checkpoint sampling (5 points)
      activeImageryProvider
        .sampleRouteImagery(activeRoute.geometry.coordinates, 5)
        .then((coverage) => {
          if (!active) return;
          setImageryResult({
            ok: coverage.hasCoverage,
            status: coverage.hasCoverage ? 'FOUND' : 'NO_IMAGERY_FOUND',
            hasImagery: coverage.hasCoverage,
            images: coverage.sampleImages,
            coverageRatio: coverage.coverageRatio,
            sampledCheckpoints: coverage.sampledCheckpoints,
            availableCheckpoints: coverage.availableCheckpoints,
            samplingMode: coverage.samplingMode,
            originImage: coverage.originImage,
            disclaimer: coverage.disclaimer,
          });
        })
        .catch(() => {});
    } else if (origin) {
      // 2. Fallback to origin-only sampling before route calculation
      activeImageryProvider
        .searchNearby(origin.latitude, origin.longitude, { radiusM: 100, limit: 3 })
        .then((res) => {
          if (!active) return;
          setImageryResult({
            ...res,
            coverageRatio: res.hasImagery ? 1.0 : 0.0,
            sampledCheckpoints: 1,
            availableCheckpoints: res.hasImagery ? 1 : 0,
            samplingMode: 'origin_only',
            disclaimer: 'Imagery sampled near starting point only; corridor coverage not verified.',
          });
        })
        .catch(() => {});
    } else {
      setImageryResult(null);
    }

    return () => {
      active = false;
    };
  }, [
    origin?.latitude,
    origin?.longitude,
    activeRoute?.id,
    activeRoute?.distanceMeters,
  ]);

  const checkStreetImagery = async () => {
    if (!origin) return;
    setIsLoadingImagery(true);
    setShowImagery(true);

    if (activeRoute?.geometry?.coordinates && activeRoute.geometry.coordinates.length >= 2) {
      const coverage = await activeImageryProvider.sampleRouteImagery(activeRoute.geometry.coordinates, 5);
      setIsLoadingImagery(false);
      setImageryResult({
        ok: coverage.hasCoverage,
        status: coverage.hasCoverage ? 'FOUND' : 'NO_IMAGERY_FOUND',
        hasImagery: coverage.hasCoverage,
        images: coverage.sampleImages,
        coverageRatio: coverage.coverageRatio,
        sampledCheckpoints: coverage.sampledCheckpoints,
        availableCheckpoints: coverage.availableCheckpoints,
        samplingMode: coverage.samplingMode,
        originImage: coverage.originImage,
        disclaimer: coverage.disclaimer,
      });
    } else {
      const res = await activeImageryProvider.searchNearby(origin.latitude, origin.longitude, {
        radiusM: 100,
        limit: 3,
      });
      setIsLoadingImagery(false);
      setImageryResult({
        ...res,
        coverageRatio: res.hasImagery ? 1.0 : 0.0,
        sampledCheckpoints: 1,
        availableCheckpoints: res.hasImagery ? 1 : 0,
        samplingMode: 'origin_only',
        disclaimer: 'Imagery sampled near starting point only; corridor coverage not verified.',
      });
    }
  };

  return {
    imageryResult,
    isLoadingImagery,
    showImagery,
    setShowImagery,
    checkStreetImagery,
  };
}
