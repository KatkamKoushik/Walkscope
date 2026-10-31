import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { hardWipeAllData } from '../services/storageService';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onDataWiped?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onDataWiped,
}) => {
  const handleHardWipe = () => {
    Alert.alert(
      'Clear Local Database',
      'Are you sure you want to delete all saved journeys and recent search history? This operation removes all locally stored records and resets your local SQLite database.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await hardWipeAllData();
              Alert.alert('Database Cleared', 'All local journey records and search history have been deleted from on-device storage.');
              if (onDataWiped) onDataWiped();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to clear local storage.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚙️ Settings & Privacy</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Privacy & Zero Telemetry Notice */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛡️ Privacy Model</Text>
            <Text style={styles.bodyText}>
              This application has zero advertising trackers, zero user identification SDKs, and zero telemetry analytics.
              All journey records and favorites remain exclusively inside your device's local SQLite database.
            </Text>
          </View>

          {/* Data Flow Inventory */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌐 Data Flow Inventory</Text>
            <Text style={styles.inventoryIntro}>
              When you perform actions, specific minimal queries leave your device:
            </Text>

            <View style={styles.inventoryItem}>
              <Text style={styles.itemTitle}>1. Walking Route Calculations</Text>
              <Text style={styles.itemRecipient}>Recipient: routing.openstreetmap.de (OSRM Foot)</Text>
              <Text style={styles.itemData}>Data sent: Origin and destination coordinates.</Text>
            </View>

            <View style={styles.inventoryItem}>
              <Text style={styles.itemTitle}>2. Destination Search & Geocoding</Text>
              <Text style={styles.itemRecipient}>Recipient: photon.komoot.io (Photon) / Walkscope Gateway</Text>
              <Text style={styles.itemData}>Data sent: Text search query with geographic focus; fair-use typeahead API.</Text>
            </View>

            <View style={styles.inventoryItem}>
              <Text style={styles.itemTitle}>3. Route Amenity Corridor Queries</Text>
              <Text style={styles.itemRecipient}>Recipient: overpass-api.de (OSM Overpass)</Text>
              <Text style={styles.itemData}>Data sent: Bounding box enclosing the route polyline.</Text>
            </View>

            <View style={styles.inventoryItem}>
              <Text style={styles.itemTitle}>4. Street-level Imagery Queries</Text>
              <Text style={styles.itemRecipient}>Recipient: api.panoramax.xyz / panoramax.ign.fr</Text>
              <Text style={styles.itemData}>Data sent: Bounding box for STAC photo metadata.</Text>
            </View>
          </View>

          {/* Attribution & Legal Notices */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📜 Attribution & Licenses</Text>
            <Text style={styles.bodyText}>• OpenStreetMap data © OpenStreetMap contributors (ODbL)</Text>
            <Text style={styles.bodyText}>• Basemap cartography © OpenStreetMap contributors</Text>
            <Text style={styles.bodyText}>• Street photos © Panoramax contributors (CC-BY-SA 4.0)</Text>
            <Text style={styles.bodyText}>• Solar position algorithms based on NOAA GML equations</Text>
            <Text style={styles.bodyText}>• Map rendering via MapLibre GL Native</Text>
          </View>

          {/* Data Management Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🗑️ Data Management</Text>
            <TouchableOpacity style={styles.wipeButton} onPress={handleHardWipe}>
              <Text style={styles.wipeButtonText}>Clear All Local Journey History</Text>
            </TouchableOpacity>
            <Text style={styles.wipeSubtext}>
              Immediately deletes all saved journeys, favorite routes, and search cache from on-device SQLite.
            </Text>
          </View>
        </ScrollView>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 4,
  },
  inventoryIntro: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 10,
  },
  inventoryItem: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  itemRecipient: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 2,
  },
  itemData: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  wipeButton: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  wipeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  wipeSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
});

