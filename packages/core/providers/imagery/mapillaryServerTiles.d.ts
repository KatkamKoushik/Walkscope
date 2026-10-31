export function mapillaryToken(): string;

export class TileUpstreamError extends Error {
  status: number;
  retryAfter: string | null;
  constructor(status: number, message?: string, retryAfter?: string | null);
}

export function parseTilePath(pathname: string): { z: number; x: number; y: number; key: string } | null;

export function fetchTile(
  address: { z: number; x: number; y: number; key: string },
  options?: { signal?: AbortSignal }
): Promise<{ bytes: Buffer; source: 'memory' | 'inflight' | 'upstream' }>;

export function _resetTileCacheForTest(): void;

