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
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Select Route ${index + 1}`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
    marginVertical: 8,
  },
  routeCard: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 165,
    minHeight: 76,
    justifyContent: 'center',
  },
  selectedRouteCard: {
    borderColor: '#38BDF8',
    backgroundColor: '#131C2E',
  },
  cardBadge: {
    marginBottom: 4,
  },
  cardBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedBadgeText: {
    color: '#38BDF8',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  durationBig: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginRight: 6,
  },
  distanceSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  turnsDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
});

