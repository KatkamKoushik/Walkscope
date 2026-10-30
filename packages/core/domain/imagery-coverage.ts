export type ImageryProviderType = 'google' | 'mapillary' | 'kartaview' | 'panoramax';

export interface ImageryCoverage {
  provider: ImageryProviderType;
  available: boolean;
  capturedAt?: string;
  attribution: string;
  viewerUrl?: string;
  isPano?: boolean;
}

export interface RouteImageryAssessment {
  routeId: string;
  provider: ImageryProviderType;
  overallCoveragePercentage: number;
  segmentsWithCoverage: number;
  totalSegments: number;
  oldestCaptureDate?: string;
  newestCaptureDate?: string;
  isKeyless: boolean;
}

