import { useState } from 'react';
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
