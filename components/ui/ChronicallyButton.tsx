// components/ui/ChronicallyButton.tsx
// This is the full, unabbreviated code for the ChronicallyButton component,
// including the 'Explore' tab and 'Profile' tab.

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Text, // Import Text for labels
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context'; // Correct import

// Define the props interface
interface ChronicallyButtonProps {
  onHomePress: () => void;
  onTrendingPress: () => void;
  onBookmarkPress: () => void;
  onExplorePress: () => void; // Changed from onFeedPress to onExplorePress
  onProfilePress: () => void; // Changed from onFriendsPress to onProfilePress
  onArrowPress: () => void; // Action for pressing the *active* tab (e.g., scroll to top)
  // Updated activeTab type to include 'explore' and 'profile'
  activeTab: 'home' | 'trending' | 'saved' | 'explore' | 'profile';
  isDarkTheme: boolean;
}

// Define Tab configuration for easier management
type TabConfig = {
  // Updated key type to include 'explore' and 'profile'
  key: 'home' | 'trending' | 'saved' | 'explore' | 'profile';
  label: string;
  icon: string; // Icon name (outline)
  iconActive: string; // Icon name (filled)
  onPress: () => void; // Press handler for navigation
  onActivePress: () => void; // Press handler when tab is already active
  accessibilityLabel: string;
};

const ChronicallyButton: React.FC<ChronicallyButtonProps> = ({
  onHomePress,
  onTrendingPress,
  onBookmarkPress,
  onExplorePress, // Changed from onFeedPress to onExplorePress
  onProfilePress, // Changed from onFriendsPress to onProfilePress
  onArrowPress, // Action for active tab press
  activeTab,
  isDarkTheme,
}) => {
  // Define color palettes
  const colors = {
    background: isDarkTheme ? '#121212' : '#FFFFFF',
    border: isDarkTheme ? '#2C2C2E' : '#E0E0E0',
    iconDefault: isDarkTheme ? '#8A8A8E' : '#8E8E93',
    // Using single accent color for active state
    iconActive: isDarkTheme ? '#9067C6' : '#007AFF',
    textActive: isDarkTheme ? '#9067C6' : '#007AFF',
  };

  // Use reduced icon size for compactness
  const iconSize = 22;

  // Define the tabs using the TabConfig type
  // Updated with 'Explore' tab and 'Profile' tab
  const tabs: TabConfig[] = [
    {
      key: 'home',
      label: 'Home',
      icon: 'home-outline',
      iconActive: 'home',
      onPress: onHomePress,
      onActivePress: onArrowPress,
      accessibilityLabel: 'Home Tab',
    },
    {
      key: 'trending',
      label: 'Trending',
      icon: 'flame-outline',
      iconActive: 'flame',
      onPress: onTrendingPress,
      onActivePress: onArrowPress,
      accessibilityLabel: 'Trending Tab',
    },
    {
      key: 'saved',
      label: 'Saved',
      icon: 'bookmark-outline',
      iconActive: 'bookmark',
      onPress: onBookmarkPress,
      onActivePress: onArrowPress,
      accessibilityLabel: 'Saved Items Tab',
    },
    // Explore Tab (replacing Feed)
    {
      key: 'explore',
      label: 'Explore',
      icon: 'compass-outline', // Using compass icon for explore
      iconActive: 'compass',
      onPress: onExplorePress,
      onActivePress: onArrowPress,
      accessibilityLabel: 'Explore Tab',
    },
    // Profile Tab (replacing Friends)
    {
      key: 'profile',
      label: 'Profile',
      icon: 'person-outline',
      iconActive: 'person',
      onPress: onProfilePress,
      onActivePress: onArrowPress,
      accessibilityLabel: 'Profile Tab',
    },
  ];

  return (
    // Use SafeAreaView to handle notches/bottom bars
    <SafeAreaView
      edges={['bottom']}
      style={[
        styles.safeArea,
        { backgroundColor: colors.background, borderTopColor: colors.border },
      ]}
    >
      {/* Inner container for the buttons - Reduced height */}
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const activeColor = colors.iconActive; // Using single accent

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={isActive ? tab.onActivePress : tab.onPress}
              // Using updated button style (reduced padding)
              style={styles.button}
              accessibilityLabel={tab.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Icon
                name={isActive ? tab.iconActive : tab.icon}
                size={iconSize} // Using reduced icon size
                color={isActive ? activeColor : colors.iconDefault}
              />
              <Text
                // Using updated label style (reduced margin)
                style={[
                  styles.label,
                  { color: isActive ? activeColor : colors.iconDefault },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    // Use reduced height for compactness
    height: 48,
    paddingHorizontal: 10,
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Use reduced vertical padding slightly
    paddingVertical: 4,
    height: '100%',
  },
  label: {
    fontSize: 10, // Keep font size readable
    // Use reduced margin for compactness
    marginTop: 2,
    textAlign: 'center',
  },
});

export default ChronicallyButton; // Keep default export
