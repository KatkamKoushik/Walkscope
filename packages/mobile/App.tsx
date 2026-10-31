import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useWalkingRoute } from './src/hooks/useWalkingRoute';
import { useStreetImagery } from './src/hooks/useStreetImagery';
import { useRouteContext } from './src/hooks/useRouteContext';
import { saveJourney } from './src/services/storageService';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { NavigateScreen } from './src/screens/NavigateScreen';
import { SavedJourneysScreen } from './src/screens/SavedJourneysScreen';
import { BottomTabBar, ActiveTab } from './src/navigation/BottomTabBar';
import { SettingsModal } from './src/components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('explore');
  const [showSettings, setShowSettings] = useState(false);

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
    amenitySummary,
    contextScore,
    routeIntelligence,
  } = useRouteContext(activeRoute, origin, imageryResult);

  // Save active route to local SQLite
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
      Alert.alert(
        'Corridor Saved',
        'This walking route is saved to your local on-device SQLite database.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save route locally.');
    }
  };

  return (
    <SafeAreaView style={styles.rootContainer}>
      <StatusBar barStyle="light-content" />

      {/* Screen Body Router */}
      <View style={styles.screenContainer}>
        {activeTab === 'explore' && (
          <ExploreScreen
            origin={origin}
            destination={destination}
            setOrigin={setOrigin}
            setDestination={setDestination}
            searchTarget={searchTarget}
            setSearchTarget={setSearchTarget}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            routingResult={routingResult}
            selectedRouteId={selectedRouteId}
            setSelectedRouteId={setSelectedRouteId}
            activeRoute={activeRoute}
            isLoadingRoutes={isLoadingRoutes}
            statusMessage={statusMessage}
            computeRoutes={computeRoutes}
            handleUseGps={handleUseGps}
            imageryResult={imageryResult}
            isLoadingImagery={isLoadingImagery}
            showImagery={showImagery}
            setShowImagery={setShowImagery}
            checkStreetImagery={checkStreetImagery}
            contextScore={contextScore}
            daylightEstimate={daylightEstimate}
            amenitySummary={amenitySummary}
            routeIntelligence={routeIntelligence}
            onStartWalking={() => setActiveTab('navigate')}
            onSaveRoute={handleSaveRoute}
            onOpenPrivacy={() => setShowSettings(true)}
          />
        )}

        {activeTab === 'navigate' && (
          <NavigateScreen
            activeRoute={activeRoute}
            originTitle={origin?.title}
            destTitle={destination?.title}
            contextScore={contextScore}
            daylightEstimate={daylightEstimate}
            onExitNavigate={() => setActiveTab('explore')}
            onOpenExplore={() => setActiveTab('explore')}
          />
        )}

        {activeTab === 'saved' && (
          <SavedJourneysScreen
            onSelectJourney={(saved) => {
              handleSelectSavedJourney(saved);
              setActiveTab('explore');
            }}
            onOpenPrivacySettings={() => setShowSettings(true)}
          />
        )}
      </View>

      {/* Persistent Bottom Tab Bar with Safe Area Clearance */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        hasActiveRoute={Boolean(activeRoute)}
      />

      {/* Settings & Explainable Scoring Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  screenContainer: {
    flex: 1,
  },
});
