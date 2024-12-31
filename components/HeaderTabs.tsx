// ------------------------------------------------------
// HeaderTabs.tsx
// ------------------------------------------------------
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Animated, // Import Animated for opacity handling
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface HeaderTabsProps {
  activeTab: 'My News' | 'Trending';
  onTabPress: (tab: 'My News' | 'Trending') => void;
  username?: string | null;
  profilePictureUrl?: string | null;
  onSettingsPress: () => void;
  onLoginPress: () => void;
  headerOpacity: Animated.AnimatedInterpolation; // New prop for opacity
}

const HeaderTabs: React.FC<HeaderTabsProps> = ({
  activeTab,
  onTabPress,
  username,
  profilePictureUrl,
  onSettingsPress,
  onLoginPress,
  headerOpacity, // Destructure the new prop
}) => {
  return (
    // Animated.View to handle the opacity fade-out
    <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
      {/* Tabs: My News / Trending */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'My News' && styles.tabButtonActive]}
          onPress={() => onTabPress('My News')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'My News' && styles.tabButtonTextActive,
            ]}
          >
            My News
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'Trending' && styles.tabButtonActive]}
          onPress={() => onTabPress('Trending')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'Trending' && styles.tabButtonTextActive,
            ]}
          >
            Trending
          </Text>
        </TouchableOpacity>
      </View>

      {/* Right: Settings + Profile */}
      <View style={styles.headerRightIcons}>
        <TouchableOpacity onPress={onSettingsPress}>
          <Icon name="settings-outline" size={22} color="#333" style={styles.headerIcon} />
        </TouchableOpacity>

        {username ? (
          <Image
            source={
              profilePictureUrl
                ? { uri: profilePictureUrl }
                : require('../assets/images/logo.png') // Fallback image
            }
            style={styles.userImage}
          />
        ) : (
          <TouchableOpacity onPress={onLoginPress}>
            <Icon name="person-circle-outline" size={24} color="#333" style={styles.headerIcon} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

export default HeaderTabs;

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    // Simplified top padding
    paddingTop: Platform.OS !== 'web' ? 50 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',
    backgroundColor: '#FFF', // Ensure background color for proper opacity
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // Elevation for Android
    elevation: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    marginRight: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#6C63FF',
  },
  tabButtonText: {
    color: '#333',
  },
  tabButtonTextActive: {
    color: '#FFF',
  },
  headerRightIcons: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginLeft: 15,
  },
  userImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginLeft: 15,
  },
});
