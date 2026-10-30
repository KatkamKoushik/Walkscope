import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface RouteComparisonCardsProps {
  routes: any[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
}

export function RouteComparisonCards({
  routes,
  selectedRouteId,
  onSelectRoute,
}: RouteComparisonCardsProps) {
  if (!routes || routes.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll}>
      {routes.map((route: any, index: number) => {
        const isSelected = route.id === (selectedRouteId || routes[0]?.id);
        return (
          <TouchableOpacity
            key={route.id}
            style={[styles.routeCard, isSelected && styles.selectedRouteCard]}
            onPress={() => onSelectRoute(route.id)}
            accessibilityLabel={`Select Route ${index + 1}`}
          >
            <View style={styles.cardBadge}>
              <Text style={[styles.cardBadgeText, isSelected && styles.selectedBadgeText]}>
                Route {index + 1} {index === 0 ? '• Recommended' : '• Alternative'}
              </Text>
            </View>
            <View style={styles.metricsRow}>
              <Text style={styles.durationBig}>{route.durationFormatted}</Text>
              <Text style={styles.distanceSmall}>({route.distanceFormatted})</Text>
            </View>
            <Text style={styles.turnsDetail}>{route.turnsCount} turn maneuvers</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardScroll: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  routeCard: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    width: 160,
  },
  selectedRouteCard: {
    borderColor: '#38BDF8',
    backgroundColor: '#0C2340',
  },
  cardBadge: {
    marginBottom: 4,
  },
  cardBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  selectedBadgeText: {
    color: '#38BDF8',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  durationBig: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F1F5F9',
    marginRight: 6,
  },
  distanceSmall: {
    fontSize: 12,
    color: '#94A3B8',
  },
  turnsDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});

