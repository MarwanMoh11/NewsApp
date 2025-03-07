import React, { useContext, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext';

interface HeaderTabsProps {
  categories: string[];
  activeCategory: string;
  onCategorySelect: (category: string) => void;
  activeFilter: string;
  onFilterSelect: (filter: string) => void;
  username?: string | null;
  profilePictureUrl?: string | null;
  onSettingsPress: () => void;
  onLoginPress: () => void;
  onSearchPress: () => void;
}

const HeaderTabs: React.FC<HeaderTabsProps> = ({
  categories,
  activeCategory,
  onCategorySelect,
  activeFilter,
  onFilterSelect,
  username,
  profilePictureUrl,
  onSettingsPress,
  onLoginPress,
  onSearchPress,
}) => {
  const { isDarkTheme } = useContext(UserContext);

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  // For the animated header fade-in
  const headerOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Check if we’re on a mobile device
  const isMobile = Platform.OS === 'android' || Platform.OS === 'ios';

  // Colors for dark/light mode
  const bgColor = isDarkTheme ? '#121212' : '#F4F7FA';
  const borderColor = isDarkTheme ? '#272727' : '#E2E2E2';
  const textColor = isDarkTheme ? '#FFFFFF' : '#333333';

  // Dynamically sized values for mobile vs. web
  const iconSize = isMobile ? 20 : 24;
  const userImageSize = isMobile ? 25 : 30;
  const categoryFontSize = isMobile ? 12 : 14;
  const topPadding = isMobile ? 40 : 10; // Adjust top padding for mobile

  const toggleFilterDropdown = () => {
    if (showFilterDropdown) {
      Animated.timing(dropdownAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setShowFilterDropdown(false));
    } else {
      setShowFilterDropdown(true);
      Animated.timing(dropdownAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleFilterSelect = (filter: string) => {
    onFilterSelect(filter);
    toggleFilterDropdown();
  };

  return (
    <>
      <Animated.View
        style={[
          styles.headerContainer,
          {
            backgroundColor: bgColor,
            borderBottomColor: borderColor,
            opacity: headerOpacity,
            paddingTop: topPadding,
          },
        ]}
      >
        {/* Left: Profile Photo */}
        <TouchableOpacity
          onPress={username ? onSettingsPress : onLoginPress}
          style={styles.userIconContainer}
          accessibilityLabel={username ? 'Open Settings' : 'Login'}
        >
          {username && profilePictureUrl ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={[
                styles.userImage,
                {
                  width: userImageSize,
                  height: userImageSize,
                  borderRadius: userImageSize / 2,
                },
              ]}
            />
          ) : (
            <Icon name="person-circle-outline" size={iconSize} color={textColor} />
          )}
        </TouchableOpacity>

        {/* Middle: Category Buttons (scrollable) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContainer}
        >
          {categories.map((category) => {
            const isActive = activeCategory.toLowerCase() === category.toLowerCase();
            return (
              <TouchableOpacity
                key={category}
                onPress={() => onCategorySelect(category)}
                style={[
                  styles.categoryButton,
                  isActive && styles.categoryButtonActive,
                ]}
                accessibilityLabel={`Select category ${category}`}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { fontSize: categoryFontSize },
                    isActive && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Right: Action Icons */}
        <View style={styles.rightIconsContainer}>
          {/* Wrap the filter button and its dropdown in a relative container */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              onPress={toggleFilterDropdown}
              style={styles.topIconButton}
              accessibilityLabel="Filter"
            >
              <Icon name="options-outline" size={iconSize} color={textColor} />
            </TouchableOpacity>
            {showFilterDropdown && (
              <Animated.View
                style={[
                  styles.filterDropdown,
                  {
                    opacity: dropdownAnim,
                    transform: [
                      {
                        translateY: dropdownAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 0], // No additional translation needed
                        }),
                      },
                    ],
                  },
                ]}
              >
                {['Tweets', 'Articles', 'All'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => handleFilterSelect(option)}
                    style={styles.filterOption}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        activeFilter === option && styles.filterOptionTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}
          </View>

          <TouchableOpacity
            onPress={onSearchPress}
            style={styles.topIconButton}
            accessibilityLabel="Search"
          >
            <Icon name="search-outline" size={iconSize} color={textColor} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
};

export default HeaderTabs;

const styles = StyleSheet.create({
  headerContainer: {
    position: 'relative', // Ensures that the dropdown is positioned relative to the header
    zIndex: 1000, // High zIndex to be above list items
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIconContainer: {
    marginRight: 10,
  },
  userImage: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  categoriesScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryButton: {
    marginHorizontal: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  categoryButtonActive: {
    backgroundColor: '#374151',
  },
  categoryText: {
    color: '#374151',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  rightIconsContainer: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  topIconButton: {
    padding: 6, // Reduced for mobile-friendliness
    marginHorizontal: 4,
  },
  filterContainer: {
    position: 'relative', // Acts as the relative parent for the dropdown
  },
  filterDropdown: {
    position: 'absolute',
    top: 40, // Adjust as needed so it's right below the filter button
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    elevation: 10, // Higher elevation for Android
    zIndex: 1100, // Even higher zIndex than headerContainer
  },
  filterOption: {
    paddingVertical: 6,
  },
  filterOptionText: {
    fontSize: 14,
    color: '#333333',
  },
  filterOptionTextActive: {
    fontWeight: 'bold',
    color: '#1565C0',
  },
});
