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
      case 'Sparse':
      default:
        return '#64748B'; // slate
    }
  };

  const badgeColor = getBadgeColor(score.ratingLabel);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{score.scoreName}</Text>
          <Text style={styles.subtitle}>
            {score.amenitiesCount} mapped facilities • {score.daylightState}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{score.totalScore}%</Text>
          <Text style={styles.badgeLabel}>{score.ratingLabel}</Text>
        </View>
      </View>

      {/* Progress Bars for Components */}
      <View style={styles.metricsContainer}>
        {/* Amenity Density */}
        <View style={styles.metricRow}>
          <View style={styles.metricLabelRow}>
            <Text style={styles.metricLabel}>Mapped Amenities</Text>
            <Text style={styles.metricValue}>{score.amenityScore}/40 pts ({score.amenityDensityPer100m}/100m)</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${(score.amenityScore / 40) * 100}%`, backgroundColor: '#38BDF8' }]} />
          </View>
        </View>

        {/* Solar Daylight */}
        <View style={styles.metricRow}>
          <View style={styles.metricLabelRow}>
            <Text style={styles.metricLabel}>Daylight Factor</Text>
            <Text style={styles.metricValue}>{score.daylightScore}/30 pts ({score.solarElevationDeg.toFixed(1)}° solar)</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${(score.daylightScore / 30) * 100}%`, backgroundColor: '#FBBF24' }]} />
          </View>
        </View>

        {/* Street Imagery */}
        <View style={styles.metricRow}>
          <View style={styles.metricLabelRow}>
            <Text style={styles.metricLabel}>Street Imagery</Text>
            <Text style={styles.metricValue}>
              {score.hasStreetImagery ? `${score.imageryScore}/30 pts (Panoramax)` : '0/30 pts (No coverage)'}
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${(score.imageryScore / 30) * 100}%`, backgroundColor: '#A78BFA' }]} />
          </View>
        </View>
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
    marginRight: 8,
  },
  title: {
    fontSize: 15,
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
    minWidth: 64,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F8FAFC',
    textTransform: 'uppercase',
  },
  metricsContainer: {
    marginVertical: 4,
  },
  metricRow: {
    marginBottom: 10,
  },
  metricLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CBD5E1',
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#090D16',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  missingContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  missingText: {
    fontSize: 11,
    color: '#F59E0B',
    lineHeight: 16,
  },
  disclaimerContainer: {
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

