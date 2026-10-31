import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import type { ContextScoreBreakdown } from '../../../core/services/contextScoringService';

interface NavigateScreenProps {
  activeRoute: any;
  originTitle?: string;
  destTitle?: string;
  contextScore: ContextScoreBreakdown | null;
  daylightEstimate: any;
  onExitNavigate: () => void;
  onOpenExplore: () => void;
}

/**
 * Calculates Haversine distance between two coordinates in meters.
 */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates minimum distance from user coordinate to any point on route geometry.
 */
function minDistanceToRoute(
  lat: number,
  lon: number,
  coordinates: [number, number][]
): number {
  if (!coordinates || coordinates.length === 0) return 0;
  let minDist = Infinity;
  for (const pt of coordinates) {
    const ptLon = pt[0];
    const ptLat = pt[1];
    const d = haversineMeters(lat, lon, ptLat, ptLon);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

export const NavigateScreen: React.FC<NavigateScreenProps> = ({
  activeRoute,
  originTitle,
  destTitle,
  contextScore,
  daylightEstimate,
  onExitNavigate,
  onOpenExplore,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'unavailable'>('searching');
  const [offRouteMeters, setOffRouteMeters] = useState<number | null>(null);

  const steps = activeRoute?.steps || [];
  const currentStep = steps[currentStepIndex] || steps[0];
  const nextStep = steps[currentStepIndex + 1];
  const coordinates: [number, number][] = activeRoute?.geometry?.coordinates || [];

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastValidGpsRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const consecutiveOffRouteCountRef = useRef(0);

  // Setup live GPS tracking and maneuver advancement with pedestrian kinematic filtering
  useEffect(() => {
    let isMounted = true;

    async function startLocationTracking() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) setGpsStatus('unavailable');
          return;
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 4,
            timeInterval: 2500,
          },
          (loc) => {
            if (!isMounted) return;
            const { latitude, longitude, accuracy } = loc.coords;
            const now = Date.now();

            // 1. Pedestrian Kinematic Filter: discard inaccurate fixes (> 65m uncertainty)
            if (typeof accuracy === 'number' && accuracy > 65) {
              return;
            }

            // 2. Teleportation / Jitter Guard: reject impossible pedestrian speed delta (> 25 m/s or 90 km/h)
            if (lastValidGpsRef.current) {
              const dtSeconds = Math.max(0.5, (now - lastValidGpsRef.current.timestamp) / 1000);
              const distJump = haversineMeters(
                lastValidGpsRef.current.latitude,
                lastValidGpsRef.current.longitude,
                latitude,
                longitude
              );
              const speedMps = distJump / dtSeconds;
              if (dtSeconds < 10 && speedMps > 25) {
                // Ignore unrealistic teleportation glitch
                return;
              }
            }

            lastValidGpsRef.current = { latitude, longitude, timestamp: now };
            setUserLocation({ latitude, longitude });
            setGpsStatus('active');

            // 3. Off-route detection with 2-consecutive hysteresis to prevent false flickering
            if (coordinates.length > 0) {
              const distToRoute = minDistanceToRoute(latitude, longitude, coordinates);
              if (distToRoute > 50) {
                consecutiveOffRouteCountRef.current += 1;
                if (consecutiveOffRouteCountRef.current >= 2) {
                  setOffRouteMeters(Math.round(distToRoute));
                }
              } else {
                consecutiveOffRouteCountRef.current = 0;
                setOffRouteMeters(null);
              }
            }

            // 4. Maneuver advancement based on proximity to next step point (within 25m)
            if (steps.length > 0 && currentStepIndex < steps.length - 1) {
              const targetStep = steps[currentStepIndex + 1];
              const targetLocation = targetStep?.location; // [lon, lat]
              if (targetLocation && Array.isArray(targetLocation) && targetLocation.length >= 2) {
                const targetLon = targetLocation[0];
                const targetLat = targetLocation[1];
                const distToStep = haversineMeters(latitude, longitude, targetLat, targetLon);
                if (distToStep <= 25) {
                  setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
                }
              }
            }
          }
        );

        locationSubRef.current = sub;
      } catch {
        if (isMounted) setGpsStatus('unavailable');
      }
    }

    if (activeRoute) {
      startLocationTracking();
    }

    return () => {
      isMounted = false;
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, [activeRoute, steps, currentStepIndex, coordinates]);

  // Transparent Emergency Speed Dial
  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Speed Dial (112)',
      'This opens your device phone dialer with 112 pre-filled. Walkscope does not automatically dispatch emergency personnel or place calls silently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Phone Dialer',
          style: 'destructive',
          onPress: () => {
            Linking.openURL('tel:112').catch(() => {
              Alert.alert('Phone Unavailable', 'Cannot launch phone dialer on this device.');
            });
          },
        },
      ]
    );
  };

  const getManeuverIcon = (type?: string, modifier?: string) => {
    const text = `${type || ''} ${modifier || ''}`.toLowerCase();
    if (text.includes('left')) return '↰';
    if (text.includes('right')) return '↱';
    if (text.includes('uturn')) return '↶';
    if (text.includes('arrive') || text.includes('destination')) return '🏁';
    if (text.includes('depart') || text.includes('start')) return '🚶';
    return '↑';
  };

  const formatDistance = (m?: number) => {
    if (!m) return '0 m';
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  const formatDuration = (s?: number) => {
    if (!s) return '0 min';
    return `${Math.ceil(s / 60)} min`;
  };

  // Empty state when no route is selected
  if (!activeRoute) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🧭</Text>
          <Text style={styles.emptyTitle}>No Active Walking Route</Text>
          <Text style={styles.emptyDesc}>
            Select an origin and destination on the map to begin live turn-by-turn walking guidance.
          </Text>
          <TouchableOpacity
            style={styles.exploreCTA}
            onPress={onOpenExplore}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open map to find a walking route"
          >
            <Text style={styles.exploreCTAText}>Find a Walk on Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top GPS Status & Off-Route Alert Strip */}
      <View style={styles.gpsStatusStrip}>
        <View style={styles.gpsBadge}>
          <Text
            style={[
              styles.gpsDot,
              { color: gpsStatus === 'active' ? '#10B981' : gpsStatus === 'searching' ? '#F59E0B' : '#64748B' },
            ]}
          >
            ●
          </Text>
          <Text style={styles.gpsText}>
            {gpsStatus === 'active'
              ? 'GPS Active (Auto-Advancing)'
              : gpsStatus === 'searching'
              ? 'Acquiring GPS Signal...'
              : 'GPS Unavailable (Manual Step Mode)'}
          </Text>
        </View>
      </View>

      {/* Off-Route Alert Banner */}
      {offRouteMeters !== null && offRouteMeters > 50 && (
        <View style={styles.offRouteBanner}>
          <Text style={styles.offRouteIcon}>⚠️</Text>
          <Text style={styles.offRouteText}>
            Off-Route (~{offRouteMeters}m away). Realign with the highlighted corridor.
          </Text>
        </View>
      )}

      {/* Top Giant Maneuver HUD (High Contrast) */}
      <View style={styles.hudHeader}>
        <View style={styles.maneuverIconBox}>
          <Text style={styles.maneuverArrow}>
            {getManeuverIcon(currentStep?.maneuverType, currentStep?.maneuverModifier)}
          </Text>
        </View>
        <View style={styles.maneuverTextGroup}>
          <Text style={styles.stepDistance}>
            In {formatDistance(currentStep?.distanceMeters || 120)}
          </Text>
          <Text style={styles.stepInstruction} numberOfLines={2}>
            {currentStep?.instruction || 'Proceed along corridor'}
          </Text>
          {currentStep?.roadName ? (
            <Text style={styles.roadName} numberOfLines={1}>
              {currentStep.roadName}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Route Journey Status Overview */}
      <View style={styles.journeyStatusBar}>
        <View style={styles.statusCol}>
          <Text style={styles.statusLabel}>REMAINING</Text>
          <Text style={styles.statusValue}>
            {formatDistance(activeRoute.distanceMeters)}
          </Text>
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusCol}>
          <Text style={styles.statusLabel}>EST. TIME</Text>
          <Text style={styles.statusValue}>
            {formatDuration(activeRoute.durationSeconds)}
          </Text>
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusCol}>
          <Text style={styles.statusLabel}>CONTEXT</Text>
          <Text
            style={[
              styles.statusValue,
              {
                color:
                  (contextScore?.totalScore || 0) >= 80
                    ? '#10B981'
                    : (contextScore?.totalScore || 0) >= 50
                    ? '#F59E0B'
                    : '#EF4444',
              },
            ]}
          >
            {contextScore ? `${contextScore.totalScore}%` : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Live Upcoming Steps & Context Cards */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Next Maneuver Preview */}
        {nextStep && (
          <View style={styles.nextStepPreview}>
            <Text style={styles.nextStepLabel}>THEN</Text>
            <View style={styles.nextStepRow}>
              <Text style={styles.nextStepIcon}>
                {getManeuverIcon(nextStep.maneuverType, nextStep.maneuverModifier)}
              </Text>
              <Text style={styles.nextStepText} numberOfLines={1}>
                {nextStep.instruction}
              </Text>
            </View>
          </View>
        )}

        {/* Environmental Context Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Environmental Conditions</Text>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Solar Illumination:</Text>
            <Text style={styles.contextValue}>
              {daylightEstimate
                ? `${daylightEstimate.solarState.replace('_', ' ')} (${daylightEstimate.solarElevationDeg}°)`
                : 'Daylight Active'}
            </Text>
          </View>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Amenity Density:</Text>
            <Text style={styles.contextValue}>
              {contextScore
                ? `${contextScore.amenityDensityPer100m.toFixed(1)} nodes/100m`
                : 'Mapped amenities (unverified)'}
            </Text>
          </View>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Street Imagery:</Text>
            <Text style={styles.contextValue}>
              {contextScore?.hasStreetImagery
                ? 'Panoramax Available'
                : 'Not Yet Mapped'}
            </Text>
          </View>
        </View>

        {/* Next Step Controls (Manual override & testing) */}
        <View style={styles.stepNavRow}>
          <TouchableOpacity
            style={[
              styles.stepNavBtn,
              currentStepIndex === 0 && styles.stepNavBtnDisabled,
            ]}
            disabled={currentStepIndex === 0}
            onPress={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
            accessibilityLabel="Previous maneuver step"
          >
            <Text style={styles.stepNavBtnText}>◀ Previous Step</Text>
          </TouchableOpacity>

          <Text style={styles.stepCounterText}>
            Step {currentStepIndex + 1} of {Math.max(1, steps.length)}
          </Text>

          <TouchableOpacity
            style={[
              styles.stepNavBtn,
              currentStepIndex >= steps.length - 1 && styles.stepNavBtnDisabled,
            ]}
            disabled={currentStepIndex >= steps.length - 1}
            onPress={() =>
              setCurrentStepIndex(Math.min(steps.length - 1, currentStepIndex + 1))
            }
            accessibilityLabel="Next maneuver step"
          >
            <Text style={styles.stepNavBtnText}>Next Step ▶</Text>
          </TouchableOpacity>
        </View>

        {/* Honest Open Data Notice */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerIcon}>ℹ️</Text>
          <Text style={styles.disclaimerText}>
            Open Data Notice: Route steps and amenity density are derived from OpenStreetMap and NOAA astronomical calculations. This information does not guarantee personal safety, street lighting operation, or absence of hazards.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Action Bar (Thumb Zone) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.exitBtn}
          onPress={onExitNavigate}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="End walking navigation"
        >
          <Text style={styles.exitBtnText}>End Walk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emergencyBtn}
          onPress={handleEmergencyCall}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open Emergency Dialer 112"
        >
          <Text style={styles.emergencyBtnText}>📞 Open Dialer: 112</Text>
          <Text style={styles.emergencyBtnSubtext}>Speed Dial Confirmation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  gpsStatusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gpsDot: {
    fontSize: 12,
  },
  gpsText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  offRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offRouteIcon: {
    fontSize: 16,
  },
  offRouteText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyCard: {
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    maxWidth: 360,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  exploreCTA: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreCTAText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131C2E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  maneuverIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  maneuverArrow: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  maneuverTextGroup: {
    flex: 1,
  },
  stepDistance: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepInstruction: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  roadName: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  journeyStatusBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  statusCol: {
    flex: 1,
    alignItems: 'center',
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statusValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  statusDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  nextStepPreview: {
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 12,
  },
  nextStepLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextStepIcon: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  nextStepText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 14,
  },
  cardHeading: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  contextLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  contextValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  stepNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  stepNavBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  stepNavBtnDisabled: {
    opacity: 0.35,
  },
  stepNavBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  stepCounterText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  disclaimerCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginTop: 6,
  },
  disclaimerIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  disclaimerText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  exitBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  exitBtnText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  emergencyBtn: {
    flex: 1.4,
    backgroundColor: '#DC2626',
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  emergencyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emergencyBtnSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
});
