// components/HeaderTabs.tsx

import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons'; // Ensure Ionicons is installed
import { UserContext } from '../app/UserContext';

interface HeaderTabsProps {
  categories: string[];
  activeCategory: string;
  onCategorySelect: (category: string) => void;
  onFilterSelect: (filter: string) => void;
  selectedFilter: string;
  username?: string | null;
  profilePictureUrl?: string | null;
  onSettingsPress: () => void;
  onLoginPress: () => void;
}

const { width } = Dimensions.get('window');

// Create an Animated version of TouchableOpacity
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const HeaderTabs: React.FC<HeaderTabsProps> = ({
  categories,
  activeCategory,
  onCategorySelect,
  onFilterSelect,
  selectedFilter,
  username,
  profilePictureUrl,
  onSettingsPress,
  onLoginPress,
}) => {
  const { isDarkTheme } = useContext(UserContext);

  // Define filter options per category (excluding 'Trending' and 'See All')
  const getFilterOptions = (category: string): string[] => {
    if (category === 'Trending' || category === 'See All') {
      return []; // No filters for 'Trending' and 'See All'
    }
    return ['All', 'Tweets', 'Articles'];
  };

  const currentFilters = getFilterOptions(activeCategory);

  // Animation values for category and filter buttons
  const animationValues = useRef<{ [key: string]: Animated.Value }>({}).current;

  // Initialize animation values for all categories and filters
  useEffect(() => {
    categories.forEach((category) => {
      if (!animationValues[category]) {
        animationValues[category] = new Animated.Value(1); // Initial scale
      }
    });
    // Ensure "See All" has its animation value
    if (!animationValues['See All']) {
      animationValues['See All'] = new Animated.Value(1);
    }

    currentFilters.forEach((filter) => {
      if (!animationValues[filter]) {
        animationValues[filter] = new Animated.Value(1); // Initial scale
      }
    });
  }, [categories, currentFilters, animationValues]);

  const handlePressIn = (key: string) => {
    Animated.timing(animationValues[key], {
      toValue: 0.95, // Slightly smaller
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (key: string) => {
    Animated.timing(animationValues[key], {
      toValue: 1, // Back to original size
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handleFilterPress = (filter: string) => {
    onFilterSelect(filter);
  };

  const handleCategoryPress = (category: string) => {
    onCategorySelect(category);
    // Optionally reset filter to 'All' when a new category is selected
    if (category !== 'Trending' && category !== 'See All') {
      onFilterSelect('All');
    }
  };

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: isDarkTheme ? '#1F2937' : '#FFFFFF',
          borderBottomColor: isDarkTheme ? '#4B5563' : '#E2E2E2',
        },
      ]}
    >
      {/* User Icon / Profile Picture */}
      <TouchableOpacity
        onPress={username ? onSettingsPress : onLoginPress}
        style={styles.userIconContainer}
        accessible={true}
        accessibilityLabel={username ? 'Open Settings' : 'Login'}
      >
        {username && profilePictureUrl ? (
          <Image source={{ uri: profilePictureUrl }} style={styles.userImage} />
        ) : (
          <Icon
            name="person-circle-outline"
            size={30}
            color={isDarkTheme ? '#D1D5DB' : '#333333'}
          />
        )}
      </TouchableOpacity>

      {/* Categories and Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScrollContainer}
      >
        {categories.map((category) => {
          const isActive = activeCategory === category;
          return (
            <View
              key={category}
              style={[
                styles.categoryWithFilterContainer,
                isActive && styles.categoryWithFilterContainerActive,
              ]}
            >
              <AnimatedTouchableOpacity
                onPress={() => handleCategoryPress(category)}
                style={styles.categoryButton}
                onPressIn={() => handlePressIn(category)}
                onPressOut={() => handlePressOut(category)}
                accessible={true}
                accessibilityLabel={`Select category ${category}`}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isActive && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
                {/* Add arrow icon for "See All" */}
                {category === 'See All' && (
                  <Icon
                    name="chevron-forward-outline"
                    size={16}
                    color={isActive ? '#FFFFFF' : '#333333'}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </AnimatedTouchableOpacity>

              {/* Inline Filter Options with Animation */}
              {isActive && currentFilters.length > 0 && (
                <Animated.View
                  style={[
                    styles.filtersContainer,
                    {
                      backgroundColor: isDarkTheme ? '#374151' : '#F0F0F0',
                    },
                  ]}
                >
                  {currentFilters.map((filter) => (
                    <AnimatedTouchableOpacity
                      key={filter}
                      onPress={() => handleFilterPress(filter)}
                      style={[
                        styles.filterButton,
                        selectedFilter === filter && styles.filterButtonActive,
                      ]}
                      onPressIn={() => handlePressIn(filter)}
                      onPressOut={() => handlePressOut(filter)}
                      accessible={true}
                      accessibilityLabel={`Select filter ${filter}`}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          selectedFilter === filter && styles.filterTextActive,
                        ]}
                      >
                        {filter}
                      </Text>
                    </AnimatedTouchableOpacity>
                  ))}
                </Animated.View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default HeaderTabs;

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: Platform.OS !== 'web' ? 50 : 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    flexDirection: 'row', // Changed from default to row
    alignItems: 'center', // Center vertically
    // Removed position: 'relative' as it's the default
  },
  userIconContainer: {
    // Removed absolute positioning
    // Added marginRight to create space between icon and categories
    marginRight: 10,
  },
  userImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  categoriesScrollContainer: {
    // Removed marginLeft as Flexbox handles spacing
    alignItems: 'center',
    // Added paddingLeft to provide some spacing at the start
    paddingLeft: 10,
  },
  categoryWithFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    // Unified background for category and filters
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  categoryWithFilterContainerActive: {
    backgroundColor: '#6C63FF', // Highlight color
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 15,
    // Remove background color as it's handled by the container
    // backgroundColor: '#F0F0F0',
  },
  categoryText: {
    color: '#333333',
    fontSize: 12,
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  filtersContainer: {
    flexDirection: 'row',
    marginLeft: 6,
    borderRadius: 15,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  filterButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    marginRight: 6,
  },
  filterButtonActive: {
    backgroundColor: '#4B5563',
  },
  filterText: {
    color: '#333333',
    fontSize: 10,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
