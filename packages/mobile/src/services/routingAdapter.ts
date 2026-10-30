/**
 * @module routingAdapter
 * @description Pluggable pedestrian routing adapter interface and implementation.
 * 
 * Supports both WalkWise Geospatial Gateway (with Redis caching and request deduplication)
 * and direct OpenStreetMap OSRM failover.
 */

import { Platform } from 'react-native';
import {
  calculatePedestrianRoutes,
  ClientRouteResult,
  RoutingCoord,
} from '../../../core/providers/routing/clientRoutingService';

export type { RoutingCoord, ClientRouteResult };

export interface RoutingProviderMetadata {
  id: string;
  name: string;
  isDevelopmentProvider: boolean;
  attribution: string;
  termsUrl: string;
}

export interface IRoutingProvider {
  metadata: RoutingProviderMetadata;
  getWalkingRoutes(
    origin: RoutingCoord,
    destination: RoutingCoord,
    options?: { timeoutMs?: number }
  ): Promise<ClientRouteResult>;
}

export const GATEWAY_BASE_URL =
  process.env.EXPO_PUBLIC_GATEWAY_URL ||
  (Platform.OS === 'android' ? 'http://127.0.0.1:3000' : 'http://localhost:3000');

/**
 * Production Gateway Routing Provider
 * Communicates with packages/server for rate-limiting shields and Redis caching.
 * Transparently falls back to client-direct OSRM if gateway is unavailable.
 */
export class GatewayRoutingProvider implements IRoutingProvider {
  public readonly metadata: RoutingProviderMetadata = {
    id: 'walkscope-gateway',
    name: 'Walkscope Gateway (Fastify + Cache)',
    isDevelopmentProvider: false,
    attribution: 'Route data © OpenStreetMap contributors, Walkscope Gateway',
    termsUrl: 'https://operations.osmfoundation.org/policies/routing/',
  };

  private gatewayUrl: string;

  constructor(gatewayUrl = GATEWAY_BASE_URL) {
    this.gatewayUrl = gatewayUrl;
  }

  async getWalkingRoutes(
    origin: RoutingCoord,
    destination: RoutingCoord,
    options: { timeoutMs?: number } = {}
  ): Promise<ClientRouteResult> {
    const timeoutMs = options.timeoutMs || 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/routes/pedestrian`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, timeoutMs }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return await res.json();
      }
    } catch {
      clearTimeout(timer);
    }

    // Failover to client-direct routing
    return calculatePedestrianRoutes(origin, destination, options);
  }
}

/**
 * Direct OSRM Development Provider.
 * Suitable for standalone device testing without running packages/server.
 */
export class OsrmDevelopmentRoutingProvider implements IRoutingProvider {
  public readonly metadata: RoutingProviderMetadata = {
    id: 'osrm-foot-dev',
    name: 'OpenStreetMap OSRM (Direct Dev)',
    isDevelopmentProvider: true,
    attribution: 'Route data © OpenStreetMap contributors, OSRM',
    termsUrl: 'https://operations.osmfoundation.org/policies/routing/',
  };

  async getWalkingRoutes(
    origin: RoutingCoord,
    destination: RoutingCoord,
    options: { timeoutMs?: number } = {}
  ): Promise<ClientRouteResult> {
    return calculatePedestrianRoutes(origin, destination, options);
  }
}

// Active singleton instance (defaults to Gateway with direct fallback)
export let activeRoutingProvider: IRoutingProvider = new GatewayRoutingProvider();

export function setRoutingProvider(provider: IRoutingProvider) {
  activeRoutingProvider = provider;
}
