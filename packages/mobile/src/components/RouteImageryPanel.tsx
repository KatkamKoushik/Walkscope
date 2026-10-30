import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import type { PanoramaxSearchResult } from '../services/imageryAdapter';

interface RouteImageryPanelProps {
  isLoading: boolean;
  result: PanoramaxSearchResult | null;
  onClose: () => void;
}

export function RouteImageryPanel({ isLoading, result, onClose }: RouteImageryPanelProps) {
  return (
    <View style={styles.imageryPanel}>
      <View style={styles.imageryHeaderRow}>
        <Text style={styles.imageryTitle}>Panoramax Street Imagery</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close Photos Panel">
          <Text style={styles.imageryClose}>✕ Close</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.imageryLoading}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.imageryLoadingText}>Searching open street imagery...</Text>
        </View>
      ) : result && result.hasImagery && result.images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {result.images.map((img) => (
            <View key={img.id} style={styles.imageCard}>
              {img.thumbUrl ? (
                <Image source={{ uri: img.thumbUrl }} style={styles.imageThumb} resizeMode="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>No preview</Text>
                </View>
              )}
              <View style={styles.imageMeta}>
                <Text style={styles.imageDate}>
                  {img.captureDate ? new Date(img.captureDate).toLocaleDateString() : 'Historical'}
                </Text>
                <Text style={styles.imagePanoType}>{img.is360Panorama ? '360°' : 'Flat'}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noImageryBox}>
          <Text style={styles.noImageryText}>
            No street-level imagery currently available near this point on Panoramax.
          </Text>
          <Text style={styles.noImageryNote}>
            Route planning remains fully usable without imagery.
          </Text>
        </View>
      )}

      <Text style={styles.imageryAttribution}>
        Photos © Panoramax contributors (CC-BY-SA 4.0)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  imageryPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imageryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  imageryTitle: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
  },
  imageryClose: {
    color: '#94A3B8',
    fontSize: 11,
  },
  imageryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  imageryLoadingText: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 8,
  },
  imageScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  imageCard: {
    width: 110,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  imageThumb: {
    width: 110,
    height: 70,
  },
  imagePlaceholder: {
    width: 110,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#334155',
  },
  imagePlaceholderText: {
    color: '#94A3B8',
    fontSize: 10,
  },
  imageMeta: {
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageDate: {
    color: '#94A3B8',
    fontSize: 9,
  },
  imagePanoType: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '700',
  },
  noImageryBox: {
    paddingVertical: 6,
  },
  noImageryText: {
    color: '#94A3B8',
    fontSize: 11,
    fontStyle: 'italic',
  },
  noImageryNote: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  imageryAttribution: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 4,
  },
});

