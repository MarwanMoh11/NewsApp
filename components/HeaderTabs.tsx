// HeaderTabs.tsx

import React, { useContext, useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust path if needed

// --- Define the props interface ---
export interface HeaderTabsProps {
  activeFeedType: 'forYou' | 'chronological' | 'trending';
  onFeedTypeChange: (feedType: 'forYou' | 'chronological') => void; // To tell Index.tsx to change feed

  // Main Categories (for chronological)
  categories?: string[];
  activeCategory?: string;
  onCategorySelect?: (category: string) => void;

  // Subcategories (for chronological)
  subcategories?: string[];
  allUserPreferences?: string[];
  activeSubcategory?: string | string[] | null;
  onSubcategorySelect?: (subcategory: string | string[] | null) => void;

  // Content Type Filter (for chronological)
  activeFilter?: string;
  onContentTypeFilterChange?: (filter: string) => void;

  // User & Search (always applicable)
  username?: string | null;
  profilePictureUrl?: string | null;
  onSettingsPress: () => void;
  onLoginPress: () => void;
  onSearch: (query: string) => void; // This is called when search input changes
  isLoggedIn: boolean;
  searchQuery: string; // Current search query from parent (Index.tsx)
  isLoading?: boolean; // Login button loading state
  isSearchLoading?: boolean; // Search input loading indicator state from parent (Index.tsx)
}

// --- Constants ---
const MAIN_HEADER_MIN_HEIGHT = 60; // Increased for more breathing room
const FEED_TYPE_SWITCHER_HEIGHT = 40; // Slightly taller for better touch targets
const CATEGORY_TABS_HEIGHT = 36; // Slightly taller for better touch targets
const FILTER_BAR_HEIGHT = 44; // Slightly taller for better touch targets


// --- Component Definition ---
const HeaderTabs: React.FC<HeaderTabsProps> = ({
                                                 activeFeedType,
                                                 onFeedTypeChange,
                                                 categories = [],
                                                 activeCategory = '',
                                                 onCategorySelect,
                                                 subcategories = [],
                                                 allUserPreferences = [],
                                                 activeSubcategory = null,
                                                 onSubcategorySelect,
                                                 activeFilter = 'All',
                                                 onContentTypeFilterChange,
                                                 username,
                                                 profilePictureUrl,
                                                 onSettingsPress,
                                                 onLoginPress,
                                                 onSearch, // Used here
                                                 searchQuery, // Used here
                                                 isLoggedIn,
                                                 isLoading = false,
                                                 isSearchLoading = false, // Used here
                                               }) => {
  const { isDarkTheme } = useContext(UserContext);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const searchInputRef = useRef<TextInput>(null);

  // Sync local state with prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const isChronologicalFeedMode = activeFeedType === 'chronological';
  const isForYouFeedMode = activeFeedType === 'forYou';
  const isTrendingFeedMode = activeFeedType === 'trending';

  const searchContainerWidth = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const filterBarAnim = useRef(new Animated.Value(0)).current;

  // Apple Store grade color palette
  const colors = {
    // Base colors
    background: isDarkTheme ? '#000000' : '#FFFFFF',
    text: isDarkTheme ? '#F5F5F7' : '#1D1D1F',
    textSecondary: isDarkTheme ? '#86868B' : '#6E6E73',
    placeholder: isDarkTheme ? '#636366' : '#86868B',

    // Icon colors
    icon: isDarkTheme ? '#86868B' : '#86868B',
    iconActive: isDarkTheme ? '#FFFFFF' : '#000000',

    // Profile elements
    profileBorder: isDarkTheme ? '#2D2D2D' : '#E8E8ED',

    // Feed switcher elements
    feedSwitcherBg: isDarkTheme ? '#1C1C1E' : '#F5F5F7',
    feedSwitcherBorder: 'transparent', // No visible border for cleaner look
    feedSwitcherButtonBg: 'transparent',
    feedSwitcherButtonActiveBg: isDarkTheme ? '#2D2D2D' : '#E8E8ED',
    feedSwitcherButtonText: isDarkTheme ? '#86868B' : '#86868B',
    feedSwitcherButtonActiveText: isDarkTheme ? '#FFFFFF' : '#000000',

    // Category elements
    categoryBg: isDarkTheme ? '#1C1C1E' : '#F5F5F7',
    categoryBorder: 'transparent', // No visible border for cleaner look
    categoryText: isDarkTheme ? '#86868B' : '#86868B',
    categoryActiveBg: isDarkTheme ? '#2D2D2D' : '#E8E8ED',
    categoryActiveBorder: 'transparent', // No visible border for cleaner look
    categoryActiveText: isDarkTheme ? '#FFFFFF' : '#000000',

    // Search elements
    searchBg: isDarkTheme ? '#1C1C1E' : '#F5F5F7',

    // Filter bar elements
    filterBarBackground: isDarkTheme ? '#0D0D0D' : '#FAFAFA',
    filterBarBorder: isDarkTheme ? '#1C1C1E' : '#F5F5F7',
    filterBarButtonBg: isDarkTheme ? '#1C1C1E' : '#F5F5F7',
    filterBarButtonBorder: 'transparent', // No visible border for cleaner look
    filterBarButtonText: isDarkTheme ? '#86868B' : '#86868B',
    filterBarButtonActiveBg: isDarkTheme ? '#2D2D2D' : '#E8E8ED',
    filterBarButtonActiveBorder: 'transparent', // No visible border for cleaner look
    filterBarButtonActiveText: isDarkTheme ? '#FFFFFF' : '#000000',
    filterBarSeparator: isDarkTheme ? '#2D2D2D' : '#E8E8ED',

    // Other elements
    borderColor: isDarkTheme ? '#1C1C1E' : '#F5F5F7',
    accent: isDarkTheme ? '#0071E3' : '#0071E3', // Apple's blue accent color
  };
  const iconSize = 22;
  const profileSize = 30;

  // Generate styles with the current theme, profileSize, and colors
  const styles = getStyles(isDarkTheme, profileSize, colors);

  const relevantSubcategories = subcategories.filter(sub => allUserPreferences.includes(sub));
  const showSubcategoriesInFilterBar = isChronologicalFeedMode && relevantSubcategories.length > 0;

  const animateSearch = (show: boolean) => {
    Animated.parallel([
      Animated.timing(searchContainerWidth, { toValue: show ? 1 : 0, duration: 300, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: show ? 0 : 1, duration: 200, useNativeDriver: true }),
    ]).start(() => { if (show) { searchInputRef.current?.focus(); } else { Keyboard.dismiss(); } });
  };
  const animateFilterBar = (show: boolean) => {
    Animated.timing(filterBarAnim, { toValue: show ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  };
  useEffect(() => { animateFilterBar(showFilterBar); }, [showFilterBar]);
  useEffect(() => { animateSearch(isSearchMode); }, [isSearchMode]);

  // Don't allow search in "For You" mode
  const handleToggleSearch = useCallback(() => {
    if (isForYouFeedMode) {
      return; // Disable search in "For You" mode
    }
    setIsSearchMode(prev => !prev);
  }, [isForYouFeedMode]);
  const handleSearchChange = useCallback((text: string) => {
    setLocalSearchQuery(text);
    onSearch(text);
  }, [onSearch, setLocalSearchQuery]);
  const handleClearSearch = useCallback(() => { 
    setLocalSearchQuery('');
    onSearch(''); 
    searchInputRef.current?.clear(); 
    searchInputRef.current?.focus(); 
  }, [onSearch, setLocalSearchQuery]);
  const handleToggleFilterBar = useCallback(() => { setShowFilterBar(prev => !prev); if (showFilterBar) Keyboard.dismiss(); }, [showFilterBar]);

  const handleSelectFilter = useCallback((filter: string) => {
    if (onContentTypeFilterChange) { onContentTypeFilterChange(filter); }
    else { console.warn('onContentTypeFilterChange is not defined'); }
  }, [onContentTypeFilterChange]);

  const handleSelectSubcategory = useCallback((subcategory: string | string[] | null) => {
    if (onSubcategorySelect) { onSubcategorySelect(subcategory); }
    else { console.warn('onSubcategorySelect is not defined'); }
  }, [onSubcategorySelect]);

  const handleCategoryTabPress = useCallback((category: string) => {
    if (onCategorySelect) { onCategorySelect(category); }
    else { console.warn('onCategorySelect is not defined'); }
  }, [onCategorySelect]);

  const renderProfileIcon = () => (
      <TouchableOpacity 
        onPress={isLoggedIn ? onSettingsPress : onLoginPress} 
        style={styles.profileButton} 
        disabled={isLoading} 
        accessibilityLabel={isLoggedIn ? 'Open Settings' : 'Login'}
      >
        {isLoading ? ( 
          <ActivityIndicator size="small" color={colors.accent} />
        ) : isLoggedIn && profilePictureUrl ? (
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ uri: profilePictureUrl }} 
              style={styles.profileImage} 
              accessibilityLabel="User profile picture" 
            />
          </View>
        ) : (
          <View style={styles.profilePlaceholder}>
            <Icon 
              name={isLoggedIn ? "person" : "log-in-outline"} 
              size={iconSize * 0.8} 
              color={isDarkTheme ? colors.text : colors.accent} 
            />
          </View>
        )}
      </TouchableOpacity>
  );

  const renderFeedTypeSwitcher = () => {
    if (isTrendingFeedMode) {
      return (
          <View style={styles.feedTypeSwitcherContainerNoSwitch}>
            <Text style={[styles.trendingTitle, { color: colors.text }]}>Trending Now</Text>
          </View>
      );
    }

    // Apple-style segmented control
    return (
        <View style={[styles.feedTypeSwitcherContainer, { backgroundColor: colors.feedSwitcherBg }]}>
          <View style={styles.feedTypeSwitcherInner}>
            <TouchableOpacity
                style={[
                  styles.feedTypeButton,
                  isForYouFeedMode && styles.feedTypeButtonActive,
                  { backgroundColor: isForYouFeedMode ? colors.feedSwitcherButtonActiveBg : 'transparent' }
                ]}
                onPress={() => onFeedTypeChange('forYou')}
                accessibilityLabel="Switch to For You feed"
                accessibilityState={{ selected: isForYouFeedMode }}
            >
              <Text style={[
                styles.feedTypeButtonText,
                { color: isForYouFeedMode ? colors.feedSwitcherButtonActiveText : colors.feedSwitcherButtonText },
                isForYouFeedMode && styles.feedTypeButtonTextActive
              ]}>For You</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                  styles.feedTypeButton,
                  isChronologicalFeedMode && styles.feedTypeButtonActive,
                  { backgroundColor: isChronologicalFeedMode ? colors.feedSwitcherButtonActiveBg : 'transparent' }
                ]}
                onPress={() => onFeedTypeChange('chronological')}
                accessibilityLabel="Switch to Latest feed"
                accessibilityState={{ selected: isChronologicalFeedMode }}
            >
              <Text style={[
                styles.feedTypeButtonText,
                { color: isChronologicalFeedMode ? colors.feedSwitcherButtonActiveText : colors.feedSwitcherButtonText },
                isChronologicalFeedMode && styles.feedTypeButtonTextActive
              ]}>Latest</Text>
            </TouchableOpacity>
          </View>
        </View>
    );
  };

  const renderCategoryTabs = () => {
    if (!isChronologicalFeedMode) return null;

    if (!categories || categories.length === 0) {
      return (
          <View style={styles.categoryTabsPlaceholder}>
            <Text style={[styles.categoryPlaceholderText, { color: colors.textSecondary }]}>
              {activeCategory || 'No categories available'}
            </Text>
          </View>
      );
    }

    return (
        <View style={styles.categoryTabsContainer}>
          <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScrollContainer}
              style={styles.categoriesScrollView}
              decelerationRate="fast"
              snapToAlignment="center"
          >
            {categories.map((category) => {
              const isActive = activeCategory === category;
              return (
                  <TouchableOpacity
                      key={category}
                      onPress={() => handleCategoryTabPress(category)}
                      style={[
                        styles.categoryButton,
                        {
                          backgroundColor: isActive ? colors.categoryActiveBg : colors.categoryBg,
                        }
                      ]}
                      accessibilityLabel={`Select category ${category}`}
                      accessibilityState={{ selected: isActive }}
                  >
                    <Text
                        style={[
                          styles.categoryText,
                          { color: isActive ? colors.categoryActiveText : colors.categoryText },
                          isActive && styles.categoryTextActive,
                        ]}
                        numberOfLines={1}
                    >
                      {category}
                    </Text>
                    {isActive && <View style={styles.categoryActiveIndicator} />}
                  </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
    );
  };

  const renderFilterBar = () => {
    const filterOptions = ['All', 'Tweets', 'Articles', 'BlueSky'];
    const animatedFilterBarStyle = {
      height: filterBarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FILTER_BAR_HEIGHT] }),
      opacity: filterBarAnim,
      borderTopWidth: showFilterBar ? StyleSheet.hairlineWidth : 0,
      borderBottomWidth: showFilterBar ? StyleSheet.hairlineWidth : 0,
    };

    const hasValidSubcategoriesForDisplay = Array.isArray(relevantSubcategories) && relevantSubcategories.length > 0;
    const isAllSubcategoriesActive = (Array.isArray(activeSubcategory) && activeSubcategory.length > 0) ||
        (activeSubcategory === null && hasValidSubcategoriesForDisplay);

    return (
        <Animated.View
            style={[
              styles.filterBarContainer,
              animatedFilterBarStyle,
              {
                backgroundColor: colors.filterBarBackground,
                borderTopColor: colors.filterBarBorder,
                borderBottomColor: colors.filterBarBorder
              }
            ]}
        >
          <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBarScrollViewContent}
              style={styles.filterBarScrollView}
              keyboardShouldPersistTaps="handled"
          >
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>
                Content Type
              </Text>
              <View style={styles.filterButtonsRow}>
                {filterOptions.map((option) => {
                  const isFilterActive = activeFilter === option;
                  return (
                      <TouchableOpacity
                          key={`filter-${option}`}
                          onPress={() => handleSelectFilter(option)}
                          style={[
                            styles.filterBarButton,
                            {
                              backgroundColor: isFilterActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg,
                              borderColor: isFilterActive ? colors.filterBarButtonActiveBorder : colors.filterBarButtonBorder,
                            }
                          ]}
                          accessibilityLabel={`Filter by ${option}`}
                          accessibilityState={{ selected: isFilterActive }}
                      >
                        <Text
                            style={[
                              styles.filterBarButtonText,
                              { color: isFilterActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText },
                              isFilterActive && styles.filterBarButtonTextActive,
                            ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {showSubcategoriesInFilterBar && hasValidSubcategoriesForDisplay && (
                <View style={[styles.filterBarSeparator, { backgroundColor: colors.filterBarSeparator }]} />
            )}

            {showSubcategoriesInFilterBar && hasValidSubcategoriesForDisplay && (
                <View style={styles.filterSection}>
                  <Text style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>
                    {activeCategory || 'Category'} Topics
                  </Text>
                  <View style={styles.filterButtonsRow}>
                    <TouchableOpacity
                        key="all-subcategories"
                        onPress={() => handleSelectSubcategory(relevantSubcategories.length > 0 ? relevantSubcategories : null)}
                        style={[
                          styles.filterBarButton,
                          {
                            backgroundColor: isAllSubcategoriesActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg,
                            borderColor: isAllSubcategoriesActive ? colors.filterBarButtonActiveBorder : colors.filterBarButtonBorder,
                          }
                        ]}
                        accessibilityLabel={`Show all ${activeCategory || 'category'} topics`}
                        accessibilityState={{ selected: isAllSubcategoriesActive }}
                    >
                      <Text
                          style={[
                            styles.filterBarButtonText,
                            { color: isAllSubcategoriesActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText },
                            isAllSubcategoriesActive && styles.filterBarButtonTextActive,
                          ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>

                    {relevantSubcategories.map((subcategory) => {
                      const isSubActive = typeof activeSubcategory === 'string' && activeSubcategory === subcategory;
                      const formattedSubcategory = subcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      return (
                          <TouchableOpacity
                              key={subcategory}
                              onPress={() => handleSelectSubcategory(subcategory)}
                              style={[
                                styles.filterBarButton,
                                {
                                  backgroundColor: isSubActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg,
                                  borderColor: isSubActive ? colors.filterBarButtonActiveBorder : colors.filterBarButtonBorder,
                                }
                              ]}
                              accessibilityLabel={`Filter by ${formattedSubcategory}`}
                              accessibilityState={{ selected: isSubActive }}
                          >
                            <Text
                                style={[
                                  styles.filterBarButtonText,
                                  { color: isSubActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText },
                                  isSubActive && styles.filterBarButtonTextActive,
                                ]}
                            >
                              {formattedSubcategory}
                            </Text>
                          </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
            )}
          </ScrollView>
        </Animated.View>
    );
  };

  const animatedSearchInputWrapperStyle = { opacity: searchContainerWidth };
  const normalHeaderStyle = { opacity: opacityAnim };
  const animatedSearchContainerStyle = { width: searchContainerWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), opacity: searchContainerWidth.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) };
  const isFilterApplied = activeFilter !== 'All' || (typeof activeSubcategory === 'string');

  return (
      <View style={[styles.headerBackground, { backgroundColor: colors.background }]}>
        {/* Row 1: Profile, Feed Switcher/Title, Icons */}
        <View style={[styles.mainHeaderContainer]}>
          <Animated.View style={[styles.normalHeaderContent, normalHeaderStyle, { zIndex: isSearchMode ? 5 : 10 }]}>
            {renderProfileIcon()}
            {renderFeedTypeSwitcher()}
            <View style={styles.rightIconsContainer}>
              {isChronologicalFeedMode && ( // Filter icon only for chronological
                  <TouchableOpacity onPress={handleToggleFilterBar} style={styles.iconButton} accessibilityLabel="Filter content">
                    <Icon name="filter-outline" size={iconSize} color={colors.icon} />
                    {isFilterApplied && <View style={[styles.filterActiveIndicator, { backgroundColor: colors.accent }]}/>}
                  </TouchableOpacity>
              )}
              {/* Search icon only visible in chronological mode */}
              {!isForYouFeedMode && (
                <TouchableOpacity onPress={handleToggleSearch} style={styles.iconButton} accessibilityLabel="Search content">
                  <Icon name="search-outline" size={iconSize} color={colors.icon} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Search Overlay - covers Row 1 when active */}
          <Animated.View
              style={[styles.searchOverlayContainer, animatedSearchContainerStyle, { backgroundColor: colors.background }]}
              pointerEvents={isSearchMode ? 'auto' : 'none'}
          >
            <TouchableOpacity onPress={handleToggleSearch} style={styles.searchBackButton} accessibilityLabel="Close search">
              <Icon name="arrow-back-outline" size={iconSize} color={colors.icon} />
            </TouchableOpacity>
            <Animated.View style={[styles.searchInputWrapper, { backgroundColor: colors.searchBg }, animatedSearchInputWrapperStyle]}>
              <Icon name="search-outline" size={iconSize * 0.75} color={colors.placeholder} style={styles.searchIcon}/>
              <TextInput
                  ref={searchInputRef}
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search feed..."
                  placeholderTextColor={colors.placeholder}
                  value={localSearchQuery} // Use local state
                  onChangeText={handleSearchChange} // Calls props.onSearch
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    // Optionally, you could trigger a search explicitly here if needed,
                    // but typically onChangeText is sufficient for live updates
                    // or Index.tsx handles search on query change.
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
              />
              {isSearchLoading ? ( // From props
                  <ActivityIndicator size="small" color={colors.accent} style={styles.searchLoadingIndicator} />
              ) : localSearchQuery.length > 0 ? (
                  <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchButton}>
                    <Icon name="close-circle" size={iconSize * 0.75} color={colors.placeholder} />
                  </TouchableOpacity>
              ) : null }
            </Animated.View>
          </Animated.View>
        </View>

        {/* Row 2: Category Tabs (only if chronological and not searching) */}
        {!isSearchMode && isChronologicalFeedMode && renderCategoryTabs()}

        {/* Row 3: Filter Bar (only if chronological, not searching, and filter toggled) */}
        {!isSearchMode && isChronologicalFeedMode && renderFilterBar()}
      </View>
  );
};

// Styles
const getStyles = (isDarkTheme: boolean, profileSize: number, colors: any) => StyleSheet.create({
  headerBackground: {
    zIndex: 11,
  },
  mainHeaderContainer: {
    paddingTop: Platform.OS === 'android' ? 8 : 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MAIN_HEADER_MIN_HEIGHT,
    position: 'relative',
  },
  normalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  profileButton: {
    padding: 6,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  profileImageContainer: {
    width: profileSize + 4,
    height: profileSize + 4,
    borderRadius: (profileSize + 4) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    shadowColor: isDarkTheme ? '#000' : '#999',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  profileImage: {
    width: profileSize,
    height: profileSize,
    borderRadius: profileSize / 2,
  },
  profilePlaceholder: {
    width: profileSize + 4,
    height: profileSize + 4,
    borderRadius: (profileSize + 4) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkTheme ? '#2D2D2D' : '#F5F5F7',
    shadowColor: isDarkTheme ? '#000' : '#999',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  feedTypeSwitcherContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    paddingVertical: 4,
  },
  feedTypeSwitcherInner: {
    flexDirection: 'row',
    backgroundColor: colors.feedSwitcherBg,
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 280, // Limit width for better aesthetics
    height: FEED_TYPE_SWITCHER_HEIGHT,
    shadowColor: isDarkTheme ? '#000' : '#999',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feedTypeSwitcherContainerNoSwitch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  feedTypeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    borderRadius: 8,
    margin: 2,
  },
  feedTypeButtonActive: {
    shadowColor: isDarkTheme ? '#000' : '#999',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  feedTypeButtonText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  feedTypeButtonTextActive: {
    fontWeight: '600',
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryTabsContainer: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderColor,
    backgroundColor: colors.background,
  },
  categoriesScrollView: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    height: CATEGORY_TABS_HEIGHT + 16, // Fixed height for the row with more padding
  },
  categoriesScrollContainer: {
    alignItems: 'center',
    paddingRight: 12, // Ensure last item is visible
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18, // More rounded for Apple-like pill shape
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: CATEGORY_TABS_HEIGHT,
    position: 'relative', // For the active indicator
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  categoryTextActive: {
    fontWeight: '600',
  },
  categoryActiveIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginLeft: -2, // Center the dot
  },
  categoryTabsPlaceholder: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    height: CATEGORY_TABS_HEIGHT + 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderColor,
  },
  categoryPlaceholderText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
    // color set dynamically
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  iconButton: {
    padding: 6,
    marginLeft: 6,
    position: 'relative',
  },
  filterActiveIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  searchOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: (MAIN_HEADER_MIN_HEIGHT - 40) / 2, // Adjusted for taller search input
    zIndex: 15,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  searchBackButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20, // More rounded for Apple-like appearance
    paddingHorizontal: 12,
    height: 40, // Taller for better touch target
    backgroundColor: colors.searchBg,
    shadowColor: isDarkTheme ? '#000' : '#999',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16, // Larger font size for better readability
    fontWeight: '400',
    height: '100%',
    paddingVertical: 0,
    color: colors.text,
  },
  clearSearchButton: {
    padding: 6,
    marginLeft: 6,
  },
  searchLoadingIndicator: {
    padding: 6,
    marginLeft: 6,
  },
  filterBarContainer: {
    // height is animated
    overflow: 'hidden',
    zIndex: 10, // Ensure it's below main header but above content list
    width: '100%',
    backgroundColor: colors.filterBarBackground,
    // borderTopWidth might be applied by animation
  },
  filterBarScrollView: {
    flex: 1,
  },
  filterBarScrollViewContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterBarButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18, // More rounded for Apple-like pill shape
    marginHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    height: 34,
    backgroundColor: colors.filterBarButtonBg,
    shadowColor: isDarkTheme ? '#000' : '#999',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  filterBarButtonText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  filterBarButtonTextActive: {
    fontWeight: '600',
  },
  filterBarSeparator: {
    width: 1,
    height: '70%',
    marginHorizontal: 12,
    backgroundColor: colors.filterBarSeparator,
    opacity: 0.6,
  },
  filterSection: {
    paddingHorizontal: 6,
    marginVertical: 4,
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 6,
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
});

export default React.memo(HeaderTabs);
