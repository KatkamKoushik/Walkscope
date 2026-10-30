/**
 * @file MapComponent.android.tsx
 * @description Hardware-accelerated native Android vector map using @maplibre/maplibre-react-native 11.5.0.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  CameraRef,
} from '@maplibre/maplibre-react-native';
import { RoutingCoord } from '../services/routingAdapter';

// High-resolution Carto Voyager raster tiles (OpenStreetMap-based, keyless for dev/evaluation)
export const DEFAULT_MAP_STYLE = JSON.stringify({
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors, © CARTO',
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
});

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
  const cameraRef = useRef<CameraRef>(null);

  // Automatically center and fit camera to origin & destination
  useEffect(() => {
    if (!cameraRef.current) return;
    if (origin && destination) {
      const minLon = Math.min(origin.longitude, destination.longitude);
      const maxLon = Math.max(origin.longitude, destination.longitude);
      const minLat = Math.min(origin.latitude, destination.latitude);
      const maxLat = Math.max(origin.latitude, destination.latitude);

      const deltaLon = Math.max(maxLon - minLon, 0.006);
      const deltaLat = Math.max(maxLat - minLat, 0.006);

      cameraRef.current.fitBounds(
        [minLon - deltaLon * 0.25, minLat - deltaLat * 0.25, maxLon + deltaLon * 0.25, maxLat + deltaLat * 0.25],
        { padding: { top: 70, bottom: 70, left: 70, right: 70 }, duration: 900 }
      );
    } else if (origin) {
      cameraRef.current.flyTo({
        center: [origin.longitude, origin.latitude],
        zoom: 14,
        duration: 800,
      });
    }
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude]);

  const centerCoord: [number, number] = origin
    ? [origin.longitude, origin.latitude]
    : [-0.1281, 51.5080]; // Default: Trafalgar Square

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={DEFAULT_MAP_STYLE}
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: centerCoord,
            zoom: 14,
          }}
        />

        {/* Origin Marker */}
        {origin && (
          <Marker id="origin-pin" lngLat={[origin.longitude, origin.latitude]}>
            <View style={[styles.marker, styles.originMarker]}>
              <Text style={styles.markerText}>A</Text>
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker id="destination-pin" lngLat={[destination.longitude, destination.latitude]}>
            <View style={[styles.marker, styles.destMarker]}>
              <Text style={styles.markerText}>B</Text>
            </View>
          </Marker>
        )}

        {/* Route Polylines */}
        {routes.map((route) => {
          const featureCollection: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { id: route.id },
                geometry: {
                  type: 'LineString',
                  coordinates: route.coordinates,
                },
              },
            ],
          };

          return (
            <GeoJSONSource
              key={route.id}
              id={`source-${route.id}`}
              data={featureCollection}
              onPress={() => onSelectRoute?.(route.id)}
            >
              <Layer
                id={`line-${route.id}`}
                type="line"
                paint={{
                  'line-color': route.isSelected ? '#0284C7' : '#94A3B8',
                  'line-width': route.isSelected ? 6 : 4,
                  'line-opacity': route.isSelected ? 0.95 : 0.6,
                }}
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round',
                }}
              />
            </GeoJSONSource>
          );
        })}
      </Map>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  originMarker: {
    backgroundColor: '#10B981', // Emerald
  },
  destMarker: {
    backgroundColor: '#EF4444', // Red
  },
  markerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
