/**
 * @file MapComponent.web.tsx
 * @description Decoupled web map fallback for browser preview with live Leaflet OpenStreetMap canvas.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { RoutingCoord } from '../services/routingAdapter';

export interface MapRouteItem {
  id: string;
  coordinates: [number, number][]; // [lon, lat]
  isSelected: boolean;
}

export interface MapAmenityItem {
  id: string;
  name: string;
  category: 'transit' | 'emergency' | 'services' | 'lighting' | 'other' | string;
  coordinates: [number, number]; // [lon, lat]
}

export interface MapPhotoItem {
  id: string;
  latitude: number;
  longitude: number;
  headingDeg?: number | null;
}

export interface MapComponentProps {
  origin: RoutingCoord | null;
  destination: RoutingCoord | null;
  routes: MapRouteItem[];
  amenities?: MapAmenityItem[];
  streetPhotos?: MapPhotoItem[];
  onSelectRoute?: (id: string) => void;
  onSelectAmenity?: (amenity: MapAmenityItem) => void;
  onSelectPhoto?: (photo: MapPhotoItem) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  origin,
  destination,
  routes,
  amenities,
  streetPhotos,
  onSelectRoute,
}) => {
  const mapHtml = useMemo(() => {
    const defaultCenter = origin
      ? [origin.latitude, origin.longitude]
      : destination
      ? [destination.latitude, destination.longitude]
      : [51.5080, -0.1281]; // London Trafalgar Square

    const originJson = origin ? JSON.stringify(origin) : 'null';
    const destinationJson = destination ? JSON.stringify(destination) : 'null';
    const routesJson = JSON.stringify(routes || []);
    const amenitiesJson = JSON.stringify(amenities || []);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #090D16; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .leaflet-tile { filter: brightness(0.65) invert(1) contrast(3) hue-rotate(200deg) saturate(0.35); }
    .pin-circle { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: #FFFFFF; border: 2px solid #FFFFFF; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
    .pin-origin { background: #10B981; }
    .pin-dest { background: #EF4444; }
    .amenity-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #FFFFFF; box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${defaultCenter[0]}, ${defaultCenter[1]}], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var origin = ${originJson};
    var destination = ${destinationJson};
    var routes = ${routesJson};
    var amenities = ${amenitiesJson};
    var bounds = [];

    if (origin) {
      var iconA = L.divIcon({
        className: 'custom-icon',
        html: '<div class="pin-circle pin-origin">A</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      L.marker([origin.latitude, origin.longitude], { icon: iconA }).addTo(map);
      bounds.push([origin.latitude, origin.longitude]);
    }

    if (destination) {
      var iconB = L.divIcon({
        className: 'custom-icon',
        html: '<div class="pin-circle pin-dest">B</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      L.marker([destination.latitude, destination.longitude], { icon: iconB }).addTo(map);
      bounds.push([destination.latitude, destination.longitude]);
    }

    routes.forEach(function(r) {
      if (r.coordinates && r.coordinates.length > 0) {
        var latLngs = r.coordinates.map(function(c) { return [c[1], c[0]]; });
        var color = r.isSelected ? '#0284C7' : '#94A3B8';
        var weight = r.isSelected ? 6 : 4;
        var opacity = r.isSelected ? 0.95 : 0.6;
        L.polyline(latLngs, { color: color, weight: weight, opacity: opacity, lineCap: 'round', lineJoin: 'round' }).addTo(map);
        latLngs.forEach(function(pt) { bounds.push(pt); });
      }
    });

    amenities.forEach(function(a) {
      if (a.coordinates) {
        var color = a.category === 'emergency' ? '#10B981' : a.category === 'transit' ? '#F59E0B' : '#38BDF8';
        var amIcon = L.divIcon({
          className: 'custom-icon',
          html: '<div class="amenity-dot" style="background:' + color + '"></div>',
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });
        L.marker([a.coordinates[1], a.coordinates[0]], { icon: amIcon }).addTo(map);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  </script>
</body>
</html>`;
  }, [origin, destination, routes, amenities]);

  return (
    <View style={styles.container}>
      {React.createElement('iframe', {
        srcDoc: mapHtml,
        style: styles.webIframe,
        title: 'Walkscope Map Viewport',
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  webIframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: '#090D16',
  },
});
