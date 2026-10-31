import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';

export type ActiveTab = 'explore' | 'navigate' | 'saved';

interface BottomTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hasActiveRoute: boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  hasActiveRoute,
}) => {
  const tabs: { key: ActiveTab; label: string; icon: string; badge?: string }[] = [
    { key: 'explore', label: 'Explore', icon: '🗺️' },
    {
      key: 'navigate',
      label: 'Navigate',
      icon: '🧭',
      badge: hasActiveRoute ? 'LIVE' : undefined,
    },
    { key: 'saved', label: 'Saved', icon: '🔖' },
  ];

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBarInner}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label} tab`}
              accessibilityState={{ selected: isActive }}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            >
              <View style={styles.iconWrapper}>
                <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                  {tab.icon}
                </Text>
                {tab.badge && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicatorDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
    paddingHorizontal: 16,
    zIndex: 99,
  },
  tabBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    minWidth: 72,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -14,
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: '#090D16',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  activeIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
    marginTop: 2,
  },
});

