export interface ContextScoringWeights {
  amenityContext: number;
  transitContext: number;
  imageryCoverage: number;
  roadContext: number;
  turnSimplicity: number;
}

export const DEFAULT_SCORING_WEIGHTS: ContextScoringWeights = {
  amenityContext: 0.35,
  transitContext: 0.20,
  imageryCoverage: 0.25,
  roadContext: 0.10,
  turnSimplicity: 0.10,
};

export interface RouteContextScore {
  routeId: string;
  contextCoverageScore: number; // 0 to 100 normalized score of available information
  normalizedFactors: {
    amenityScore: number;
    transitScore: number;
    imageryScore: number;
    roadScore: number;
    turnScore: number;
  };
  unknownCoverageRatio: number; // 0 to 1 ratio of route segments lacking data
  summaryLabels: string[]; // e.g., ["Fastest available", "More mapped amenities nearby"]
  evaluatedAt: string;
}

