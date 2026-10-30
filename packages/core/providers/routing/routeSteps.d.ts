export declare function normalizeOsrmSteps(
  route: any,
  locale?: string
): { steps: any[]; truncated: boolean };

export declare function roadLabel(
  name?: any,
  ref?: string | null
): string;

export declare function instructionFor(
  step: any,
  locale?: string
): string;

export declare function formatRouteDistance(meters: number): string;
export declare function formatRouteDuration(seconds: number): string;
