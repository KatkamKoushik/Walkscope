import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  SafeAreaView,
  StatusBar,
} from 'react-native';

interface Step {
  instruction: string;
  distanceMeters: number;
  streetName?: string;
}

interface WalkingModeModalProps {
  visible: boolean;
  onClose: () => void;
  steps: Step[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  routeTitle: string;
}

export const WalkingModeModal: React.FC<WalkingModeModalProps> = ({
  visible,
  onClose,
  steps,
  totalDistanceMeters,
  totalDurationSeconds,
  routeTitle,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setCurrentStepIndex(0);
    }
  }, [visible, steps]);

  const currentStep = steps[currentStepIndex] || {
    instruction: 'Continue walking along path',
    distanceMeters: totalDistanceMeters,
  };

  const hasNext = currentStepIndex < steps.length - 1;
  const hasPrev = currentStepIndex > 0;

  const handleNextStep = () => {
    if (hasNext) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevStep = () => {
    if (hasPrev) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Services',
      'Launch the device dialer for standard emergency services (112 / regional emergency dispatch)?\n\nNotice: Walkscope is an information tool and does not provide automated emergency dispatch or remote tracking.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Dialer (112)',
          style: 'destructive',
          onPress: () => {
            Linking.openURL('tel:112').catch(() => {
              Alert.alert('Error', 'Unable to launch phone dialer.');
            });
          },
        },
      ]
    );
  };

  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  const formatDuration = (s: number) => {
    const mins = Math.ceil(s / 60);
    return `${mins} min`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.modeTitle}>🚶 Walking Mode</Text>
            <Text style={styles.routeSubtitle} numberOfLines={1}>
              {routeTitle} • {formatDistance(totalDistanceMeters)} ({formatDuration(totalDurationSeconds)})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.exitButton}
            onPress={onClose}
            accessibilityLabel="Exit Walking Mode"
          >
            <Text style={styles.exitText}>✕ Exit</Text>
          </TouchableOpacity>
        </View>

        {/* Step Counter */}
        <View style={styles.counterRow}>
          <Text style={styles.stepCounterText}>
            Step {steps.length > 0 ? currentStepIndex + 1 : 1} of {Math.max(1, steps.length)}
          </Text>
        </View>

        {/* Big Instruction Box */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionDistance}>
            {formatDistance(currentStep.distanceMeters)}
          </Text>
          <Text style={styles.instructionText}>
            {currentStep.instruction}
          </Text>
          {currentStep.streetName ? (
            <Text style={styles.streetNameText}>
              on {currentStep.streetName}
            </Text>
          ) : null}
        </View>

        {/* Step Navigation Controls */}
        <View style={styles.navControlsRow}>
          <TouchableOpacity
            style={[styles.navButton, !hasPrev && styles.navButtonDisabled]}
            onPress={handlePrevStep}
            disabled={!hasPrev}
            accessibilityLabel="Previous Step"
          >
            <Text style={[styles.navButtonText, !hasPrev && styles.navButtonTextDisabled]}>
              ◀ Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, styles.navButtonPrimary, !hasNext && styles.navButtonDisabled]}
            onPress={handleNextStep}
            disabled={!hasNext}
            accessibilityLabel="Next Step"
          >
            <Text style={[styles.navButtonText, styles.navButtonTextPrimary, !hasNext && styles.navButtonTextDisabled]}>
              Next Step ▶
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Safety & Emergency Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={handleEmergencyCall}
            accessibilityLabel="Emergency Dialer 112"
          >
            <Text style={styles.emergencyIcon}>🚨</Text>
            <Text style={styles.emergencyText}>Emergency Call (112)</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimerFootnote}>
            Keep eyes on your surroundings. Do not look at phone while crossing roads.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    justifyContent: 'space-between',
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: (StatusBar.currentHeight || 28) + 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#38BDF8',
  },
  routeSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    maxWidth: 240,
  },
  exitButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  counterRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  stepCounterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  instructionContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    marginVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38BDF8',
    minHeight: 220,
    justifyContent: 'center',
  },
  instructionDistance: {
    fontSize: 42,
    fontWeight: '900',
    color: '#38BDF8',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
  },
  streetNameText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
    fontStyle: 'italic',
  },
  navControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  navButtonPrimary: {
    backgroundColor: '#0284C7',
  },
  navButtonDisabled: {
    backgroundColor: '#0F172A',
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  navButtonTextPrimary: {
    color: '#FFFFFF',
  },
  navButtonTextDisabled: {
    color: '#475569',
  },
  bottomBar: {
    marginTop: 20,
    alignItems: 'center',
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  emergencyIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  emergencyText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disclaimerFootnote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
});

