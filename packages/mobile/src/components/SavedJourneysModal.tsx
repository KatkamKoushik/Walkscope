import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  SavedJourney,
  getSavedJourneys,
  toggleFavoriteJourney,
  deleteJourney,
} from '../services/storageService';

interface SavedJourneysModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectJourney: (journey: SavedJourney) => void;
}

export const SavedJourneysModal: React.FC<SavedJourneysModalProps> = ({
  visible,
  onClose,
  onSelectJourney,
}) => {
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);
  const [loading, setLoading] = useState(false);

  const loadJourneys = async () => {
    setLoading(true);
    try {
      const data = await getSavedJourneys();
      setJourneys(data);
    } catch (err: any) {
      console.warn('Failed to load journeys from SQLite:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadJourneys();
    }
  }, [visible]);

  const handleToggleFavorite = async (id: string) => {
    try {
      await toggleFavoriteJourney(id);
      await loadJourneys();
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update favorite status.');
    }
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete Journey', `Remove "${title}" from saved journeys?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteJourney(id);
            await loadJourneys();
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete journey.');
          }
        },
      },
    ]);
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⭐ Saved Journeys</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {journeys.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>No saved journeys yet</Text>
            <Text style={styles.emptySubtitle}>
              When you view a walking route, tap the "+ Save Route" button to keep it stored locally in SQLite.
            </Text>
          </View>
        ) : (
          <FlatList
            data={journeys}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardMain}
                  onPress={() => {
                    onSelectJourney(item);
                    onClose();
                  }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreText}>{item.context_score}% Context</Text>
                    </View>
                  </View>

                  <Text style={styles.cardLocations} numberOfLines={1}>
                    {item.origin_name} ➔ {item.dest_name}
                  </Text>

                  <View style={styles.cardMetrics}>
                    <Text style={styles.metricText}>
                      📏 {formatDistance(item.distance_m)} • ⏱️ {formatDuration(item.duration_s)}
                    </Text>
                    <Text style={styles.dateText}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Actions */}
                <View style={styles.actionColumn}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleToggleFavorite(item.id)}
                    accessibilityLabel="Toggle Favorite"
                  >
                    <Text style={styles.actionIcon}>
                      {item.is_favorite === 1 ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(item.id, item.title)}
                    accessibilityLabel="Delete Journey"
                  >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight || 28) + 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  closeButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  cardMain: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    flex: 1,
    marginRight: 8,
  },
  scoreBadge: {
    backgroundColor: '#0369A1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E0F2FE',
  },
  cardLocations: {
    fontSize: 12,
    color: '#38BDF8',
    marginBottom: 6,
  },
  cardMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dateText: {
    fontSize: 10,
    color: '#64748B',
  },
  actionColumn: {
    width: 48,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 6,
  },
  actionIcon: {
    fontSize: 16,
  },
  deleteIcon: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});

