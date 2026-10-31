import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import {
  getSavedJourneys,
  toggleFavoriteJourney,
  deleteJourney,
  hardWipeAllData,
  SavedJourney,
} from '../services/storageService';

interface SavedJourneysScreenProps {
  onSelectJourney: (saved: SavedJourney) => void;
  onOpenPrivacySettings: () => void;
}

export const SavedJourneysScreen: React.FC<SavedJourneysScreenProps> = ({
  onSelectJourney,
  onOpenPrivacySettings,
}) => {
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);
  const [loading, setLoading] = useState(false);

  const loadJourneys = async () => {
    setLoading(true);
    try {
      const list = await getSavedJourneys();
      setJourneys(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJourneys();
  }, []);

  const handleToggleFav = async (id: string, current: number) => {
    await toggleFavoriteJourney(id);
    await loadJourneys();
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Journey', 'Are you sure you want to remove this saved corridor?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteJourney(id);
          await loadJourneys();
        },
      },
    ]);
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear Local Database',
      'This will erase all saved routes, recent searches, and cached data from your local device storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            await hardWipeAllData();
            await loadJourneys();
            Alert.alert('Database Cleared', 'Your local saved routes and history have been removed.');
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
    const min = Math.ceil(s / 60);
    return `${min} min`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved Corridors & Privacy</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadJourneys}
          accessibilityLabel="Refresh saved journeys list"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.refreshBtnText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* On-Device Local Storage Card */}
        <View style={styles.privacyCard}>
          <View style={styles.privacyIconCircle}>
            <Text style={styles.privacyIcon}>🛡️</Text>
          </View>
          <View style={styles.privacyTextCol}>
            <Text style={styles.privacyTitle}>Local On-Device Storage</Text>
            <Text style={styles.privacyBody}>
              Your journey history, favorites, and settings remain stored on this device. Route calculation and context lookups query public open data endpoints (OSRM, Overpass API, OpenStreetMap).
            </Text>
          </View>
        </View>

        {/* Saved Corridors Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Saved Routes ({journeys.length})
          </Text>
        </View>

        {/* Journeys List */}
        {journeys.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔖</Text>
            <Text style={styles.emptyTitle}>No Saved Corridors Yet</Text>
            <Text style={styles.emptySubtitle}>
              When exploring routes on the map, tap "Save Route" to keep corridors permanently on your device for quick offline reference.
            </Text>
          </View>
        ) : (
          journeys.map((item) => (
            <View key={item.id} style={styles.journeyCard}>
              <View style={styles.journeyTopRow}>
                <TouchableOpacity
                  style={styles.favBtn}
                  onPress={() => handleToggleFav(item.id, item.is_favorite)}
                  accessibilityLabel="Toggle favorite status"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.favIcon}>
                    {item.is_favorite === 1 ? '⭐' : '☆'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.journeyTitleCol}>
                  <Text style={styles.journeyTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.journeyPoints} numberOfLines={1}>
                    {item.origin_name} ➔ {item.dest_name}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id)}
                  accessibilityLabel="Delete saved journey"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>

              {/* Journey Metrics Bar */}
              <View style={styles.metricsRow}>
                <Text style={styles.metricItem}>
                  📏 {formatDistance(item.distance_m)}
                </Text>
                <Text style={styles.metricItem}>
                  ⏱️ {formatDuration(item.duration_s)}
                </Text>
                <View
                  style={[
                    styles.scoreBadge,
                    {
                      backgroundColor:
                        item.context_score >= 80
                          ? 'rgba(16, 185, 129, 0.15)'
                          : item.context_score >= 50
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.scoreBadgeText,
                      {
                        color:
                          item.context_score >= 80
                            ? '#10B981'
                            : item.context_score >= 50
                            ? '#F59E0B'
                            : '#EF4444',
                      },
                    ]}
                  >
                    {item.context_score}% Context
                  </Text>
                </View>
              </View>

              {/* Load On Map CTA Button */}
              <TouchableOpacity
                style={styles.loadRouteBtn}
                onPress={() => onSelectJourney(item)}
                accessibilityRole="button"
                accessibilityLabel={`Load route ${item.title} on map`}
              >
                <Text style={styles.loadRouteBtnText}>View Corridor on Map ➔</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Advanced Privacy Controls */}
        <View style={styles.dangerZoneCard}>
          <Text style={styles.dangerTitle}>Privacy & Storage Controls</Text>
          <Text style={styles.dangerSubtitle}>
            Manage your on-device storage or reset all saved route corridors from the local SQLite database.
          </Text>

          <View style={styles.dangerActionsRow}>
            <TouchableOpacity
              style={styles.settingsSheetBtn}
              onPress={onOpenPrivacySettings}
              accessibilityRole="button"
              accessibilityLabel="Open settings dialog"
            >
              <Text style={styles.settingsSheetBtnText}>⚙️ Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hardWipeBtn}
              onPress={handleClearData}
              accessibilityRole="button"
              accessibilityLabel="Clear local data"
            >
              <Text style={styles.hardWipeBtnText}>🗑️ Clear Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  refreshBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtnText: {
    fontSize: 18,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  privacyCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  privacyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  privacyIcon: {
    fontSize: 22,
  },
  privacyTextCol: {
    flex: 1,
  },
  privacyTitle: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  privacyBody: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    marginTop: 6,
    marginBottom: 2,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  journeyCard: {
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
  },
  journeyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  favBtn: {
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favIcon: {
    fontSize: 20,
  },
  journeyTitleCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  journeyTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  journeyPoints: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricItem: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadRouteBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  loadRouteBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  dangerZoneCard: {
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
  },
  dangerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  dangerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  dangerActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  settingsSheetBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsSheetBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  hardWipeBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hardWipeBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
