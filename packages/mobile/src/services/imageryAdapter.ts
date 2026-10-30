/**
 * @module imageryAdapter
 * @description Pluggable street-level imagery provider adapter.
 */

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

export class PanoramaxImageryProvider implements IImageryProvider {
  public readonly id = 'panoramax';
  public readonly name = 'Panoramax Open Street Imagery';
  public readonly attribution = PANORAMAX_ATTRIBUTION;

  async searchNearby(
    lat: number,
    lon: number,
    options: { radiusM?: number; limit?: number; signal?: AbortSignal } = {}
  ): Promise<PanoramaxSearchResult> {
    return findStreetImageryNear(lat, lon, options);
  }
}

export const activeImageryProvider: IImageryProvider = new PanoramaxImageryProvider();

