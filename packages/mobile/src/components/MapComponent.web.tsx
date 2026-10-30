/**
 * @file MapComponent.web.tsx
 * @description Decoupled web map fallback for browser preview (npx expo start --web).
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { RoutingCoord } from '../services/routingAdapter';

export interface MapRouteItem {
  id: string;
  coordinates: [number, number][]; // [lon, lat]
  isSelected: boolean;
}

export interface MapComponentProps {
  origin: RoutingCoord | null;
  destination: RoutingCoord | null;
  routes: MapRouteItem[];
  onSelectRoute?: (id: string) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  origin,
  destination,
  routes,
  onSelectRoute,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.webHeader}>
        <Text style={styles.webTitle}>Interactive Route Map (Web Fallback)</Text>
        <Text style={styles.webSub}>
          Android native build uses @maplibre/maplibre-react-native.
        </Text>
      </View>

      <View style={styles.mapCanvas}>
        {/* Origin Pin */}
        {origin && (
          <View style={[styles.pinBadge, styles.originBadge]}>
            <Text style={styles.pinText}>Start (A): {origin.latitude.toFixed(4)}, {origin.longitude.toFixed(4)}</Text>
          </View>
        )}

        {/* Destination Pin */}
        {destination && (
          <View style={[styles.pinBadge, styles.destBadge]}>
            <Text style={styles.pinText}>Destination (B): {destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}</Text>
          </View>
        )}

        {/* Visual Route Representations */}
        <View style={styles.routesContainer}>
          {routes.length === 0 ? (
            <Text style={styles.emptyPrompt}>Select origin and destination to view real pedestrian routes.</Text>
          ) : (
            routes.map((r, i) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.routePill, r.isSelected ? styles.selectedPill : styles.unselectedPill]}
                onPress={() => onSelectRoute?.(r.id)}
              >
                <Text style={[styles.pillText, r.isSelected ? styles.selectedText : styles.unselectedText]}>
                  Route Alternative {i + 1} ({r.coordinates.length} waypoints) {r.isSelected ? '★ Active' : ''}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
  },
  webHeader: {
    marginBottom: 12,
  },
  webTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  webSub: {
    color: '#94A3B8',
    fontSize: 12,
  },
  mapCanvas: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    justifyContent: 'center',
  },
  pinBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  originBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  destBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  pinText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  routesContainer: {
    marginTop: 16,
  },
  routePill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedPill: {
    backgroundColor: '#0284C7',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  unselectedPill: {
    backgroundColor: '#334155',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  unselectedText: {
    color: '#CBD5E1',
  },
  emptyPrompt: {
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
