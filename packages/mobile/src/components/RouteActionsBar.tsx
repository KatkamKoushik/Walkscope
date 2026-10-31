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
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Start Walking Mode"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.walkModeBtnText}>🚶 Walk</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onSaveRoute}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Save Route to Local SQLite"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.actionBtnText}>⭐ Save</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onTogglePhotos}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Check Panoramax Street Photos"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.actionBtnText}>📷 Photos</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onOpenPrivacy}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Open Privacy and Data Flow Settings"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.actionBtnText}>⚙️ Privacy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, styles.stepsBtn]}
        onPress={onToggleManeuvers}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Toggle Turn by Turn Steps"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
    marginVertical: 8,
    gap: 8,
  },
  actionBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walkModeBtn: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  walkModeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stepsBtn: {
    borderColor: '#38BDF8',
  },
  actionBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
});

