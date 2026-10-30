import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BENCHMARK_POINTS,
  LocationPoint,
  requestDeviceLocation,
  searchDestinations,
} from '../services/geocodingService';
import { activeRoutingProvider } from '../services/routingAdapter';
import type { ClientRouteResult } from '../../../core/providers/routing/clientRoutingService';
import type { SavedJourney } from '../services/storageService';

export interface UseWalkingRouteReturn {
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  setOrigin: (point: LocationPoint | null) => void;
  setDestination: (point: LocationPoint | null) => void;
  searchTarget: 'origin' | 'destination';
  setSearchTarget: (target: 'origin' | 'destination') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: LocationPoint[];
  isSearching: boolean;
  routingResult: ClientRouteResult | null;
  selectedRouteId: string | null;
  setSelectedRouteId: (id: string | null) => void;
  activeRoute: any;
  isLoadingRoutes: boolean;
  statusMessage: string | null;
  computeRoutes: (options?: { timeoutMs?: number; simulateRateLimit?: boolean }) => Promise<void>;
  handleUseGps: () => Promise<void>;
  handleSelectSavedJourney: (saved: SavedJourney) => void;
}

export function useWalkingRoute(): UseWalkingRouteReturn {
  const [origin, setOrigin] = useState<LocationPoint | null>(BENCHMARK_POINTS[0]); // Trafalgar Square
  const [destination, setDestination] = useState<LocationPoint | null>(BENCHMARK_POINTS[1]); // Covent Garden
  const [searchTarget, setSearchTarget] = useState<'origin' | 'destination'>('destination');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationPoint[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Routing State
  const [routingResult, setRoutingResult] = useState<ClientRouteResult | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const routeRequestSeq = useRef(0);

  // Trigger geocoding search with 250ms debounce
  useEffect(() => {
    let active = true;
    if (searchQuery.trim().length > 1) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        searchDestinations(searchQuery).then((results) => {
          if (active) {
            setSearchResults(results);
            setIsSearching(false);
          }
        });
      }, 250);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
    return () => {
      active = false;
    };
  }, [searchQuery]);

  // Request pedestrian routes whenever origin & destination are set
  const computeRoutes = useCallback(
    async (options?: { timeoutMs?: number; simulateRateLimit?: boolean }) => {
      const seq = ++routeRequestSeq.current;

      if (options?.simulateRateLimit) {
        setIsLoadingRoutes(true);
        setStatusMessage(null);
        setRoutingResult(null);
        setTimeout(() => {
          if (seq === routeRequestSeq.current) {
            setIsLoadingRoutes(false);
            setStatusMessage('Routing service is rate-limited (HTTP 429). Please wait a moment before retrying.');
          }
        }, 500);
        return;
      }

      if (!origin || !destination) {
        setStatusMessage('Please select both a start point and destination.');
        return;
      }

      setIsLoadingRoutes(true);
      setStatusMessage(null);
      setRoutingResult(null);

      const result = await activeRoutingProvider.getWalkingRoutes(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
        options
      );

      // Discard stale in-flight responses
      if (seq !== routeRequestSeq.current) return;

      setIsLoadingRoutes(false);
      setRoutingResult(result);

      if (result.ok && result.routes.length > 0) {
        setSelectedRouteId(result.routes[0].id);
      } else if (result.status === 'NO_ROUTE_FOUND') {
        setStatusMessage('No pedestrian walking route found between these locations.');
      } else {
        setStatusMessage(result.message || 'Unable to calculate route.');
      }
    },
    [origin, destination]
  );

  // Initial calculation on mount / coordinate change
  useEffect(() => {
    computeRoutes();
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude, computeRoutes]);

  // Active route reference
  const activeRoute = routingResult?.routes.find((r) => r.id === selectedRouteId) || routingResult?.routes[0];

  // GPS Current Location Handler
  const handleUseGps = async () => {
    setIsLoadingRoutes(true);
    setStatusMessage('Acquiring current GPS location...');
    const res = await requestDeviceLocation();
    setIsLoadingRoutes(false);

    if (res.ok && res.point) {
      setOrigin(res.point);
      setStatusMessage(null);
    } else {
      setStatusMessage(res.message || 'Could not access GPS.');
    }
  };

  // Select Saved Journey
  const handleSelectSavedJourney = (saved: SavedJourney) => {
    setOrigin({
      title: saved.origin_name,
      subtitle: 'Saved Location',
      latitude: saved.origin_lat,
      longitude: saved.origin_lon,
    });
    setDestination({
      title: saved.dest_name,
      subtitle: 'Saved Location',
      latitude: saved.dest_lat,
      longitude: saved.dest_lon,
    });
  };

  return {
    origin,
    destination,
    setOrigin,
    setDestination,
    searchTarget,
    setSearchTarget,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    routingResult,
    selectedRouteId,
    setSelectedRouteId,
    activeRoute,
    isLoadingRoutes,
    statusMessage,
    computeRoutes,
    handleUseGps,
    handleSelectSavedJourney,
  };
}
