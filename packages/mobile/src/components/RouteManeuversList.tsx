import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface RouteManeuversListProps {
  steps: any[];
}

export function RouteManeuversList({ steps }: RouteManeuversListProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <View style={styles.maneuversList}>
      <Text style={styles.maneuversHeading}>Directions for Selected Route:</Text>
      {steps.map((step: any, idx: number) => (
        <View key={idx} style={styles.maneuverRow}>
          <Text style={styles.stepNum}>{idx + 1}.</Text>
          <View style={styles.stepBody}>
            <Text style={styles.stepInstruction}>{step.instruction}</Text>
            <Text style={styles.stepSub}>
              {step.distanceMeters > 0 ? `${step.distanceMeters}m` : 'Destination reached'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  maneuversList: {
    marginTop: 6,
  },
  maneuversHeading: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  maneuverRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  stepNum: {
    color: '#38BDF8',
    fontSize: 12,
    width: 20,
    fontWeight: '700',
  },
  stepBody: {
    flex: 1,
  },
  stepInstruction: {
    color: '#F1F5F9',
    fontSize: 12,
  },
  stepSub: {
    color: '#64748B',
    fontSize: 10,
  },
});

