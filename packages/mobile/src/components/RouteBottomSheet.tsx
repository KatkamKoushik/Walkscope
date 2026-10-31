import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import type { ContextScoreBreakdown } from '../../../core/services/contextScoringService';
import { RouteActionsBar } from './RouteActionsBar';
import { ContextScoreCard } from './ContextScoreCard';
import { RouteImageryPanel } from './RouteImageryPanel';
import { RouteComparisonCards } from './RouteComparisonCards';
import { RouteManeuversList } from './RouteManeuversList';
import { RouteEvidenceDrawer } from './RouteEvidenceDrawer';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SNAP_PEEK = 110;
const SNAP_MID = Math.min(380, SCREEN_HEIGHT * 0.45);
const SNAP_FULL = Math.min(640, SCREEN_HEIGHT * 0.82);

interface RouteBottomSheetProps {
  routingResult: any;
  activeRoute: any;
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  contextScore: ContextScoreBreakdown | null;
  daylightEstimate: any;
  imageryResult: any;
  isLoadingImagery: boolean;
  showImagery: boolean;
  onToggleImagery: () => void;
  onCloseImagery: () => void;
  onStartWalking: () => void;
  onSaveRoute: () => void;
  onOpenPrivacy: () => void;
  statusMessage: string | null;
  onRetry: () => void;
  routeIntelligence?: any;
}

export const RouteBottomSheet: React.FC<RouteBottomSheetProps> = ({
  routingResult,
  activeRoute,
  selectedRouteId,
  onSelectRoute,
  contextScore,
  daylightEstimate,
  imageryResult,
  isLoadingImagery,
  showImagery,
  onToggleImagery,
  onCloseImagery,
  onStartWalking,
  onSaveRoute,
  onOpenPrivacy,
  statusMessage,
  onRetry,
  routeIntelligence,
}) => {
  const [currentSnap, setCurrentSnap] = useState<'peek' | 'mid' | 'full'>('mid');
  const [showManeuvers, setShowManeuvers] = useState(false);

  const sheetHeight = useRef(new Animated.Value(SNAP_MID)).current;

  const animateTo = (targetHeight: number, snap: 'peek' | 'mid' | 'full') => {
    Animated.spring(sheetHeight, {
      toValue: targetHeight,
      damping: 20,
      stiffness: 150,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
    setCurrentSnap(snap);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -50) {
          // Dragged up
          if (currentSnap === 'peek') animateTo(SNAP_MID, 'mid');
          else animateTo(SNAP_FULL, 'full');
        } else if (gesture.dy > 50) {
          // Dragged down
          if (currentSnap === 'full') animateTo(SNAP_MID, 'mid');
          else animateTo(SNAP_PEEK, 'peek');
        }
      },
    })
  ).current;

  if (!routingResult && !statusMessage) {
    return null;
  }

  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };

  const formatDuration = (s: number) => {
    const min = Math.ceil(s / 60);
    return `${min} min`;
  };

  return (
    <Animated.View style={[styles.sheetContainer, { height: sheetHeight }]}>
      {/* Draggable Top Handle */}
      <View {...panResponder.panHandlers} style={styles.handleZone}>
        <View style={styles.handleBar} />
      </View>

      {/* Status / Error Banner */}
      {statusMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{statusMessage}</Text>
          {(statusMessage.includes('rate-limited') || statusMessage.includes('timeout')) && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry route calculation"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Peek Summary Bar (Always Visible at Top of Sheet) */}
      {activeRoute && (
        <View style={styles.peekHeader}>
          <View style={styles.metricGroup}>
            <Text style={styles.durationValue}>
              {formatDuration(activeRoute.durationSeconds)}
            </Text>
            <Text style={styles.distanceValue}>
              {formatDistance(activeRoute.distanceMeters)}
            </Text>
            {contextScore && (
              <View
                style={[
                  styles.scorePill,
                  {
                    backgroundColor:
                      contextScore.totalScore >= 80
                        ? 'rgba(16, 185, 129, 0.15)'
                        : contextScore.totalScore >= 50
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    borderColor:
                      contextScore.totalScore >= 80
                        ? '#10B981'
                        : contextScore.totalScore >= 50
                        ? '#F59E0B'
                        : '#EF4444',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scorePillText,
                    {
                      color:
                        contextScore.totalScore >= 80
                          ? '#10B981'
                          : contextScore.totalScore >= 50
                          ? '#F59E0B'
                          : '#EF4444',
                    },
                  ]}
                >
                  {contextScore.totalScore}% Context
                </Text>
              </View>
            )}
          </View>

          {/* Quick Start Walking Button (Thumb reachable) */}
          <TouchableOpacity
            style={styles.startWalkingCTA}
            onPress={onStartWalking}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Start pedestrian walking guidance"
            hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
          >
            <Text style={styles.startWalkingCTAText}>Start Walk</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scrollable Sheet Body for Mid / Full States */}
      <ScrollView
        style={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Daylight / Solar Chip */}
        {daylightEstimate && (
          <View style={styles.solarChip}>
            <Text style={styles.solarText}>
              {daylightEstimate.solarState === 'DAYLIGHT'
                ? '☀️ Natural Daylight'
                : daylightEstimate.solarState === 'CIVIL_TWILIGHT'
                ? '🌅 Civil Twilight'
                : daylightEstimate.solarState === 'NAUTICAL_TWILIGHT'
                ? '🌆 Nautical Twilight'
                : '🌙 Astronomical Night'}{' '}
              ({daylightEstimate.solarElevationDeg > 0 ? `+${daylightEstimate.solarElevationDeg}°` : `${daylightEstimate.solarElevationDeg}°`}) • NOAA Math
            </Text>
          </View>
        )}

        {/* Action Buttons Row */}
        <RouteActionsBar
          onStartWalking={onStartWalking}
          onSaveRoute={onSaveRoute}
          onTogglePhotos={onToggleImagery}
          onOpenPrivacy={onOpenPrivacy}
          showManeuvers={showManeuvers}
          onToggleManeuvers={() => setShowManeuvers(!showManeuvers)}
        />

        {/* Context Coverage Breakdown Card */}
        {contextScore && <ContextScoreCard score={contextScore} />}

        {/* Why This Route Evidence Drawer (NightWise Intelligence) */}
        {routeIntelligence && (
          <RouteEvidenceDrawer intelligence={routeIntelligence} />
        )}

        {/* Panoramax Street Photos Strip */}
        {showImagery && (
          <RouteImageryPanel
            isLoading={isLoadingImagery}
            result={imageryResult}
            onClose={onCloseImagery}
          />
        )}

        {/* Route Alternative Comparison Cards */}
        {routingResult?.routes?.length > 1 && (
          <RouteComparisonCards
            routes={routingResult.routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={onSelectRoute}
          />
        )}

        {/* Step-by-Step Maneuver Instructions */}
        {showManeuvers && activeRoute && (
          <RouteManeuversList steps={activeRoute.steps} />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#131C2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 90,
  },
  handleZone: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#475569',
  },
  peekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  metricGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  durationValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  distanceValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#94A3B8',
  },
  scorePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  startWalkingCTA: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    minHeight: 44,
    minWidth: 105,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWalkingCTAText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 10,
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    flex: 1,
  },
  retryBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  solarChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  solarText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
});
