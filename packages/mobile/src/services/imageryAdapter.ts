/**
 * @module imageryAdapter
 * @description Pluggable street-level imagery provider adapter with route corridor sampling.
 */

import { Platform } from 'react-native';
import {
  findStreetImageryNear,
  PanoramaxImage,
  PanoramaxSearchResult,
  PANORAMAX_ATTRIBUTION,
} from '../../../core/providers/imagery/panoramax/client';

export type { PanoramaxImage, PanoramaxSearchResult };

export interface RouteImageryCoverageResult {
  hasCoverage: boolean;
  coverageRatio: number; // 0.0 to 1.0
  sampledCheckpoints: number;
  availableCheckpoints: number;
  originImage: PanoramaxImage | null;
  sampleImages: PanoramaxImage[];
  samplingMode: 'corridor_checkpoints' | 'origin_only';
  disclaimer: string;
}

export interface IImageryProvider {
  id: string;
  name: string;
  attribution: string;
  searchNearby(
    lat: number,
    lon: number,
    options?: { radiusM?: number; limit?: number; signal?: AbortSignal }
  ): Promise<PanoramaxSearchResult>;
  sampleRouteImagery(
    polyline: Array<[number, number]>,
    sampleCount?: number,
    options?: { radiusM?: number; signal?: AbortSignal }
  ): Promise<RouteImageryCoverageResult>;
}

export const GATEWAY_BASE_URL =
  process.env.EXPO_PUBLIC_GATEWAY_URL ||
  (Platform.OS === 'android' ? 'http://127.0.0.1:3000' : 'http://localhost:3000');

export class PanoramaxImageryProvider implements IImageryProvider {
  public readonly id = 'panoramax';
  public readonly name = 'Panoramax Open Street Imagery';
  public readonly attribution = PANORAMAX_ATTRIBUTION;
  private gatewayUrl: string;

  constructor(gatewayUrl = GATEWAY_BASE_URL) {
    this.gatewayUrl = gatewayUrl;
  }

  async searchNearby(
    lat: number,
    lon: number,
    options: { radiusM?: number; limit?: number; signal?: AbortSignal } = {}
  ): Promise<PanoramaxSearchResult> {
    const radiusM = options.radiusM || 100;
    const limit = options.limit || 3;

    // 1. Attempt cached retrieval via Geospatial Gateway
    try {
      const url = `${this.gatewayUrl}/api/v1/imagery/nearby?lat=${lat}&lon=${lon}&radiusM=${radiusM}&limit=${limit}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: options.signal,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Gateway unreachable; proceed to direct provider fallback
    }

    // 2. Direct client fallback for standalone operation
    return findStreetImageryNear(lat, lon, options);
  }

  async sampleRouteImagery(
    polyline: Array<[number, number]>,
    sampleCount = 5,
    options: { radiusM?: number; signal?: AbortSignal } = {}
  ): Promise<RouteImageryCoverageResult> {
    if (!polyline || polyline.length === 0) {
      return {
        hasCoverage: false,
        coverageRatio: 0,
        sampledCheckpoints: 0,
        availableCheckpoints: 0,
        originImage: null,
        sampleImages: [],
        samplingMode: 'origin_only',
        disclaimer: 'No route polyline coordinates available to sample.',
      };
    }

    if (polyline.length === 1) {
      const single = await this.searchNearby(polyline[0][1], polyline[0][0], { ...options, limit: 1 });
      return {
        hasCoverage: single.hasImagery,
        coverageRatio: single.hasImagery ? 1.0 : 0.0,
        sampledCheckpoints: 1,
        availableCheckpoints: single.hasImagery ? 1 : 0,
        originImage: single.images[0] || null,
        sampleImages: single.images,
        samplingMode: 'origin_only',
        disclaimer: 'Imagery sampled near starting point only; corridor coverage not verified.',
      };
    }

    // Pick evenly-spaced checkpoint indices along the route polyline
    const count = Math.max(2, Math.min(sampleCount, polyline.length));
    const checkpointIndices = new Set<number>();
    checkpointIndices.add(0);
    checkpointIndices.add(polyline.length - 1);

    for (let i = 1; i < count - 1; i++) {
      const idx = Math.round((i / (count - 1)) * (polyline.length - 1));
      checkpointIndices.add(idx);
    }

    const indices = Array.from(checkpointIndices).sort((a, b) => a - b);
    const promises = indices.map((idx) => {
      const coord = polyline[idx];
      return this.searchNearby(coord[1], coord[0], { radiusM: options.radiusM || 100, limit: 1, signal: options.signal })
        .catch(() => ({ hasImagery: false, images: [], totalCount: 0 }));
    });

    const results = await Promise.all(promises);
    let availableCount = 0;
    const collectedImages: PanoramaxImage[] = [];

    for (const res of results) {
      if (res.hasImagery && res.images.length > 0) {
        availableCount++;
        collectedImages.push(res.images[0]);
      }
    }

    const coverageRatio = Number((availableCount / indices.length).toFixed(2));
    const percent = Math.round(coverageRatio * 100);

    return {
      hasCoverage: availableCount > 0,
      coverageRatio,
      sampledCheckpoints: indices.length,
      availableCheckpoints: availableCount,
      originImage: results[0]?.images?.[0] || null,
      sampleImages: collectedImages,
      samplingMode: 'corridor_checkpoints',
      disclaimer: `Sampled ${indices.length} checkpoints along corridor: ${availableCount}/${indices.length} (${percent}%) have verified street imagery.`,
    };
  }
}

export const activeImageryProvider: IImageryProvider = new PanoramaxImageryProvider();
