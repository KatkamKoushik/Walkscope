import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useWalkingRoute } from './src/hooks/useWalkingRoute';
import { useStreetImagery } from './src/hooks/useStreetImagery';
import { useRouteContext } from './src/hooks/useRouteContext';
import { saveJourney } from './src/services/storageService';
import { MapComponent } from './src/components/MapComponent';
import { RouteHeader } from './src/components/RouteHeader';
import { RoutePointsCard } from './src/components/RoutePointsCard';
import { RouteActionsBar } from './src/components/RouteActionsBar';
import { RouteComparisonCards } from './src/components/RouteComparisonCards';
import { RouteImageryPanel } from './src/components/RouteImageryPanel';
import { RouteManeuversList } from './src/components/RouteManeuversList';
import { ContextScoreCard } from './src/components/ContextScoreCard';
import { WalkingModeModal } from './src/components/WalkingModeModal';
import { SettingsModal } from './src/components/SettingsModal';
import { SavedJourneysModal } from './src/components/SavedJourneysModal';

export default function App() {
  const {
    origin,
    destination,
    setOrigin,
    setDestination,
    searchTarget,
    setSearchTarget,
    searchQuery,
    setSearchQuery,
    searchResults,
    routingResult,
    selectedRouteId,
    setSelectedRouteId,
    activeRoute,
    isLoadingRoutes,
    statusMessage,
    computeRoutes,
    handleUseGps,
    handleSelectSavedJourney,
  } = useWalkingRoute();

  const {
    imageryResult,
    isLoadingImagery,
    showImagery,
    setShowImagery,
    checkStreetImagery,
  } = useStreetImagery(origin);

  const {
    daylightEstimate,
    contextScore,
  } = useRouteContext(activeRoute, origin, imageryResult);

  // Modal Dialogs & UI Toggles
  const [showManeuvers, setShowManeuvers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSavedJourneys, setShowSavedJourneys] = useState(false);
  const [showWalkingMode, setShowWalkingMode] = useState(false);

  // Save Route to Local SQLite
  const handleSaveRoute = async () => {
    if (!activeRoute || !origin || !destination) {
      Alert.alert('Cannot Save', 'No active route to save.');
      return;
    }

    try {
      await saveJourney({
        id: `journey_${Date.now()}`,
        title: `${origin.title} to ${destination.title}`,
        origin_name: origin.title,
        origin_lat: origin.latitude,
        origin_lon: origin.longitude,
        dest_name: destination.title,
        dest_lat: destination.latitude,
        dest_lon: destination.longitude,
        distance_m: activeRoute.distanceMeters,
        duration_s: activeRoute.durationSeconds,
        context_score: contextScore?.totalScore || 0,
        is_favorite: 0,
      });
      Alert.alert('Route Saved', 'This journey was securely saved to your local on-device SQLite database.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save route locally.');
    }
  };

  const mapRoutes = (routingResult?.routes || []).map((r: any) => ({
    id: r.id,
    coordinates: r.geometry.coordinates,
    isSelected: r.id === (selectedRouteId || routingResult?.routes[0]?.id),
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* Header & Disclaimers */}
      <RouteHeader onOpenSavedJourneys={() => setShowSavedJourneys(true)} />

      {/* Origin / Destination / Presets Selection Card */}
      <RoutePointsCard
        origin={origin}
        destination={destination}
        searchTarget={searchTarget}
        setSearchTarget={setSearchTarget}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={(item) => {
          if (searchTarget === 'origin') {
            setOrigin(item);
            setSearchTarget('destination');
          } else {
            setDestination(item);
          }
          setSearchQuery('');
        }}
        onUseGps={handleUseGps}
        onSelectPreset={(o, d) => {
          setOrigin(o);
          setDestination(d);
        }}
        onTestTimeout={() => computeRoutes({ timeoutMs: 1 })}
        onTestRateLimit={() => computeRoutes({ simulateRateLimit: true })}
      />

      {/* Map View */}
      <View style={styles.mapWrapper}>
        <MapComponent
          origin={origin ? { latitude: origin.latitude, longitude: origin.longitude } : null}
          destination={destination ? { latitude: destination.latitude, longitude: destination.longitude } : null}
          routes={mapRoutes}
          onSelectRoute={(id: string) => setSelectedRouteId(id)}
        />

        {/* Loading Overlay */}
        {isLoadingRoutes && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Calculating walking routes...</Text>
          </View>
        )}
      </View>

      {/* Bottom Sheet / Comparison & Context Cards */}
      <View style={styles.bottomCard}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Status / Error Notifications */}
          {statusMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{statusMessage}</Text>
              {statusMessage.includes('rate-limited') || statusMessage.includes('timeout') ? (
                <TouchableOpacity style={styles.retryBtn} onPress={() => computeRoutes()}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Route Alternatives Header */}
          {routingResult && routingResult.routes.length > 0 && (
            <View>
              <View style={styles.routeHeaderRow}>
                <View>
                  <Text style={styles.routesFoundText}>
                    {routingResult.routes.length} walking route{routingResult.routes.length > 1 ? 's' : ''} found
                  </Text>
                  {daylightEstimate && (
                    <Text style={styles.twilightSubtitle}>
                      {daylightEstimate.solarState === 'DAYLIGHT'
                        ? '☀️ Daylight'
                        : daylightEstimate.solarState === 'CIVIL_TWILIGHT'
                        ? '🌅 Civil Twilight'
                        : daylightEstimate.solarState === 'NAUTICAL_TWILIGHT'
                        ? '🌆 Nautical Twilight'
                        : '🌙 Night'}{' '}
                      ({daylightEstimate.solarElevationDeg > 0 ? `+${daylightEstimate.solarElevationDeg}°` : `${daylightEstimate.solarElevationDeg}°`}) • Solar
                    </Text>
                  )}
                </View>
              </View>

              {/* Main Action Buttons Row */}
              <RouteActionsBar
                onStartWalking={() => setShowWalkingMode(true)}
                onSaveRoute={handleSaveRoute}
                onTogglePhotos={checkStreetImagery}
                onOpenPrivacy={() => setShowSettings(true)}
                showManeuvers={showManeuvers}
                onToggleManeuvers={() => setShowManeuvers(!showManeuvers)}
              />

              {/* Context Coverage Score Card */}
              {contextScore && <ContextScoreCard score={contextScore} />}

              {/* Panoramax Street Imagery Section */}
              {showImagery && (
                <RouteImageryPanel
                  isLoading={isLoadingImagery}
                  result={imageryResult}
                  onClose={() => setShowImagery(false)}
                />
              )}

              {/* Horizontal Route Comparison Cards */}
              <RouteComparisonCards
                routes={routingResult.routes}
                selectedRouteId={selectedRouteId}
                onSelectRoute={(id) => setSelectedRouteId(id)}
              />

              {/* Step-by-Step Maneuvers List */}
              {showManeuvers && activeRoute && (
                <RouteManeuversList steps={activeRoute.steps} />
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Walking Mode Modal */}
      {activeRoute && (
        <WalkingModeModal
          visible={showWalkingMode}
          onClose={() => setShowWalkingMode(false)}
          steps={activeRoute.steps}
          totalDistanceMeters={activeRoute.distanceMeters}
          totalDurationSeconds={activeRoute.durationSeconds}
          routeTitle={`${origin?.title || 'Start'} to ${destination?.title || 'End'}`}
        />
      )}

      {/* Settings & Privacy Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Saved Journeys Modal */}
      <SavedJourneysModal
        visible={showSavedJourneys}
        onClose={() => setShowSavedJourneys(false)}
        onSelectJourney={handleSelectSavedJourney}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  mapWrapper: {
    flex: 1,
    marginTop: 8,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#F1F5F9',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  bottomCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
    maxHeight: 380,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  routesFoundText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  twilightSubtitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
