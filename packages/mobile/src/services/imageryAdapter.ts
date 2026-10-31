/**
 * @module imageryAdapter
 * @description Pluggable street-level imagery provider adapter.
 */

import { Platform } from 'react-native';
import {
  findStreetImageryNear,
  PanoramaxImage,
  PanoramaxSearchResult,
  PANORAMAX_ATTRIBUTION,
} from '../../../core/providers/imagery/panoramax/client';

export type { PanoramaxImage, PanoramaxSearchResult };

export interface IImageryProvider {
  id: string;
  name: string;
  attribution: string;
  searchNearby(
    lat: number,
    lon: number,
    options?: { radiusM?: number; limit?: number; signal?: AbortSignal }
  ): Promise<PanoramaxSearchResult>;
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
}

export const activeImageryProvider: IImageryProvider = new PanoramaxImageryProvider();

