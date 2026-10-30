import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { BENCHMARK_POINTS, LocationPoint } from '../services/geocodingService';

interface RoutePointsCardProps {
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  searchTarget: 'origin' | 'destination';
  setSearchTarget: (target: 'origin' | 'destination') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: LocationPoint[];
  onSelectSearchResult: (point: LocationPoint) => void;
  onUseGps: () => void;
  onSelectPreset: (origin: LocationPoint, dest: LocationPoint) => void;
  onTestTimeout: () => void;
  onTestRateLimit: () => void;
}

export function RoutePointsCard({
  origin,
  destination,
  searchTarget,
  setSearchTarget,
  searchQuery,
  setSearchQuery,
  searchResults,
  onSelectSearchResult,
  onUseGps,
  onSelectPreset,
  onTestTimeout,
  onTestRateLimit,
}: RoutePointsCardProps) {
  return (
    <View style={styles.pointsCard}>
      {/* Origin Row */}
      <TouchableOpacity
        style={[styles.pointRow, searchTarget === 'origin' && styles.activePointRow]}
        onPress={() => {
          setSearchTarget('origin');
          setSearchQuery('');
        }}
      >
        <View style={[styles.pointDot, { backgroundColor: '#10B981' }]} />
        <Text style={styles.pointLabel}>From:</Text>
        <Text style={styles.pointValue} numberOfLines={1}>
          {origin?.title || 'Tap to select origin'}
        </Text>
        <TouchableOpacity style={styles.gpsButton} onPress={onUseGps}>
          <Text style={styles.gpsButtonText}>📍 GPS</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Destination Row */}
      <TouchableOpacity
        style={[styles.pointRow, searchTarget === 'destination' && styles.activePointRow]}
        onPress={() => {
          setSearchTarget('destination');
          setSearchQuery('');
        }}
      >
        <View style={[styles.pointDot, { backgroundColor: '#EF4444' }]} />
        <Text style={styles.pointLabel}>To:</Text>
        <Text style={styles.pointValue} numberOfLines={1}>
          {destination?.title || 'Tap to select destination'}
        </Text>
      </TouchableOpacity>

      {/* Universal Search Box */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${searchTarget === 'origin' ? 'origin' : 'destination'} or landmark...`}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Quick Benchmark & Pilot City Presets */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsBar}>
        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => onSelectPreset(BENCHMARK_POINTS[0], BENCHMARK_POINTS[1])}
        >
          <Text style={styles.presetChipText}>🇬🇧 London (Trafalgar → Covent)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => onSelectPreset(BENCHMARK_POINTS[4], BENCHMARK_POINTS[5])}
        >
          <Text style={styles.presetChipText}>🇮🇳 Bengaluru (MG Rd → Brigade Rd)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => onSelectPreset(BENCHMARK_POINTS[4], BENCHMARK_POINTS[6])}
        >
          <Text style={styles.presetChipText}>🇮🇳 Bengaluru (MG Rd → Cubbon Park)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetChip, styles.testChip]}
          onPress={() =>
            onSelectPreset(
              { title: 'Null Island', subtitle: 'Ocean', latitude: 0.0, longitude: 0.0 },
              { title: 'London', subtitle: 'UK', latitude: 51.508, longitude: -0.1281 }
            )
          }
        >
          <Text style={styles.presetChipText}>🌊 Test Zero Route</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.presetChip, styles.testChip]} onPress={onTestTimeout}>
          <Text style={styles.presetChipText}>⏱ Test Timeout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.presetChip, styles.testChip]} onPress={onTestRateLimit}>
          <Text style={styles.presetChipText}>🛑 Test Rate Limit</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Autocomplete Suggestions */}
      {searchResults.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {searchResults.map((item: LocationPoint, idx: number) => (
            <TouchableOpacity
              key={`${item.title}-${idx}`}
              style={styles.suggestionItem}
              onPress={() => onSelectSearchResult(item)}
            >
              <Text style={styles.suggestionTitle}>{item.title}</Text>
              {item.subtitle && (
                <Text style={styles.suggestionSub} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pointsCard: {
    backgroundColor: '#1E293B',
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  activePointRow: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  pointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  pointLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    width: 44,
  },
  pointValue: {
    color: '#F1F5F9',
    fontSize: 13,
    flex: 1,
  },
  gpsButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gpsButtonText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  searchRow: {
    marginTop: 6,
  },
  searchInput: {
    backgroundColor: '#0F172A',
    color: '#F1F5F9',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetsBar: {
    marginTop: 8,
    flexDirection: 'row',
  },
  presetChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  testChip: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  presetChipText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionsContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  suggestionTitle: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionSub: {
    color: '#64748B',
    fontSize: 11,
  },
});
