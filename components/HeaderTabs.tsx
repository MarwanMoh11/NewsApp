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
  UIManager, // Keep UIManager import if needed elsewhere, not strictly for this fix
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust path if needed

// --- Define the props interface (Types remain the same) ---
export interface HeaderTabsProps {
  categories: string[];
  activeCategory: string;
  onCategorySelect: (category: string) => void;
  subcategories: string[]; // ALL available for the active main category
  activeSubcategory: string | string[] | null; // Can be single, array (for 'All'), or null
  onSubcategorySelect: (subcategory: string | string[] | null) => void;
  allUserPreferences: string[]; // User's selected preferences (for filtering subcat buttons)
  activeFilter: string; // All, Tweets, Articles
  onFilterSelect: (filter: string) => void;
  username?: string | null;
  profilePictureUrl?: string | null;
  onSettingsPress: () => void;
  onLoginPress: () => void;
  onSearch: (query: string) => void;
  isLoggedIn: boolean;
  searchQuery: string;
  isLoading?: boolean; // Login loading
  isTrendingActive?: boolean;
  isSearchLoading?: boolean;
}

// --- Constants ---
const MAIN_HEADER_MIN_HEIGHT = 55;
const FILTER_BAR_HEIGHT = 42;

// --- Component Definition ---
const HeaderTabs: React.FC<HeaderTabsProps> = ({
  categories = [],
  activeCategory,
  onCategorySelect,
  subcategories = [],
  activeSubcategory,
  onSubcategorySelect,
  allUserPreferences = [],
  activeFilter,
  onFilterSelect,
  username,
  profilePictureUrl,
  onSettingsPress,
  onLoginPress,
  onSearch,
  searchQuery,
  isLoggedIn,
  isLoading = false,
  isTrendingActive = false,
  isSearchLoading = false,
}) => {
  // --- Hooks ---
  const { isDarkTheme } = useContext(UserContext);

  // --- State and Refs ---
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // --- Animations ---
  const searchContainerWidth = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const filterBarAnim = useRef(new Animated.Value(0)).current;

  // --- Theming ---
   // --- Theming (Copied from previous version) ---
   const colors = {
    background: isDarkTheme ? '#121212' : '#FFFFFF',
    text: isDarkTheme ? '#EAEAEA' : '#1C1C1E',
    textSecondary: isDarkTheme ? '#A0A0A0' : '#6C6C6E',
    placeholder: isDarkTheme ? '#666' : '#AAA',
    icon: isDarkTheme ? '#B0B0B0' : '#555555',
    iconActive: isDarkTheme ? '#FFFFFF' : '#000000',
    profileBorder: isDarkTheme ? '#444' : '#DDD',
    categoryBg: isDarkTheme ? '#1F1F1F' : '#F8F8F8',
    categoryBorder: isDarkTheme ? '#333' : '#E5E5E5',
    categoryText: isDarkTheme ? '#D0D0D0' : '#444444',
    categoryActiveBg: isDarkTheme ? '#9067C6' : '#007AFF', // Example accent colors
    categoryActiveBorder: isDarkTheme ? '#9067C6' : '#007AFF',
    categoryActiveText: '#FFFFFF',
    searchBg: isDarkTheme ? '#1E1E1E' : '#F0F0F0',
    filterBarBackground: isDarkTheme ? '#1A1A1A' : '#FDFDFD',
    filterBarBorder: isDarkTheme ? '#2F2F2F' : '#F0F0F0',
    filterBarButtonBg: isDarkTheme ? '#2C2C2E' : '#F0F0F0',
    filterBarButtonBorder: isDarkTheme ? '#444' : '#D5D5D5',
    filterBarButtonText: isDarkTheme ? '#C0C0C0' : '#555555',
    filterBarButtonActiveBg: isDarkTheme ? '#7A59A8' : '#409CFF', // Adjusted active filter button colors
    filterBarButtonActiveBorder: isDarkTheme ? '#7A59A8' : '#409CFF',
    filterBarButtonActiveText: '#FFFFFF',
    filterBarSeparator: isDarkTheme ? '#444' : '#E0E0E0',
    borderColor: isDarkTheme ? '#272727' : '#E5E5E5',
    accent: isDarkTheme ? '#9067C6' : '#007AFF', // Example accent colors
  };
  const iconSize = 22;
  const profileSize = 30;

  // --- Filter relevant subcategories based on user preferences ---
  const relevantSubcategories = subcategories.filter(sub => allUserPreferences.includes(sub));
  const showSubcategoriesInFilter = !isTrendingActive && relevantSubcategories.length > 0;


  // --- Animation Logic ---
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

  // --- Handlers ---
  const handleToggleSearch = useCallback(() => { setIsSearchMode(prev => !prev); }, []);
  const handleSearchChange = useCallback((text: string) => { onSearch(text); }, [onSearch]);
  const handleClearSearch = useCallback(() => { onSearch(''); searchInputRef.current?.clear(); searchInputRef.current?.focus(); }, [onSearch]);
  const handleToggleFilterBar = useCallback(() => { setShowFilterBar(prev => !prev); if (showFilterBar) Keyboard.dismiss(); }, [showFilterBar]);
  const handleSelectFilter = useCallback((filter: string) => { onFilterSelect(filter); }, [onFilterSelect]);
  const handleSelectSubcategory = useCallback((subcategory: string | string[] | null) => {
    onSubcategorySelect(subcategory);
  }, [onSubcategorySelect]);

  // --- Render Logic ---
  const renderProfileIcon = () => (
    <TouchableOpacity onPress={isLoggedIn ? onSettingsPress : onLoginPress} style={styles.profileButton} disabled={isLoading} accessibilityLabel={isLoggedIn ? 'Open Settings' : 'Login'} >
      {isLoading ? ( <ActivityIndicator size="small" color={colors.iconActive} />
      ) : isLoggedIn && profilePictureUrl ? (
        <Image source={{ uri: profilePictureUrl }} style={[ styles.profileImage, { width: profileSize, height: profileSize, borderRadius: profileSize / 2, borderColor: colors.profileBorder, }]} accessibilityLabel="User profile picture" />
      ) : (
        <View style={[ styles.profilePlaceholder, { width: profileSize, height: profileSize, borderRadius: profileSize / 2, backgroundColor: colors.categoryBg, borderColor: colors.profileBorder, }]} >
          <Icon name={isLoggedIn ? "person-outline" : "log-in-outline"} size={iconSize * 0.7} color={colors.icon} />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderCategoryTabs = () => {
    if (isTrendingActive) {
      return ( <View style={styles.trendingTitleContainer}> <Text style={[styles.trendingTitle, { color: colors.text }]}> Trending Now </Text> </View> );
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScrollContainer} style={styles.categoriesScrollView}>
        {categories.map((category) => {
          const isActive = !isTrendingActive && activeCategory === category;
          return (
            <TouchableOpacity key={category} onPress={() => onCategorySelect(category)} style={[ styles.categoryButton, { backgroundColor: isActive ? colors.categoryActiveBg : colors.categoryBg, borderColor: isActive ? colors.categoryActiveBorder : colors.categoryBorder, }]} accessibilityLabel={`Select or toggle category ${category}`} accessibilityState={{ selected: isActive }} >
              <Text style={[ styles.categoryText, { color: isActive ? colors.categoryActiveText : colors.categoryText }, isActive && styles.categoryTextActive, ]} numberOfLines={1} > {category} </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderFilterBar = () => {
    const filterOptions = ['All', 'Tweets', 'Articles'];
    const animatedFilterBarStyle = {
        height: filterBarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FILTER_BAR_HEIGHT] }),
        opacity: filterBarAnim,
        borderTopWidth: showFilterBar ? StyleSheet.hairlineWidth : 0,
        borderBottomWidth: showFilterBar ? StyleSheet.hairlineWidth : 0,
    };
    const isAllSubcategoriesActive = Array.isArray(activeSubcategory) || (activeSubcategory === null && relevantSubcategories.length > 0);

    return (
        <Animated.View style={[ styles.filterBarContainer, animatedFilterBarStyle, { backgroundColor: colors.filterBarBackground, borderTopColor: colors.filterBarBorder, borderBottomColor: colors.filterBarBorder } ]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarScrollViewContent} style={styles.filterBarScrollView} keyboardShouldPersistTaps="handled" >
                {/* Filter Type Buttons */}
                {filterOptions.map((option) => {
                    const isFilterActive = activeFilter === option;
                    return ( <TouchableOpacity key={`filter-${option}`} onPress={() => handleSelectFilter(option)} style={[ styles.filterBarButton, { backgroundColor: isFilterActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg, borderColor: isFilterActive ? colors.filterBarButtonActiveBorder : colors.filterBarButtonBorder, } ]} accessibilityLabel={`Filter by ${option}`} accessibilityState={{ selected: isFilterActive }} >
                            <Text style={[ styles.filterBarButtonText, { color: isFilterActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText }, isFilterActive && styles.filterBarButtonTextActive, ]}> {option} </Text>
                        </TouchableOpacity> );
                })}
                {/* Separator and Subcategories */}
                {showSubcategoriesInFilter && ( <>
                        <View style={[styles.filterBarSeparator, { backgroundColor: colors.filterBarSeparator }]} />
                        <TouchableOpacity key="all-subcategories" onPress={() => handleSelectSubcategory(relevantSubcategories)} style={[ styles.filterBarButton, { backgroundColor: isAllSubcategoriesActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg, borderColor: isAllSubcategoriesActive ? colors.filterBarButtonActiveBorder : colors.filterBarButtonBorder, } ]} accessibilityLabel={`Show all ${activeCategory}`} accessibilityState={{ selected: isAllSubcategoriesActive }} >
                            <Text style={[ styles.filterBarButtonText, { color: isAllSubcategoriesActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText }, isAllSubcategoriesActive && styles.filterBarButtonTextActive, ]}> All {activeCategory} </Text>
                        </TouchableOpacity>
                        {relevantSubcategories.map((subcategory) => {
                            const isSubActive = typeof activeSubcategory === 'string' && activeSubcategory === subcategory;
                            const formattedSubcategory = subcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return ( <TouchableOpacity key={subcategory} onPress={() => handleSelectSubcategory(subcategory)} style={[ styles.filterBarButton, { backgroundColor: isSubActive ? colors.filterBarButtonActiveBg : colors.filterBarButtonBg, borderColor: isSubActive ? colors.filterBarButtonActiveBorder : colors.filterBarButtonBorder, } ]} accessibilityLabel={`Filter by ${formattedSubcategory}`} accessibilityState={{ selected: isSubActive }} >
                                    <Text style={[ styles.filterBarButtonText, { color: isSubActive ? colors.filterBarButtonActiveText : colors.filterBarButtonText }, isSubActive && styles.filterBarButtonTextActive, ]}> {formattedSubcategory} </Text>
                                </TouchableOpacity> );
                        })}
                    </> )}
            </ScrollView>
        </Animated.View>
    );
   };

  // --- Interpolated Styles for Animations ---
  const animatedSearchInputWrapperStyle = { opacity: searchContainerWidth };
  const normalHeaderStyle = { opacity: opacityAnim };
  const animatedSearchContainerStyle = { width: searchContainerWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), opacity: searchContainerWidth.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) };

  // --- *** Condition for showing the filter dot *** ---
  const isFilterApplied = activeFilter !== 'All' || typeof activeSubcategory === 'string';

  // --- Main Render Structure ---
  return (
    <View style={[styles.headerBackground, { backgroundColor: colors.background }]}>
        <View style={[styles.mainHeaderContainer]}>
            {/* Normal Header Content (Profile, Categories, Icons) */}
            <Animated.View style={[styles.normalHeaderContent, normalHeaderStyle, { zIndex: isSearchMode ? 5 : 10 }]}>
            {/* Set zIndex lower than search overlay when search is active */}
                {renderProfileIcon()}
                {renderCategoryTabs()}
                <View style={styles.rightIconsContainer}>
                    {!isTrendingActive && (
                        <TouchableOpacity onPress={handleToggleFilterBar} style={styles.iconButton} accessibilityLabel="Filter content">
                            <Icon name="filter-outline" size={iconSize} color={colors.icon} />
                            {/* *** UPDATED Condition for Filter Dot *** */}
                            {isFilterApplied && <View style={[styles.filterActiveIndicator, { backgroundColor: colors.accent }]}/>}
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleToggleSearch} style={styles.iconButton} accessibilityLabel="Search content">
                        <Icon name="search-outline" size={iconSize} color={colors.icon} />
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {/* Search Overlay */}
            {/* *** Added pointerEvents based on isSearchMode *** */}
            <Animated.View
                 style={[styles.searchOverlayContainer, animatedSearchContainerStyle, { backgroundColor: colors.background }]}
                 pointerEvents={isSearchMode ? 'auto' : 'none'} // <-- FIX for touch interception
            >
                 <TouchableOpacity onPress={handleToggleSearch} style={styles.searchBackButton} accessibilityLabel="Close search">
                    <Icon name="arrow-back-outline" size={iconSize} color={colors.icon} />
                </TouchableOpacity>
                <Animated.View style={[styles.searchInputWrapper, { backgroundColor: colors.searchBg }, animatedSearchInputWrapperStyle]}>
                    <Icon name="search-outline" size={iconSize * 0.75} color={colors.placeholder} style={styles.searchIcon}/>
                    <TextInput ref={searchInputRef} style={[styles.searchInput, { color: colors.text }]} placeholder="Search feed..." placeholderTextColor={colors.placeholder} value={searchQuery} onChangeText={handleSearchChange} returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} autoCorrect={false} autoCapitalize="none" />
                    {isSearchLoading ? ( <ActivityIndicator size="small" color={colors.accent} style={styles.searchLoadingIndicator} />
                    ) : searchQuery.length > 0 ? (
                        <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchButton}>
                            <Icon name="close-circle" size={iconSize * 0.75} color={colors.placeholder} />
                        </TouchableOpacity>
                    ) : null }
                </Animated.View>
            </Animated.View>
        </View>

        {/* Filter Bar (Conditionally Rendered below Header) */}
        {!isSearchMode && renderFilterBar()}
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  headerBackground: {
    zIndex: 11, // Keep header background above content
  },
  mainHeaderContainer: {
    paddingTop: Platform.OS === 'android' ? 8 : 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MAIN_HEADER_MIN_HEIGHT,
    position: 'relative', // Needed for absolute positioning of overlay
  },
  normalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    // zIndex added inline based on isSearchMode
  },
  profileButton: {
    padding: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20, // Ensure profile button is clickable
  },
  profileImage: {
    borderWidth: 1,
  },
  profilePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  categoriesScrollView: {
    flexGrow: 1,
    marginHorizontal: 4,
  },
  categoriesScrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingRight: 8,
  },
  categoryButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    height: 34,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  categoryTextActive: {
    fontWeight: '600',
  },
  trendingTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto', // Pushes icons to the right
     zIndex: 20, // Ensure icons are clickable
  },
  iconButton: {
    padding: 6,
    marginLeft: 6, // Space between icons
    position: 'relative', // For the indicator dot
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
    paddingHorizontal: 10,
    // Adjust vertical padding to vertically center search bar within header min height
    paddingVertical: (MAIN_HEADER_MIN_HEIGHT - 36) / 2, // (Header Height - Search Bar Height) / 2
    zIndex: 15, // Higher than normal content
    overflow: 'hidden',
  },
  searchBackButton: {
    padding: 6,
    marginRight: 6,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18, // Rounded corners
    paddingHorizontal: 10,
    height: 36, // Fixed height for search bar
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    paddingVertical: 0, // Remove default padding
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 4,
  },
  searchLoadingIndicator: {
    padding: 4,
    marginLeft: 4,
  },
  filterBarContainer: {
    height: FILTER_BAR_HEIGHT, // Use constant
    overflow: 'hidden',
    zIndex: 10, // Below main header icons/search
  },
  filterBarScrollView: {
    flex: 1,
  },
  filterBarScrollViewContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 12, // Padding for scroll content
  },
  filterBarButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16, // Pill shape
    marginHorizontal: 4, // Space between buttons
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    height: 30, // Fixed height for filter buttons
  },
  filterBarButtonText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  filterBarButtonTextActive: {
    fontWeight: '600',
  },
  filterBarSeparator: {
    width: 1,
    height: '60%', // Separator height
    marginHorizontal: 8, // Space around separator
  },
 });

export default React.memo(HeaderTabs);