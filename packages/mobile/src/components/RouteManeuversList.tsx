import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface RouteManeuversListProps {
  steps: any[];
}

function getManeuverIcon(type?: string, modifier?: string) {
  const text = `${type || ''} ${modifier || ''}`.toLowerCase();
  if (text.includes('left')) return '↰';
  if (text.includes('right')) return '↱';
  if (text.includes('uturn')) return '↶';
  if (text.includes('arrive') || text.includes('destination')) return '🏁';
  if (text.includes('depart') || text.includes('start')) return '🚶';
  return '↑';
}

export function RouteManeuversList({ steps }: RouteManeuversListProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <View style={styles.maneuversList}>
      <Text style={styles.maneuversHeading}>Directions for Selected Route</Text>
      {steps.map((step: any, idx: number) => {
        const icon = getManeuverIcon(step.maneuverType, step.maneuverModifier);
        return (
          <View key={idx} style={styles.maneuverRow}>
            <View style={styles.iconCircle}>
              <Text style={styles.maneuverIcon}>{icon}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepInstruction}>{step.instruction}</Text>
              <Text style={styles.stepSub}>
                {step.distanceMeters > 0 ? `${step.distanceMeters} m` : 'Destination reached'}
                {step.roadName ? ` • ${step.roadName}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  maneuversList: {
    marginTop: 10,
  },
  maneuversHeading: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  maneuverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  maneuverIcon: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '700',
  },
  stepBody: {
    flex: 1,
  },
  stepInstruction: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  stepSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
});

