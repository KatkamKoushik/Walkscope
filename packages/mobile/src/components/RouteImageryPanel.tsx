import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal } from 'react-native';
import type { PanoramaxSearchResult, PanoramaxImage } from '../services/imageryAdapter';

interface RouteImageryPanelProps {
  isLoading: boolean;
  result: PanoramaxSearchResult | null;
  onClose: () => void;
}

export function RouteImageryPanel({ isLoading, result, onClose }: RouteImageryPanelProps) {
  const [selectedImage, setSelectedImage] = useState<PanoramaxImage | null>(null);

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
            <TouchableOpacity
              key={img.id}
              style={styles.imageCard}
              onPress={() => setSelectedImage(img)}
              accessibilityLabel={`View full photo captured on ${img.captureDate || 'historical'}`}
            >
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
            </TouchableOpacity>
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
        Photos © Panoramax contributors (CC-BY-SA 4.0) • Tap image to inspect
      </Text>

      {/* Full Photo Inspection Modal */}
      {selectedImage && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setSelectedImage(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedImage.is360Panorama ? '360° Panorama' : 'Street Photo'} (
                  {selectedImage.captureDate ? new Date(selectedImage.captureDate).toLocaleDateString() : 'Historical'}
                  )
                </Text>
                <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Image
                source={{ uri: selectedImage.fullUrl || selectedImage.thumbUrl || undefined }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              <View style={styles.modalFooter}>
                <Text style={styles.modalSub}>
                  Position: {selectedImage.latitude.toFixed(5)}, {selectedImage.longitude.toFixed(5)}
                  {selectedImage.headingDeg != null ? ` • Heading: ${Math.round(selectedImage.headingDeg)}°` : ''}
                </Text>
                <Text style={styles.modalSub}>Source: Panoramax Open Imagery (CC-BY-SA 4.0)</Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1E293B',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  fullImage: {
    width: '100%',
    height: 320,
    backgroundColor: '#020617',
  },
  modalFooter: {
    padding: 12,
    backgroundColor: '#1E293B',
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
});

