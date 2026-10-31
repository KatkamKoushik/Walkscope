import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import type { RouteIntelligenceReport } from '../../../core/services/routeIntelligenceService';

interface RouteEvidenceDrawerProps {
  intelligence: RouteIntelligenceReport | null;
}

export const RouteEvidenceDrawer: React.FC<RouteEvidenceDrawerProps> = ({
  intelligence,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'venues' | 'roads' | 'support' | 'audit'>('venues');

  if (!intelligence) return null;

  const { venueIntelligence, roadShare, supportIntelligence, reproducibility } = intelligence;

  return (
    <View style={styles.container}>
      {/* Drawer Toggle Header Button */}
      <TouchableOpacity
        style={styles.toggleHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Toggle Why This Route Evidence Drawer"
      >
        <View style={styles.headerLeft}>
          <Text style={styles.drawerIcon}>🔬</Text>
          <View>
            <Text style={styles.drawerTitle}>Why This Route? (Evidence Drawer)</Text>
            <Text style={styles.drawerSubtitle}>
              Open hours at arrival • Road mix • Longest gap • Verified audit
            </Text>
          </View>
        </View>
        <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Expanded Body */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Sub Navigation Segmented Control */}
          <View style={styles.subTabBar}>
            <TouchableOpacity
              style={[styles.subTabItem, activeSubTab === 'venues' && styles.subTabItemActive]}
              onPress={() => setActiveSubTab('venues')}
            >
              <Text style={[styles.subTabText, activeSubTab === 'venues' && styles.subTabTextActive]}>
                🏬 Venues ({venueIntelligence.totalVenuesCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subTabItem, activeSubTab === 'roads' && styles.subTabItemActive]}
              onPress={() => setActiveSubTab('roads')}
            >
              <Text style={[styles.subTabText, activeSubTab === 'roads' && styles.subTabTextActive]}>
                🛣️ Road Mix
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subTabItem, activeSubTab === 'support' && styles.subTabItemActive]}
              onPress={() => setActiveSubTab('support')}
            >
              <Text style={[styles.subTabText, activeSubTab === 'support' && styles.subTabTextActive]}>
                🛡️ Verified ({supportIntelligence.verifiedPointsCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subTabItem, activeSubTab === 'audit' && styles.subTabItemActive]}
              onPress={() => setActiveSubTab('audit')}
            >
              <Text style={[styles.subTabText, activeSubTab === 'audit' && styles.subTabTextActive]}>
                📋 Audit
              </Text>
            </TouchableOpacity>
          </View>

          {/* SubTab 1: Venues & Opening Hours Intelligence */}
          {activeSubTab === 'venues' && (
            <View style={styles.tabPane}>
              {/* Summary KPIs */}
              <View style={styles.kpiRow}>
                <View style={[styles.kpiBox, { borderColor: '#10B981' }]}>
                  <Text style={[styles.kpiVal, { color: '#10B981' }]}>{venueIntelligence.openCount}</Text>
                  <Text style={styles.kpiLbl}>Listed Open</Text>
                </View>
                <View style={[styles.kpiBox, { borderColor: '#EF4444' }]}>
                  <Text style={[styles.kpiVal, { color: '#EF4444' }]}>{venueIntelligence.closedCount}</Text>
                  <Text style={styles.kpiLbl}>Listed Closed</Text>
                </View>
                <View style={[styles.kpiBox, { borderColor: '#64748B' }]}>
                  <Text style={[styles.kpiVal, { color: '#94A3B8' }]}>{venueIntelligence.unknownCount}</Text>
                  <Text style={styles.kpiLbl}>Hours Unknown</Text>
                </View>
              </View>

              {/* Continuity / Gap Metric */}
              <View style={styles.gapNoticeBox}>
                <Text style={styles.gapTitle}>
                  Longest Mapped-Venue Gap: <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{venueIntelligence.longestGapMeters} m</Text>
                </Text>
                <Text style={styles.gapDesc}>
                  Average venue spacing is ~{venueIntelligence.averageGapMeters}m along this corridor.
                </Text>
              </View>

              {/* Detailed Venues List */}
              <View style={styles.venueList}>
                {venueIntelligence.venues.length === 0 ? (
                  <Text style={styles.emptyNotice}>No commercial venues or facilities mapped along this corridor.</Text>
                ) : (
                  venueIntelligence.venues.slice(0, 5).map((v, i) => (
                    <View key={v.id || i} style={styles.venueRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.venueName} numberOfLines={1}>{v.name}</Text>
                        <Text style={styles.venueMeta}>
                          +{v.alongRouteDistanceMeters}m along route • ETA {new Date(v.estimatedPassingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              v.openingStatus === 'OPEN'
                                ? 'rgba(16, 185, 129, 0.2)'
                                : v.openingStatus === 'CLOSED'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(100, 116, 139, 0.2)',
                            borderColor:
                              v.openingStatus === 'OPEN'
                                ? '#10B981'
                                : v.openingStatus === 'CLOSED'
                                ? '#EF4444'
                                : '#64748B',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color:
                                v.openingStatus === 'OPEN'
                                  ? '#10B981'
                                  : v.openingStatus === 'CLOSED'
                                  ? '#EF4444'
                                  : '#94A3B8',
                            },
                          ]}
                        >
                          {v.openingStatus}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <Text style={styles.strictRuleNote}>
                ⚠️ NightWise Rule: Venues with missing or old opening hours are never treated as open.
              </Text>
            </View>
          )}

          {/* SubTab 2: Major-Road Share Breakdown */}
          {activeSubTab === 'roads' && (
            <View style={styles.tabPane}>
              <View style={styles.roadBarContainer}>
                <View style={[styles.roadBarSegment, { width: `${roadShare.majorRoadPercent}%`, backgroundColor: '#0284C7' }]} />
                <View style={[styles.roadBarSegment, { width: `${roadShare.footwayPercent}%`, backgroundColor: '#10B981' }]} />
                <View style={[styles.roadBarSegment, { width: `${roadShare.localRoadPercent}%`, backgroundColor: '#F59E0B' }]} />
                <View style={[styles.roadBarSegment, { width: `${roadShare.otherPercent}%`, backgroundColor: '#475569' }]} />
              </View>

              <View style={styles.roadLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
                  <Text style={styles.legendText}>Major Roads: {roadShare.majorRoadPercent}% ({roadShare.majorDistanceMeters}m)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Dedicated Footways: {roadShare.footwayPercent}% ({roadShare.footwayDistanceMeters}m)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>Local Streets: {roadShare.localRoadPercent}% ({roadShare.localDistanceMeters}m)</Text>
                </View>
              </View>

              <Text style={styles.disclaimerText}>{roadShare.disclaimer}</Text>
            </View>
          )}

          {/* SubTab 3: Verified Support Registry */}
          {activeSubTab === 'support' && (
            <View style={styles.tabPane}>
              {supportIntelligence.supportPoints.length === 0 ? (
                <Text style={styles.emptyNotice}>
                  No government-verified support centres or 24/7 public desks within 250m of this corridor. Ordinary OSM nodes remain marked as unverified.
                </Text>
              ) : (
                supportIntelligence.supportPoints.map((sp) => (
                  <View key={sp.id} style={styles.supportCard}>
                    <View style={styles.supportHeader}>
                      <Text style={styles.supportName}>{sp.name}</Text>
                      <View style={styles.verifiedTag}>
                        <Text style={styles.verifiedTagText}>Confirmed Access</Text>
                      </View>
                    </View>
                    <Text style={styles.supportDetail}>Hours: {sp.operatingHours}</Text>
                    <Text style={styles.supportDetail}>Source: {sp.verificationSource}</Text>
                    <Text style={styles.supportDetail}>Expires: {new Date(sp.expiresAt).toLocaleDateString()}</Text>
                    {sp.evidenceUrl ? (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(sp.evidenceUrl)}
                        accessibilityRole="link"
                      >
                        <Text style={styles.evidenceLink}>View Verification Document ↗</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
              <Text style={styles.disclaimerText}>{supportIntelligence.disclaimer}</Text>
            </View>
          )}

          {/* SubTab 4: Reproducibility & Audit Versions */}
          {activeSubTab === 'audit' && (
            <View style={styles.tabPane}>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Scorer Version:</Text>
                <Text style={styles.auditValue}>{reproducibility.scorer_version}</Text>
              </View>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Opening Hours Engine:</Text>
                <Text style={styles.auditValue}>v{reproducibility.opening_hours_parser_version}</Text>
              </View>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Graph Snapshot:</Text>
                <Text style={styles.auditValue}>{reproducibility.graph_version}</Text>
              </View>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Walking Speed Assumed:</Text>
                <Text style={styles.auditValue}>{reproducibility.walking_speed_ms} m/s (~4.3 km/h)</Text>
              </View>
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Departure Timestamp:</Text>
                <Text style={styles.auditValue}>{new Date(reproducibility.departure_timestamp).toLocaleTimeString()}</Text>
              </View>

              <Text style={styles.disclaimerText}>
                All calculations are 100% deterministic and reproducible from versioned source snapshots.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    marginVertical: 10,
    overflow: 'hidden',
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  drawerIcon: {
    fontSize: 22,
  },
  drawerTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  drawerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  chevron: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  expandedContent: {
    padding: 14,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#090D16',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  subTabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabItemActive: {
    backgroundColor: '#1E293B',
  },
  subTabText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  tabPane: {
    gap: 10,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  kpiLbl: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  gapNoticeBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    padding: 10,
    borderRadius: 8,
  },
  gapTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  gapDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  venueList: {
    gap: 6,
  },
  venueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#131C2E',
    padding: 10,
    borderRadius: 8,
  },
  venueName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  venueMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  strictRuleNote: {
    color: '#94A3B8',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyNotice: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  roadBarContainer: {
    height: 12,
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginBottom: 8,
  },
  roadBarSegment: {
    height: '100%',
  },
  roadLegendRow: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '500',
  },
  supportCard: {
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  supportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supportName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  verifiedTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedTagText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  supportDetail: {
    color: '#94A3B8',
    fontSize: 11,
  },
  evidenceLink: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  auditLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  auditValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  disclaimerText: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
  },
});
