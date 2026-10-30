export interface PanoramaxImage {
  id: string;
  latitude: number;
  longitude: number;
  captureDate: string | null;
  is360Panorama: boolean;
  headingDeg: number | null;
  thumbUrl: string | null;
  fullUrl: string | null;
  attribution: string;
  cameraModel?: string;
}

export interface PanoramaxSearchResult {
  ok: boolean;
  hasImagery: boolean;
  images: PanoramaxImage[];
  status: 'FOUND' | 'NO_IMAGERY_FOUND' | 'ERROR';
  message?: string;
}

export declare const PANORAMAX_ATTRIBUTION: string;

export declare function normalizePanoramaxItem(item: any): PanoramaxImage | null;

export declare function findStreetImageryNear(
  lat: number,
  lon: number,
  options?: {
    radiusM?: number;
    limit?: number;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  }
): Promise<PanoramaxSearchResult>;

