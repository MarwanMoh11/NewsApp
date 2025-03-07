import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ChronicallyButtonProps {
  onHomePress: () => void;
  onTrendingPress: () => void;
  onBookmarkPress: () => void;
  onFollowingPress: () => void;
  onSearchPress: () => void; // Not used since Search icon is removed.
  onArrowPress: () => void;
  arrowDisabled: boolean;
  scrolledFarDown: boolean;
  activeTab: 'home' | 'trending' | 'saved' | 'friends';
  isDarkTheme: boolean;
  showHomeButton?: boolean;
}

const ChronicallyButton: React.FC<ChronicallyButtonProps> = ({
  onHomePress,
  onTrendingPress,
  onBookmarkPress,
  onFollowingPress,
  onSearchPress,
  onArrowPress,
  arrowDisabled,
  scrolledFarDown,
  activeTab,
  isDarkTheme,
  showHomeButton = true,
}) => {
  // Define color palettes for dark and light themes.
  const darkPalette = {
    defaultIconColor: '#B0B0B0',
    homeActive: '#00AEEF',
    trendingActive: '#FF6F61',
    savedActive: '#34C759',
    friendsActive: '#FF9500',
    bgColor: '#121212',
    borderColor: '#272727',
  };

  const lightPalette = {
    defaultIconColor: '#333333',
    homeActive: '#007AFF',
    trendingActive: '#FF6F61',
    savedActive: '#34C759',
    friendsActive: '#FF9500',
    bgColor: '#FFFFFF',
    borderColor: '#E2E2E2',
  };

  const palette = isDarkTheme ? darkPalette : lightPalette;

  // Smart press handlers for Home and Trending.
  const handleHomePress = () => {
    if (activeTab === 'home' && scrolledFarDown && !arrowDisabled) {
      onArrowPress();
    } else {
      onHomePress();
    }
  };

  const handleTrendingPress = () => {
    if (activeTab === 'trending' && scrolledFarDown && !arrowDisabled) {
      onArrowPress();
    } else {
      onTrendingPress();
    }
  };

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[
        styles.safeArea,
        { backgroundColor: palette.bgColor, borderTopColor: palette.borderColor },
      ]}
    >
      <View style={styles.container}>
        {/* Conditionally render the Home button */}
        {showHomeButton && (
          <TouchableOpacity
            onPress={handleHomePress}
            style={styles.button}
            accessibilityLabel="Home"
          >
            <Icon
              name="home-outline"
              size={24}
              color={activeTab === 'home' ? palette.homeActive : palette.defaultIconColor}
            />
            {activeTab === 'home' && (
              <View style={[styles.underline, { backgroundColor: palette.homeActive }]} />
            )}
          </TouchableOpacity>
        )}
        {/* Trending Button */}
        <TouchableOpacity
          onPress={handleTrendingPress}
          style={styles.button}
          accessibilityLabel="Trending"
        >
          <Icon
            name="flame-outline"
            size={24}
            color={activeTab === 'trending' ? palette.trendingActive : palette.defaultIconColor}
          />
          {activeTab === 'trending' && (
            <View style={[styles.underline, { backgroundColor: palette.trendingActive }]} />
          )}
        </TouchableOpacity>
        {/* Saved Button */}
        <TouchableOpacity onPress={onBookmarkPress} style={styles.button} accessibilityLabel="Saved">
          <Icon
            name="bookmark-outline"
            size={24}
            color={activeTab === 'saved' ? palette.savedActive : palette.defaultIconColor}
          />
          {activeTab === 'saved' && (
            <View style={[styles.underline, { backgroundColor: palette.savedActive }]} />
          )}
        </TouchableOpacity>
        {/* Following Button */}
        <TouchableOpacity onPress={onFollowingPress} style={styles.button} accessibilityLabel="Friends">
          <Icon
            name="people-outline"
            size={24}
            color={activeTab === 'friends' ? palette.friendsActive : palette.defaultIconColor}
          />
          {activeTab === 'friends' && (
            <View style={[styles.underline, { backgroundColor: palette.friendsActive }]} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ChronicallyButton;

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: { elevation: 3 },
      web: { zIndex: 1000 },
    }),
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
  },
  button: {
    padding: 10,
    borderRadius: 30,
    alignItems: 'center',
  },
  underline: {
    marginTop: 4,
    width: 20,
    height: 2,
    borderRadius: 1,
  },
});
