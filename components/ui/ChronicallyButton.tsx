// ------------------------------------------------------
// ChronicallyButton.tsx
// ------------------------------------------------------
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

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
  // Change arrow color if scrolled far
  const arrowColor = scrolledFarDown ? '#6C63FF' : '#999';

  return (
    <View style={styles.bottomBarContainer}>
      {/* Home */}
      <TouchableOpacity style={styles.bottomBarButton} onPress={onHomePress}>
        <Icon name="home-outline" size={22} color="#333" />
      </TouchableOpacity>

      {/* Bookmark */}
      <TouchableOpacity style={styles.bottomBarButton} onPress={onBookmarkPress}>
        <Icon name="bookmark-outline" size={22} color="#333" />
      </TouchableOpacity>

      {/* Arrow Up - Conditionally Rendered */}
      {scrolledFarDown && (
        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={onArrowPress}
          disabled={arrowDisabled}
        >
          <Icon name="arrow-up" size={24} color={arrowColor} />
        </TouchableOpacity>
      )}

      {/* Following */}
      <TouchableOpacity style={styles.bottomBarButton} onPress={onFollowingPress}>
        <Icon name="people-outline" size={22} color="#333" />
      </TouchableOpacity>

      {/* Search */}
      <TouchableOpacity style={styles.bottomBarButton} onPress={onSearchPress}>
        <Icon name="search-outline" size={22} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

export default ChronicallyButton;

const styles = StyleSheet.create({
  bottomBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E2E2',
    // Position absolutely to pin to bottom
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // Elevation for Android
    elevation: 2,
    zIndex: 10, // Ensure it appears above other components
  },
  bottomBarButton: {
    padding: 8,
  },
});
