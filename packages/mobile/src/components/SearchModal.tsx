import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import type { LocationPoint } from '../services/geocodingService';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  searchTarget: 'origin' | 'destination';
  setSearchTarget: (target: 'origin' | 'destination') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: LocationPoint[];
  onSelectResult: (item: LocationPoint) => void;
  onUseGps: () => void;
  onSelectPreset: (origin: LocationPoint, destination: LocationPoint) => void;
  origin: LocationPoint | null;
  destination: LocationPoint | null;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  onClose,
  searchTarget,
  setSearchTarget,
  searchQuery,
  setSearchQuery,
  searchResults,
  onSelectResult,
  onUseGps,
  onSelectPreset,
  origin,
  destination,
}) => {
  const PRESET_ROUTES = [
    {
      title: 'Bengaluru: MG Road to Brigade Road',
      subtitle: 'Mapped OSM sidewalk & commercial amenities',
      origin: {
        title: 'MG Road Metro',
        latitude: 12.9756,
        longitude: 77.6066,
      },
      destination: {
        title: 'Brigade Road Junction',
        latitude: 12.9719,
        longitude: 77.607,
      },
    },
    {
      title: 'London: Oxford Circus to Piccadilly',
      subtitle: 'High density pedestrian corridor',
      origin: {
        title: 'Oxford Circus',
        latitude: 51.5152,
        longitude: -0.1419,
      },
      destination: {
        title: 'Piccadilly Circus',
        latitude: 51.5101,
        longitude: -0.1349,
      },
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header & Close Affordance */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Choose Route Points</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close search dialog"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Target Segmented Switcher (Origin vs Destination) */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[
              styles.segmentItem,
              searchTarget === 'origin' && styles.segmentItemActive,
            ]}
            onPress={() => setSearchTarget('origin')}
            accessibilityRole="button"
            accessibilityLabel="Set start origin location"
          >
            <Text
              style={[
                styles.segmentText,
                searchTarget === 'origin' && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              📍 Start: {origin ? origin.title : 'Select'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentItem,
              searchTarget === 'destination' && styles.segmentItemActive,
            ]}
            onPress={() => setSearchTarget('destination')}
            accessibilityRole="button"
            accessibilityLabel="Set walk destination location"
          >
            <Text
              style={[
                styles.segmentText,
                searchTarget === 'destination' && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              🏁 End: {destination ? destination.title : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar Input */}
        <View style={styles.searchBarRow}>
          <View style={styles.inputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.textInput}
              placeholder={`Search ${searchTarget === 'origin' ? 'start' : 'destination'} address...`}
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              clearButtonMode="while-editing"
              accessibilityLabel="Address search input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearBtn}
                accessibilityLabel="Clear search query"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* GPS Current Location Action Button */}
        {searchTarget === 'origin' && (
          <TouchableOpacity
            style={styles.gpsRow}
            onPress={() => {
              onUseGps();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Use current GPS location"
          >
            <View style={styles.gpsIconCircle}>
              <Text style={styles.gpsIcon}>🎯</Text>
            </View>
            <View style={styles.gpsTextGroup}>
              <Text style={styles.gpsTitle}>Use Current Location</Text>
              <Text style={styles.gpsSubtitle}>High-accuracy on-device GPS</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Search Results List */}
        {searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => `${item.latitude}_${item.longitude}_${item.title}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => {
                  onSelectResult(item);
                  if (searchTarget === 'origin') {
                    setSearchTarget('destination');
                  } else {
                    onClose();
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.title}`}
              >
                <Text style={styles.resultIcon}>📍</Text>
                <View style={styles.resultTextWrapper}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          /* Presets Section when Query is Empty */
          <View style={styles.presetsWrapper}>
            <Text style={styles.sectionHeading}>Benchmark Curated Corridors</Text>
            {PRESET_ROUTES.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.presetCard}
                onPress={() => {
                  onSelectPreset(p.origin, p.destination);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select preset corridor ${p.title}`}
              >
                <View style={styles.presetHeaderRow}>
                  <Text style={styles.presetTitle}>{p.title}</Text>
                  <Text style={styles.presetBadge}>Mapped Corridor</Text>
                </View>
                <Text style={styles.presetSubtitle}>{p.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  closeBtnText: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '600',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#131C2E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    gap: 6,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentItemActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  segmentText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  searchBarRow: {
    marginBottom: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    minHeight: 44,
  },
  clearBtn: {
    padding: 6,
    minHeight: 32,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    minHeight: 52,
  },
  gpsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gpsIcon: {
    fontSize: 16,
  },
  gpsTextGroup: {
    flex: 1,
  },
  gpsTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  gpsSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131C2E',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    minHeight: 52,
  },
  resultIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  resultTextWrapper: {
    flex: 1,
  },
  resultTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  resultSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  presetsWrapper: {
    marginTop: 8,
  },
  sectionHeading: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingLeft: 4,
  },
  presetCard: {
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  presetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  presetTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  presetBadge: {
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  presetSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
