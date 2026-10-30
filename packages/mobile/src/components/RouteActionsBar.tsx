import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface RouteActionsBarProps {
  onStartWalking: () => void;
  onSaveRoute: () => void;
  onTogglePhotos: () => void;
  onOpenPrivacy: () => void;
  showManeuvers: boolean;
  onToggleManeuvers: () => void;
}

export function RouteActionsBar({
  onStartWalking,
  onSaveRoute,
  onTogglePhotos,
  onOpenPrivacy,
  showManeuvers,
  onToggleManeuvers,
}: RouteActionsBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.actionButtonsRow}
    >
      <TouchableOpacity
        style={[styles.actionBtn, styles.walkModeBtn]}
        onPress={onStartWalking}
        accessibilityLabel="Start Walking Mode"
      >
        <Text style={styles.walkModeBtnText}>🚶 Walk</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onSaveRoute}
        accessibilityLabel="Save Route to Local SQLite"
      >
        <Text style={styles.actionBtnText}>⭐ Save</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onTogglePhotos}
        accessibilityLabel="Check Panoramax Street Photos"
      >
        <Text style={styles.actionBtnText}>📷 Photos</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onOpenPrivacy}
        accessibilityLabel="Open Privacy and Data Flow Settings"
      >
        <Text style={styles.actionBtnText}>⚙️ Privacy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, styles.stepsBtn]}
        onPress={onToggleManeuvers}
        accessibilityLabel="Toggle Turn by Turn Steps"
      >
        <Text style={styles.actionBtnText}>{showManeuvers ? 'Hide' : 'Steps'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  actionBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  walkModeBtn: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  walkModeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  stepsBtn: {
    borderColor: '#38BDF8',
  },
  actionBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
});

