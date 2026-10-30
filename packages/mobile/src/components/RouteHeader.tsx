import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar } from 'react-native';

interface RouteHeaderProps {
  onOpenSavedJourneys: () => void;
}

export function RouteHeader({ onOpenSavedJourneys }: RouteHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.appTitle}>Walkscope</Text>
          <View style={styles.devBadge}>
            <Text style={styles.devBadgeText}>OSRM Dev Provider</Text>
          </View>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onOpenSavedJourneys}
            accessibilityLabel="Saved Journeys"
          >
            <Text style={styles.headerIconText}>⭐ Saved</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.disclaimerText}>
        Pedestrian routes via OpenStreetMap OSRM. No unverified "safety scores".
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight || 28) + 8,
    paddingBottom: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#38BDF8',
  },
  devBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginLeft: 8,
  },
  devBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  headerIconButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerIconText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
});
