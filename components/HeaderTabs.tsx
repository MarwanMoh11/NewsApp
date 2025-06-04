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
import { UserContext } from '@/app/UserContext'; // Adjust path if needed
export type ContentTypeFilterValue = "All" | "Tweets" | "Articles" | "BlueSky";

// --- Define the props interface ---
export interface HeaderTabsProps {
  activeFeedType: 'forYou' | 'chronological' | 'trending';
  onFeedTypeChange: (feedType: 'forYou' | 'chronological') => void;

  categories?: string[];
  activeCategory?: string;
  onCategorySelect?: (category: string) => void;

  subcategories?: string[];
  allUserPreferences?: string[];
  activeSubcategory?: string | string[] | null;
  onSubcategorySelect?: (subcategory: string | string[] | null) => void;

  activeFilter?: string;
  onContentTypeFilterChange?: (filter: ContentTypeFilterValue) => void;

  username?: string | null;
  profilePictureUrl?: string | null;
  onSettingsPress: () => void;
  onLoginPress: () => void;
  onSearch: (query: string) => void;
  isLoggedIn: boolean;
  searchQuery: string;
  isLoading?: boolean;
  isSearchLoading?: boolean;
  scrollY?: Animated.Value; // New prop for scroll-based animations
}

// --- Minimalist Constants ---
const MAIN_HEADER_ROW_HEIGHT = 52;        // Height of the main top row
const FEED_TYPE_SWITCHER_H = 36;          // Height of the feed type switcher itself (increased from 32)
const CATEGORY_TABS_ROW_H = 42; // Was 38, increased by 4
const CATEGORY_TAB_H = 32;      // Was 28, increased by 4
const FILTER_BAR_ROW_H = 44;    // Was 40, increased by 4
const FILTER_BUTTON_H = 34;     // Was 30, increased by 4
const ICON_SIZE = 19;                     // Standard icon size
const PROFILE_PIC_SIZE = 28;              // Profile picture diameter
const SEARCH_INPUT_H = 34;                // Height of the search input field

// Scroll animation thresholds
const SCROLL_ANIM_START = 0;              // Scroll position where animation starts
const SCROLL_ANIM_END = 60;               // Scroll position where elements are fully hidden/collapsed
const SCROLL_OPACITY_ANIM_END = SCROLL_ANIM_END / 2; // Scroll position for full opacity change

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
onSearch,
searchQuery,
isLoggedIn,
isLoading = false,
isSearchLoading = false,
scrollY, // Destructure the new prop
}) => {
  const { isDarkTheme } = useContext(UserContext);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showFilterBar, setShowFilterBar] = useState(false); // For toggling filter bar visibility
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const searchInputRef = useRef<TextInput>(null);

  // Use provided scrollY or a default static one if not provided (scroll animations won't run without parent passing it)
  const internalScrollY = useRef(scrollY || new Animated.Value(0)).current;

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const isChronologicalFeedMode = activeFeedType === 'chronological';
  const isForYouFeedMode = activeFeedType === 'forYou';
  const isTrendingFeedMode = activeFeedType === 'trending';

  // Animation values
  const searchContainerWidth = useRef(new Animated.Value(0)).current; // For search bar expansion
  const mainHeaderContentOpacity = useRef(new Animated.Value(1)).current; // For hiding main content during search
  const filterBarToggleAnim = useRef(new Animated.Value(0)).current; // For filter bar open/close animation (height)

  // Minimalist Color Palette
  const colors = {
    background: isDarkTheme ? '#0A0A0A' : '#F9F9F9',
    text: isDarkTheme ? '#E0E0E0' : '#2C2C2E',
    textSecondary: isDarkTheme ? '#7D7D80' : '#8A8A8E',
    placeholder: isDarkTheme ? '#5A5A5E' : '#A0A0A5',
    icon: isDarkTheme ? '#8A8A8E' : '#8A8A8E',
    iconActive: isDarkTheme ? '#FFFFFF' : '#000000',
    profileBorder: isDarkTheme ? '#2C2C2E' : '#E5E5EA',
    feedSwitcherBg: isDarkTheme ? '#1C1C1E' : '#EFEFF4',
    feedSwitcherButtonActiveBg: isDarkTheme ? '#2C2C2E' : '#FFFFFF',
    feedSwitcherButtonText: isDarkTheme ? '#A0A0A5' : '#8A8A8E',
    feedSwitcherButtonActiveText: isDarkTheme ? '#FFFFFF' : '#000000',
    categoryBg: 'transparent',
    categoryText: isDarkTheme ? '#A0A0A5' : '#8A8A8E',
    categoryActiveBg: 'transparent',
    categoryActiveText: isDarkTheme ? '#E0E0E0' : '#2C2C2E',
    searchBg: isDarkTheme ? '#1C1C1E' : '#EFEFF4',
    filterBarBackground: isDarkTheme ? '#101010' : '#F2F2F7',
    filterBarBorder: isDarkTheme ? '#252528' : '#E5E5EA',
    filterBarButtonBg: isDarkTheme ? '#232325' : '#E9E9EF',
    filterBarButtonActiveBg: isDarkTheme ? '#333336' : '#FFFFFF',
    filterBarButtonText: isDarkTheme ? '#A0A0A5' : '#8A8A8E',
    filterBarButtonActiveText: isDarkTheme ? '#FFFFFF' : '#000000',
    filterBarSeparator: isDarkTheme ? '#3A3A3C' : '#D1D1D6',
    borderColor: isDarkTheme ? '#2A2A2C' : '#E5E5EA', // For header bottom border
    accent: isDarkTheme ? '#0A84FF' : '#007AFF', // Apple's system blue
  };

  // Generate styles with the current theme, sizes, and colors
  const styles = getMinimalStyles(isDarkTheme, PROFILE_PIC_SIZE, colors);

  const relevantSubcategories = subcategories.filter(sub => allUserPreferences.includes(sub));
  const showSubcategoriesInFilterBar = isChronologicalFeedMode && relevantSubcategories.length > 0;

  // --- Animations ---
  const animateSearch = useCallback((show: boolean) => {
    Animated.parallel([
      Animated.timing(searchContainerWidth, { toValue: show ? 1 : 0, duration: 250, useNativeDriver: false }),
      Animated.timing(mainHeaderContentOpacity, { toValue: show ? 0 : 1, duration: 200, useNativeDriver: true }),
    ]).start(() => { if (show) searchInputRef.current?.focus(); else Keyboard.dismiss(); });
  }, [searchContainerWidth, mainHeaderContentOpacity]);

  const animateFilterBarToggle = useCallback((show: boolean) => {
    Animated.timing(filterBarToggleAnim, { toValue: show ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  }, [filterBarToggleAnim]);

  useEffect(() => { animateFilterBarToggle(showFilterBar); }, [showFilterBar, animateFilterBarToggle]);
  useEffect(() => { animateSearch(isSearchMode); }, [isSearchMode, animateSearch]);

  // --- Handlers ---
  const handleToggleSearch = useCallback(() => {
    if (isForYouFeedMode) return; // Search disabled in "For You" mode
    setIsSearchMode(prev => !prev);
  }, [isForYouFeedMode]);

  const handleSearchChange = useCallback((text: string) => {
    setLocalSearchQuery(text); onSearch(text);
  }, [onSearch]);

  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery(''); onSearch('');
    searchInputRef.current?.clear(); searchInputRef.current?.focus();
  }, [onSearch]);

  const handleToggleFilterBar = useCallback(() => {
    setShowFilterBar(prev => !prev);
    if (showFilterBar) Keyboard.dismiss(); // Dismiss keyboard if filter bar was open and is now closing
  }, [showFilterBar]);

  const handleSelectFilter = useCallback((filter: ContentTypeFilterValue) => {
    onContentTypeFilterChange?.(filter);
  }, [onContentTypeFilterChange]);

  const handleSelectSubcategory = useCallback((subcategory: string | string[] | null) => {
    onSubcategorySelect?.(subcategory);
  }, [onSubcategorySelect]);

  const handleCategoryTabPress = useCallback((category: string) => {
    onCategorySelect?.(category);
  }, [onCategorySelect]);

  // --- Animated Styles for Scroll-Away Effect ---
  const categoryRowAnimatedStyle = {
    height: internalScrollY.interpolate({
      inputRange: [SCROLL_ANIM_START, SCROLL_ANIM_END],
      outputRange: [CATEGORY_TABS_ROW_H, 0], // Collapse from full height to 0
      extrapolate: 'clamp',
    }),
    opacity: internalScrollY.interpolate({
      inputRange: [SCROLL_ANIM_START, SCROLL_OPACITY_ANIM_END],
      outputRange: [1, 0], // Fade out
      extrapolate: 'clamp',
    }),
    overflow: 'hidden' as 'hidden', // FIXED: Explicitly assert type 'hidden'
  };

  const filterBarFullRowAnimatedStyle = {
    height: internalScrollY.interpolate({
      inputRange: [SCROLL_ANIM_START, SCROLL_ANIM_END],
      outputRange: [FILTER_BAR_ROW_H, 0], // Collapse from full height to 0
      extrapolate: 'clamp',
    }),
    opacity: internalScrollY.interpolate({
      inputRange: [SCROLL_ANIM_START, SCROLL_OPACITY_ANIM_END],
      outputRange: [1, 0], // Fade out
      extrapolate: 'clamp',
    }),
    overflow: 'hidden' as 'hidden', // FIXED: Explicitly assert type 'hidden'
  };

  // --- Render Functions for Sub-Components ---
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
              <Image source={{ uri: profilePictureUrl }} style={styles.profileImage} accessibilityLabel="User profile picture" />
            </View>
        ) : (
            <View style={styles.profilePlaceholder}>
              <Icon name={isLoggedIn ? "person-circle-outline" : "log-in-outline"} size={ICON_SIZE * 1.1} color={isDarkTheme ? colors.text : colors.accent} />
            </View>
        )}
      </TouchableOpacity>
  );

  const renderFeedTypeSwitcher = () => {
    if (isTrendingFeedMode) {
      return (
          <View style={styles.feedTypeSwitcherContainerNoSwitch}>
            <Text style={[styles.trendingTitle, { color: colors.text }]}>Trending</Text>
          </View>
      );
    }
    return (
        <View style={styles.feedTypeSwitcherContainer}>
          <View style={styles.feedTypeSwitcherInner}>
            {(['forYou', 'chronological'] as const).map(feed => {
              const isActive = activeFeedType === feed;
              return (
                  <TouchableOpacity
                      key={feed}
                      style={[
                        styles.feedTypeButton,
                        isActive && styles.feedTypeButtonActive,
                        { backgroundColor: isActive ? colors.feedSwitcherButtonActiveBg : 'transparent' }
                      ]}
                      onPress={() => onFeedTypeChange(feed)}
                      accessibilityLabel={`Switch to ${feed === 'forYou' ? 'For You' : 'Latest'} feed`}
                      accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[
                      styles.feedTypeButtonText,
                      { color: isActive ? colors.feedSwitcherButtonActiveText : colors.feedSwitcherButtonText },
                      isActive && styles.feedTypeButtonTextActive
                    ]}>{feed === 'forYou' ? 'For You' : 'Latest'}</Text>
                  </TouchableOpacity>
              );
            })}
          </View>
        </View>
    );
  };

  const renderCategoryTabs = () => {
    // This component is rendered inside an Animated.View that controls its height (categoryRowAnimatedStyle)
    // So, its internal height should fill the animated parent.
    if (!categories || categories.length === 0) {
      return (
          <View style={[styles.categoryTabsPlaceholder, {height: '100%'}]}>
            <Text style={[styles.categoryPlaceholderText, { color: colors.textSecondary }]}>
              {activeCategory || 'No categories'}
            </Text>
          </View>
      );
    }

    return (
        <View style={[styles.categoryTabsContainer, { backgroundColor: colors.background }]}>
          <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScrollContainer}
              style={styles.categoriesScrollView} // Takes full height of its container
              decelerationRate="fast"
          >
            {categories.map((category) => {
              const isActive = activeCategory === category;
              return (
                  <TouchableOpacity
                      key={category}
                      onPress={() => handleCategoryTabPress(category)}
                      style={[
                        styles.categoryButton,
                        { backgroundColor: isActive ? colors.categoryActiveBg : colors.categoryBg }
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
                    {isActive && <View style={[styles.categoryActiveIndicator, {backgroundColor: colors.accent}]} />}
                  </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
    );
  };

  const renderFilterBar = () => {
    // This component is rendered inside an Animated.View that controls the entire row's height (filterBarFullRowAnimatedStyle)
    // The content itself is animated by filterBarToggleAnim for its own open/close effect.
    const filterOptions: ContentTypeFilterValue[] = ["All", "Tweets", "Articles", "BlueSky"];
    const animatedFilterBarContentStyle = {
      height: filterBarToggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FILTER_BAR_ROW_H] }), // Animates from 0 to full filter bar height
      opacity: filterBarToggleAnim, // Fade in/out with height
    };

    const hasValidSubcategoriesForDisplay = Array.isArray(relevantSubcategories) && relevantSubcategories.length > 0;
    const isAllSubcategoriesActive = (Array.isArray(activeSubcategory) && activeSubcategory.length > 0 && activeSubcategory.length === relevantSubcategories.length) ||
        (activeSubcategory === null && hasValidSubcategoriesForDisplay);

    return (
        <Animated.View // This view is animated by filterBarToggleAnim (open/close of filter content)
            style={[
              styles.filterBarContainer, // Basic styling for the filter bar content area
              animatedFilterBarContentStyle, // Applies height and opacity animation for toggle
              {
                backgroundColor: colors.filterBarBackground,
                borderTopColor: colors.filterBarBorder,
                // borderBottomColor: colors.filterBarBorder, // Bottom border might be part of headerBackground
              }
            ]}
        >
          <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBarScrollViewContent}
              style={styles.filterBarScrollView} // Takes full height of its container
              keyboardShouldPersistTaps="handled"
          >
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>Type</Text>
              <View style={styles.filterButtonsRow}>
                {filterOptions.map((option) => {
                  const isFilterActive = activeFilter === option;
                  return (
                      <TouchableOpacity
                          key={`filter-${option}`}
                          onPress={() => handleSelectFilter(option)}
                          style={[
                            styles.filterBarButton,
                            { backgroundColor: isFilterActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg }
                          ]}
                          accessibilityLabel={`Filter by ${option}`}
                          accessibilityState={{ selected: isFilterActive }}
                      >
                        <Text style={[
                          styles.filterBarButtonText,
                          { color: isFilterActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText },
                          isFilterActive && styles.filterBarButtonTextActive
                        ]}>{option}</Text>
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
                    {activeCategory || 'Topics'}
                  </Text>
                  <View style={styles.filterButtonsRow}>
                    <TouchableOpacity
                        key="all-subcategories"
                        onPress={() => handleSelectSubcategory(relevantSubcategories.length > 0 ? relevantSubcategories : null)}
                        style={[
                          styles.filterBarButton,
                          { backgroundColor: isAllSubcategoriesActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg }
                        ]}
                        accessibilityLabel={`Show all ${activeCategory || 'category'} topics`}
                        accessibilityState={{ selected: isAllSubcategoriesActive }}
                    >
                      <Text style={[
                        styles.filterBarButtonText,
                        { color: isAllSubcategoriesActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText },
                        isAllSubcategoriesActive && styles.filterBarButtonTextActive
                      ]}>All</Text>
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
                                { backgroundColor: isSubActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg }
                              ]}
                              accessibilityLabel={`Filter by ${formattedSubcategory}`}
                              accessibilityState={{ selected: isSubActive }}
                          >
                            <Text style={[
                              styles.filterBarButtonText,
                              { color: isSubActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText },
                              isSubActive && styles.filterBarButtonTextActive
                            ]}>{formattedSubcategory}</Text>
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

  // --- Dynamic Styles for Animation States ---
  const animatedSearchInputWrapperStyle = { opacity: searchContainerWidth }; // For search input field itself
  const normalHeaderContentStyle = { opacity: mainHeaderContentOpacity }; // For fading out non-search UI
  const animatedSearchContainerStyle = { // For the entire search overlay container
    width: searchContainerWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    opacity: searchContainerWidth.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }), // Delayed opacity
  };
  const isFilterApplied = activeFilter !== 'All' || (typeof activeSubcategory === 'string');

  // --- Main Component Render ---
  return (
      <View style={[styles.headerBackground, { backgroundColor: colors.background }]}>
        {/* Row 1: Main Header (Profile, Feed Switcher/Title, Icons) - Always Visible */}
        <View style={styles.mainHeaderRow}>
          <Animated.View style={[styles.mainHeaderContent, normalHeaderContentStyle, { zIndex: isSearchMode ? 1 : 10 }]}>
            {renderProfileIcon()}
            {renderFeedTypeSwitcher()}
            <View style={styles.rightIconsContainer}>
              {isChronologicalFeedMode && ( // Filter icon only for chronological
                  <TouchableOpacity onPress={handleToggleFilterBar} style={styles.iconButton} accessibilityLabel="Filter content">
                    <Icon name={showFilterBar ? "funnel" : "funnel-outline"} size={ICON_SIZE} color={colors.icon} />
                    {/* Show dot if filters applied AND filter bar is currently closed */}
                    {isFilterApplied && !showFilterBar && <View style={[styles.filterActiveDot, { backgroundColor: colors.accent }]} />}
                  </TouchableOpacity>
              )}
              {!isForYouFeedMode && ( // Search icon not available in "For You"
                  <TouchableOpacity onPress={handleToggleSearch} style={styles.iconButton} accessibilityLabel="Search content">
                    <Icon name="search-outline" size={ICON_SIZE} color={colors.icon} />
                  </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Search Overlay - Covers Row 1 when active */}
          <Animated.View
              style={[styles.searchOverlayContainer, animatedSearchContainerStyle, { backgroundColor: colors.background }]}
              pointerEvents={isSearchMode ? 'auto' : 'none'}
          >
            <TouchableOpacity onPress={handleToggleSearch} style={styles.searchBackButton} accessibilityLabel="Close search">
              <Icon name="arrow-back-outline" size={ICON_SIZE} color={colors.icon} />
            </TouchableOpacity>
            <Animated.View style={[styles.searchInputWrapper, { backgroundColor: colors.searchBg }, animatedSearchInputWrapperStyle]}>
              <Icon name="search-outline" size={ICON_SIZE * 0.8} color={colors.placeholder} style={styles.searchIconInInput} />
              <TextInput
                  ref={searchInputRef}
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search..." // More concise placeholder
                  placeholderTextColor={colors.placeholder}
                  value={localSearchQuery}
                  onChangeText={handleSearchChange}
                  returnKeyType="search"
                  onSubmitEditing={Keyboard.dismiss} // Dismiss keyboard on submit
                  autoCorrect={false}
                  autoCapitalize="none"
              />
              {isSearchLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} style={styles.searchActivityIndicator} />
              ) : localSearchQuery.length > 0 ? (
                  <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchButton}>
                    <Icon name="close-circle" size={ICON_SIZE * 0.8} color={colors.placeholder} />
                  </TouchableOpacity>
              ) : null}
            </Animated.View>
          </Animated.View>
        </View>

        {/* Row 2: Category Tabs (Animated by scrollY for fade/collapse) */}
        {/* Render if in chronological, not searching, AND (categories exist OR an active one is named for placeholder) */}
        {isChronologicalFeedMode && !isSearchMode && (categories.length > 0 || activeCategory) && (
            <Animated.View style={categoryRowAnimatedStyle}>
              {renderCategoryTabs()}
            </Animated.View>
        )}

        {/* Row 3: Filter Bar (Animated by scrollY, content animated by filterBarToggleAnim) */}
        {/* Render if in chronological, not searching, AND filter bar is toggled to be shown */}
        {isChronologicalFeedMode && !isSearchMode && showFilterBar && (
            <Animated.View style={filterBarFullRowAnimatedStyle}>
              {renderFilterBar()}
            </Animated.View>
        )}
      </View>
  );
};

// --- Minimalist Styles Definition ---
const getMinimalStyles = (isDarkTheme: boolean, profileSize: number, colors: any) => StyleSheet.create({
  headerBackground: {
    zIndex: 100, // Ensure header is on top of other content
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderColor,
    // backgroundColor set dynamically
  },
  mainHeaderRow: {
    paddingTop: Platform.OS === 'android' ? 4 : 4, // Minimal top padding for status bar
    paddingBottom: 4,
    paddingHorizontal: 10, // Consistent horizontal padding
    flexDirection: 'row',
    alignItems: 'center',
    height: MAIN_HEADER_ROW_HEIGHT,
    position: 'relative', // For search overlay positioning
  },
  mainHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  profileButton: {
    padding: 4, // Reduced padding for tighter fit
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageContainer: {
    width: profileSize,
    height: profileSize,
    borderRadius: profileSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background, // Match header bg
    borderWidth: 1,
    borderColor: colors.profileBorder,
  },
  profileImage: {
    width: profileSize - 4, // Image slightly smaller than container to show border
    height: profileSize - 4,
    borderRadius: (profileSize - 4) / 2,
  },
  profilePlaceholder: {
    width: profileSize,
    height: profileSize,
    borderRadius: profileSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.feedSwitcherBg, // Use a common subtle bg for consistency
  },
  feedTypeSwitcherContainer: {
    flex: 1, // Take available space in the middle
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8, // Increased spacing from profile/icons
    maxWidth: '100%', // Increased from 70% to fill more horizontal space
  },
  feedTypeSwitcherInner: {
    flexDirection: 'row',
    backgroundColor: colors.feedSwitcherBg,
    borderRadius: 8, // Slightly smaller radius for a sleeker look
    overflow: 'hidden',
    height: FEED_TYPE_SWITCHER_H,
    padding: 2, // Padding inside to make buttons appear separate from border
    width: '100%', // Ensure it takes full width of the container
  },
  feedTypeSwitcherContainerNoSwitch: { // For "Trending" title
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  feedTypeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    borderRadius: 6, // Smaller radius for inner buttons
    paddingHorizontal: 16, // Increased horizontal padding for better text spacing
    minWidth: 70, // Ensure minimum width for each button
  },
  feedTypeButtonActive: {
    // Active style primarily from backgroundColor prop in component
    shadowColor: '#000', // Subtle shadow for depth
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDarkTheme ? 0.2 : 0.05,
    shadowRadius: 1,
    elevation: 2,
  },
  feedTypeButtonText: {
    fontSize: 14, // Slightly increased font size for better readability
    fontWeight: '500',
    letterSpacing: 0.2, // Add slight letter spacing to prevent cramping
  },
  feedTypeButtonTextActive: {
    fontWeight: '600', // Slightly bolder for active state
  },
  trendingTitle: {
    fontSize: 15, // Reduced from original
    fontWeight: '600',
  },
  // Category Tabs Styles
  categoryTabsContainer: { // This is the content part of the animated row
    width: '100%',
    height: '100%', // Takes height from animated wrapper (categoryRowAnimatedStyle)
    justifyContent: 'center', // Vertically center the ScrollView
  },
  categoriesScrollView: {
    width: '100%',
    height: '100%', // ScrollView takes full height of its container
  },
  categoriesScrollContainer: {
    alignItems: 'center', // Align tabs to the center of their allocated space in ScrollView
    paddingHorizontal: 10, // Match main header horizontal padding
    // Vertical padding to center tabs within the CATEGORY_TABS_ROW_H
    paddingVertical: (CATEGORY_TABS_ROW_H - CATEGORY_TAB_H) / 2,
  },
  categoryButton: {
    paddingHorizontal: 12, // Reduced horizontal padding
    marginHorizontal: 4,   // Reduced horizontal margin
    height: CATEGORY_TAB_H,
    borderRadius: 14,      // Pill shape (half of height for perfect rounding)
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', // For the active indicator dot
  },
  categoryText: {
    fontSize: 12.5, // Reduced font size for compactness
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  categoryTextActive: {
    fontWeight: '600', // Bolder for active category
  },
  categoryActiveIndicator: { // Small dot indicator for active category
    position: 'absolute',
    bottom: 3, // Positioned closer to the text
    width: 4, height: 4, borderRadius: 2,
    // backgroundColor set by props
  },
  categoryTabsPlaceholder: {
    paddingHorizontal: 10,
    width: '100%',
    justifyContent: 'center', // Center placeholder text
    alignItems: 'center',
    // height is 100% of its animated container
  },
  categoryPlaceholderText: {
    fontSize: 12.5,
    fontWeight: '500',
    // color set by props
  },
  // Right Icons (Filter, Search)
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6, // Standard small padding for icon buttons
    marginLeft: 4, // Reduced margin between icons
    position: 'relative', // For filter active dot
  },
  filterActiveDot: { // Dot indicator if filters are applied
    position: 'absolute',
    top: 5, right: 5,
    width: 5, height: 5, borderRadius: 2.5,
    // backgroundColor set by props
  },
  // Search Overlay Styles
  searchOverlayContainer: {
    position: 'absolute', // Overlay behavior
    top: 0, left: 0, bottom: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, // Consistent padding
    // Vertical padding to center search input within MAIN_HEADER_ROW_HEIGHT
    paddingVertical: (MAIN_HEADER_ROW_HEIGHT - SEARCH_INPUT_H) / 2,
    zIndex: 5, // Ensure it's above mainHeaderContent when active
    // backgroundColor set by props
  },
  searchBackButton: {
    padding: 6,
    marginRight: 6, // Space between back button and input field
  },
  searchInputWrapper: {
    flex: 1, // Take remaining width
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17, // Half of SEARCH_INPUT_H for pill shape
    paddingHorizontal: 10,
    height: SEARCH_INPUT_H,
    // backgroundColor set by props
  },
  searchIconInInput: { // Icon inside the search bar
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14, // Reduced font size for search input
    height: '100%', // Fill wrapper height
    paddingVertical: 0, // Remove default TextInput padding
    // color set by props
  },
  clearSearchButton: {
    padding: 4, marginLeft: 4,
  },
  searchActivityIndicator: {
    padding: 4, marginLeft: 4,
  },
  // Filter Bar Styles
  filterBarContainer: { // This is the content area animated by filterBarToggleAnim
    overflow: 'hidden', // Essential for height animation
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth, // Separator from categories or main header
    // backgroundColor, borderTopColor set by props
    // height is animated by filterBarToggleAnim
  },
  filterBarScrollView: {
    flex: 1, // Takes full height of its container (which is animated by filterBarToggleAnim)
  },
  filterBarScrollViewContent: {
    alignItems: 'center', // Align filter buttons
    paddingHorizontal: 10, // Consistent horizontal padding
    // Vertical padding to center filter buttons within FILTER_BAR_ROW_H
    paddingVertical: (FILTER_BAR_ROW_H - FILTER_BUTTON_H) / 2,
  },
  filterBarButton: {
    paddingHorizontal: 10, // Reduced padding for smaller buttons
    marginHorizontal: 4,   // Reduced margin
    height: FILTER_BUTTON_H,
    borderRadius: 15,      // Pill shape (half of height)
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor set by props
    shadowColor: '#000', // Subtle shadow for buttons
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDarkTheme ? 0.15 : 0.03,
    shadowRadius: 0.5,
    elevation: 1,
  },
  filterBarButtonText: {
    fontSize: 12, // Reduced font size
    fontWeight: '500',
  },
  filterBarButtonTextActive: {
    fontWeight: '600',
  },
  filterBarSeparator: {
    width: StyleSheet.hairlineWidth, // Thinner separator line
    height: '60%', // Relative height to content
    marginHorizontal: 8, // Spacing around separator
    opacity: 0.5, // Make it less prominent
    // backgroundColor set by props
  },
  filterSection: {
    paddingHorizontal: 4, // Minimal padding around section title and buttons
    marginVertical: 0,    // Vertical spacing controlled by row height and padding
    flexDirection: 'row', // Changed to row to place title next to buttons
    alignItems: 'center', // Center items vertically
  },
  filterSectionTitle: {
    fontSize: 10, // Very small title for sections
    fontWeight: '500',
    marginRight: 8, // Changed from marginBottom to marginRight
    paddingHorizontal: 4, // Align with button row if needed
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    // color set by props
  },
  filterButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Take remaining space
  },
});

export default React.memo(HeaderTabs);
