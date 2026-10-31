import { useState, useEffect } from 'react';
import {
  activeImageryProvider,
  PanoramaxSearchResult,
} from '../services/imageryAdapter';
import type { LocationPoint } from '../services/geocodingService';

export interface UseStreetImageryReturn {
  imageryResult: PanoramaxSearchResult | null;
  isLoadingImagery: boolean;
  showImagery: boolean;
  setShowImagery: (show: boolean) => void;
  checkStreetImagery: () => Promise<void>;
}

export function useStreetImagery(origin: LocationPoint | null): UseStreetImageryReturn {
  const [imageryResult, setImageryResult] = useState<PanoramaxSearchResult | null>(null);
  const [isLoadingImagery, setIsLoadingImagery] = useState(false);
  const [showImagery, setShowImagery] = useState(false);

  // Automatically fetch street imagery for origin in background so Route Context Coverage is accurate
  useEffect(() => {
    if (!origin) {
      setImageryResult(null);
      return;
    }

    let active = true;
    activeImageryProvider
      .searchNearby(origin.latitude, origin.longitude, { radiusM: 100, limit: 3 })
      .then((res) => {
        if (active) setImageryResult(res);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [origin?.latitude, origin?.longitude]);

  const checkStreetImagery = async () => {
    if (!origin) return;
    setIsLoadingImagery(true);
    setShowImagery(true);
    const res = await activeImageryProvider.searchNearby(origin.latitude, origin.longitude, {
      radiusM: 100,
      limit: 3,
    });
    setIsLoadingImagery(false);
    setImageryResult(res);
  };

  return {
    imageryResult,
    isLoadingImagery,
    showImagery,
    setShowImagery,
    checkStreetImagery,
  };
}
