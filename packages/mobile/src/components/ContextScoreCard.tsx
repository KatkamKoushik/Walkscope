import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ContextScoreBreakdown } from '@walking-companion/core';

interface ContextScoreCardProps {
  score: ContextScoreBreakdown;
}

export const ContextScoreCard: React.FC<ContextScoreCardProps> = ({ score }) => {
  const getBadgeColor = (label: string) => {
    switch (label) {
      case 'Comprehensive':
        return '#10B981'; // emerald
      case 'Moderate':
        return '#F59E0B'; // amber
      case 'Incomplete Data':
        return '#EF4444'; // rose/red
      case 'Sparse':
      default:
        return '#64748B'; // slate
    }
  };

  const badgeColor = getBadgeColor(score.ratingLabel);
  const amenityScoreVal = score.amenityScore !== null ? score.amenityScore : 0;
  const isAmenityUnavailable = score.amenityStatus === 'UNAVAILABLE';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{score.scoreName}</Text>
          <Text style={styles.subtitle}>
            {isAmenityUnavailable ? 'OSM data unavailable' : `${score.amenitiesCount} mapped facilities`} • {Math.round((score.imageryCoverageRatio || 0) * 100)}% imagery
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{score.totalScore}%</Text>
          <Text style={styles.badgeLabel}>{score.ratingLabel}</Text>
        </View>
      </View>

      {/* Progress Bars for Information Coverage Components */}
      <View style={styles.metricsContainer}>
        {/* Amenity Density (0-50 pts) */}
        <View style={styles.metricRow}>
          <View style={styles.metricLabelRow}>
            <Text style={styles.metricLabel}>Corridor Amenity Density</Text>
            <Text style={styles.metricValue}>
              {isAmenityUnavailable
                ? 'Unavailable (Overpass Error)'
                : `${amenityScoreVal}/50 pts (${score.amenityDensityPer100m}/100m)`}
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${(amenityScoreVal / 50) * 100}%`,
                  backgroundColor: isAmenityUnavailable ? '#EF4444' : '#38BDF8',
                },
              ]}
            />
          </View>
        </View>

        {/* Street Imagery Coverage (0-50 pts) */}
        <View style={styles.metricRow}>
          <View style={styles.metricLabelRow}>
            <Text style={styles.metricLabel}>
              Street Imagery ({score.imagerySamplingMode === 'corridor_checkpoints' ? 'Corridor Sampled' : 'Near Origin'})
            </Text>
            <Text style={styles.metricValue}>
              {score.hasStreetImagery
                ? `${score.imageryScore}/50 pts (${Math.round((score.imageryCoverageRatio || 0) * 100)}% coverage)`
                : '0/50 pts (No coverage)'}
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(score.imageryScore / 50) * 100}%`, backgroundColor: '#A78BFA' },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Environmental Walking Conditions (Independent Dimension) */}
      <View style={styles.environmentalBox}>
        <View style={styles.environmentalHeader}>
          <Text style={styles.environmentalTitle}>
            ☀️ Ambient Condition: {score.walkingConditions?.conditionLabel || score.daylightState}
          </Text>
          <Text style={styles.environmentalValue}>
            {score.solarElevationDeg.toFixed(1)}° solar
          </Text>
        </View>
        <Text style={styles.environmentalNotice}>
          {score.walkingConditions?.visibilityNotice || 'Ambient lighting conditions.'}
        </Text>
      </View>

      {/* Missing Data / Gaps */}
      {score.missingDataNotices.length > 0 && (
        <View style={styles.missingContainer}>
          {score.missingDataNotices.map((notice, index) => (
            <Text key={index} style={styles.missingText}>ℹ️ {notice}</Text>
          ))}
        </View>
      )}

      {/* Mandatory Disclaimer */}
      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimerText}>{score.disclaimer}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricsContainer: {
    gap: 10,
    marginBottom: 10,
  },
  metricRow: {
    gap: 4,
  },
  metricLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CBD5E1',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  environmentalBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
  },
  environmentalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  environmentalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FBBF24',
  },
  environmentalValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FDE68A',
  },
  environmentalNotice: {
    fontSize: 11,
    color: '#FCD34D',
    marginTop: 3,
    lineHeight: 15,
  },
  missingContainer: {
    marginTop: 6,
    padding: 8,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    gap: 4,
  },
  missingText: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  disclaimerContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  disclaimerText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 14,
  },
});
