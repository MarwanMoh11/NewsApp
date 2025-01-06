// ------------------------------------------------------
// ChronicallyButton.tsx
// ------------------------------------------------------
import React, { useContext } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../../app/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ChronicallyButtonProps {
  onHomePress: () => void;
  onBookmarkPress: () => void;
  onArrowPress: () => void;       // Scroll to top
  arrowDisabled: boolean;
  onFollowingPress: () => void;
  onSearchPress: () => void;
  scrolledFarDown: boolean;
}

const ChronicallyButton: React.FC<ChronicallyButtonProps> = ({
  onHomePress,
  onBookmarkPress,
  onArrowPress,
  arrowDisabled,
  onFollowingPress,
  onSearchPress,
  scrolledFarDown,
}) => {
  const { isDarkTheme } = useContext(UserContext); // Consume theme from context

  // Determine arrow color based on scroll position and theme
  const arrowColor = scrolledFarDown
    ? isDarkTheme
      ? '#BB9CED' // Purple in dark mode
      : '#6C63FF' // Purple in light mode
    : isDarkTheme
    ? '#9CA3AF' // Light gray in dark mode
    : '#999999'; // Gray in light mode

  // Determine background color based on theme
  const backgroundColor = isDarkTheme ? '#1F2937' : '#FFFFFF';

  // Determine border color based on theme
  const borderColor = isDarkTheme ? '#374151' : '#E2E2E2';

  // Determine icon color based on theme
  const iconColor = isDarkTheme ? '#D1D5DB' : '#333333';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={[styles.bottomBarContainer, { backgroundColor, borderTopColor: borderColor }]}>
        {/* Home */}
        <TouchableOpacity style={styles.bottomBarButton} onPress={onHomePress}>
          <Icon name="home-outline" size={22} color={iconColor} />
        </TouchableOpacity>

        {/* Bookmark */}
        <TouchableOpacity style={styles.bottomBarButton} onPress={onBookmarkPress}>
          <Icon name="bookmark-outline" size={22} color={iconColor} />
        </TouchableOpacity>

        {/* Arrow Up - Conditionally Rendered */}
        {scrolledFarDown && (
          <TouchableOpacity
            style={styles.bottomBarButton}
            onPress={onArrowPress}
            disabled={arrowDisabled}
            accessibilityLabel="Scroll to top"
            accessibilityRole="button"
          >
            <Icon name="arrow-up" size={24} color={arrowColor} />
          </TouchableOpacity>
        )}

        {/* Following */}
        <TouchableOpacity style={styles.bottomBarButton} onPress={onFollowingPress}>
          <Icon name="people-outline" size={22} color={iconColor} />
        </TouchableOpacity>

        {/* Search */}
        <TouchableOpacity style={styles.bottomBarButton} onPress={onSearchPress}>
          <Icon name="search-outline" size={22} color={iconColor} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ChronicallyButton;

const styles = StyleSheet.create({
  safeArea: {
    // Ensure the bottom bar stays at the bottom
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Optional: Add shadow or elevation to appear above other content
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
      web: {
        // For web, ensure the bottom bar is on top
        zIndex: 1000,
      },
    }),
  },
  bottomBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    // Dynamic backgroundColor and borderTopColor are applied inline based on theme
    // Shadow for iOS
    // Elevation for Android
    // Positioning handled by SafeAreaView
  },
  bottomBarButton: {
    padding: 8,
  },
});
