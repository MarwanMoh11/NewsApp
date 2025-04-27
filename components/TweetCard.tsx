import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  View,
  Dimensions,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
  UIManager,
  TextLayoutLine,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust path if necessary

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Define the props interface
interface TweetCardProps {
  item: {
    Tweet_Link?: string;
    Media_URL?: string | null;
    Username?: string;
    Created_At?: string;
    Tweet?: string;
    UserProfileImage?: string; // Keep prop, even if not displayed
    IsVerified?: boolean;
  };
  onPress: (item: TweetCardProps['item']) => void;
}

// --- Constants ---
const MAX_LINES = 4;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Helper function to format date/time
const formatRelativeTime = (isoDate?: string): string => {
    if (!isoDate) return '';
    try {
        const date = new Date(isoDate); const now = new Date();
        const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
        const diffMinutes = Math.round(diffSeconds / 60); const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);
        if (diffSeconds < 60) return `${diffSeconds}s ago`; if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`; if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        if (date.getFullYear() !== now.getFullYear()) { options.year = 'numeric'; }
        return date.toLocaleDateString(undefined, options);
    } catch (e) { console.error("Error formatting date:", isoDate, e); return isoDate.split(' ')[0] || 'Invalid Date'; }
};


const TweetCard: React.FC<TweetCardProps> = ({ item, onPress }) => {
  const { isDarkTheme } = useContext(UserContext);

  // --- State ---
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMoreButton, setShowMoreButton] = useState(false);

  // Theme-based colors
  const colors = {
    // Use the card background color from theme for subtle containment
    background: isDarkTheme ? '#1A1A1A' : '#FFFFFF', // Match Index Card background
    text: isDarkTheme ? '#EAEAEA' : '#1C1C1E',
    textSecondary: isDarkTheme ? '#A0A0A0' : '#6C6C6E',
    username: isDarkTheme ? '#EAEAEA' : '#1C1C1E',
    accent: isDarkTheme ? '#9067C6' : '#007AFF',
    // Use a subtle border color
    separator: isDarkTheme ? '#374151' : '#E5E7EB', // Subtle border color
    imagePlaceholder: isDarkTheme ? '#2C2C2E' : '#F0F0F0',
    errorIcon: isDarkTheme ? '#FF6B6B' : '#D93025',
    showMoreText: isDarkTheme ? '#c7c7c7' : '#505050',
  };

  // Extract item properties
  const { Media_URL, Username = 'Unknown User', Created_At, Tweet = '', UserProfileImage, IsVerified = false } = item;
  const formattedTime = formatRelativeTime(Created_At);

  // --- Effects ---
  // Effect to get image dimensions
  useEffect(() => {
    if (Media_URL) {
      let isMounted = true;
      setImageLoading(true); setImageError(false); setImageAspectRatio(null);
      Image.getSize(Media_URL, (width, height) => {
        if (isMounted && width > 0 && height > 0) { setImageAspectRatio(width / height); }
        else if (isMounted) { console.warn("Image dimensions invalid:", Media_URL); setImageError(true); setImageLoading(false); }
      }, (error) => { if (isMounted) { console.error(`Failed to get image size: ${error}`, Media_URL); setImageError(true); setImageLoading(false); } });
      return () => { isMounted = false; };
    } else { setImageLoading(false); setImageError(false); setImageAspectRatio(null); }
  }, [Media_URL]);

  // --- Callbacks ---
  const handleImageLoadStart = useCallback(() => { /* Loading starts with getSize */ }, []);
  const handleImageLoadEnd = useCallback(() => setImageLoading(false), []);
  const handleImageError = useCallback(() => { console.log("Image failed to load:", Media_URL); setImageLoading(false); setImageError(true); }, [Media_URL]);
  const onTextLayout = useCallback((event: { nativeEvent: { lines: TextLayoutLine[] } }) => { if (!showMoreButton && event.nativeEvent.lines.length > MAX_LINES) { setShowMoreButton(true); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } }, [showMoreButton]);
  const toggleTextExpansion = useCallback(() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsExpanded(prev => !prev); }, []);

  return (
    // Touchable container with subtle card styles
    <TouchableOpacity
      style={[
          styles.container, // Use container style
          {
              backgroundColor: colors.background, // Use card background
              borderColor: colors.separator, // Use subtle border color
          }
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
      accessible={true}
      accessibilityLabel={`Tweet from ${Username}. ${Tweet.substring(0, 50)}...`}
      accessibilityRole="button"
    >
        {/* 1. User Info Area */}
        <View style={styles.userInfoArea}>
            {/* Profile Image Removed */}
            <View style={styles.usernameTimeColumn}>
                <View style={styles.usernameLine}>
                    <Text style={[styles.username, { color: colors.username }]} numberOfLines={1}>
                        {Username}
                    </Text>
                    {IsVerified && (
                        <Icon name="checkmark-circle" size={16} color={colors.accent} style={styles.verifiedBadge} />
                    )}
                </View>
                <Text style={[styles.timestamp, { color: colors.textSecondary }]} numberOfLines={1}>
                    {formattedTime}
                </Text>
            </View>
        </View>

        {/* 2. Image Area */}
        {Media_URL && (
          <View style={styles.imageWrapper}>
            {/* A. Render Image if aspect ratio is known and no error */}
            {!imageError && imageAspectRatio && (
              <Image
                source={{ uri: Media_URL }}
                style={[styles.tweetImage, { aspectRatio: imageAspectRatio }]}
                resizeMode="cover"
                onLoadStart={handleImageLoadStart}
                onLoadEnd={handleImageLoadEnd}
                onError={handleImageError}
                accessible={true}
                accessibilityLabel="Image attached to the tweet"
              />
            )}
            {/* B. Show Loading Indicator */}
            {imageLoading && !imageError && (
                <View style={[styles.imagePlaceholder, { aspectRatio: imageAspectRatio ?? 16/9, backgroundColor: colors.imagePlaceholder }]}>
                    <ActivityIndicator style={styles.loadingIndicator} size="small" color={colors.accent} />
                </View>
            )}
            {/* C. Show Error state */}
            {imageError && !imageLoading && (
                 <View style={[styles.imagePlaceholder, { aspectRatio: 16/9, backgroundColor: colors.imagePlaceholder }]}>
                    <Icon name="cloud-offline-outline" size={40} color={colors.errorIcon} />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>Image failed</Text>
                </View>
            )}
          </View>
        )}

        {/* 3. Tweet Text Area */}
        {Tweet ? (
          <View style={styles.textArea}>
             <Text
                style={[styles.tweetText, { color: colors.text }]}
                numberOfLines={isExpanded ? undefined : MAX_LINES}
                onTextLayout={onTextLayout}
            >
                {Tweet}
            </Text>
            {showMoreButton && (
                <TouchableOpacity onPress={toggleTextExpansion} style={styles.showMoreButton}>
                    <Text style={[styles.showMoreText, { color: colors.showMoreText }]}>
                        {isExpanded ? 'Show Less' : 'Show More'}
                    </Text>
                </TouchableOpacity>
            )}
          </View>
        ) : null}

    </TouchableOpacity>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    // Reintroduce subtle card styles
    marginVertical: 8, // Vertical separation
    marginHorizontal: 16, // Horizontal margins (adjust if parent has padding)
    borderRadius: 12, // Soften corners
    borderWidth: StyleSheet.hairlineWidth, // Subtle border
    overflow: 'hidden', // Clip image corners to border radius
    // backgroundColor and borderColor set dynamically
    // Removed shadow/elevation for cleaner look, can be added back if desired
  },
  // 1. User Info Area
  userInfoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, // Padding inside the container
    paddingTop: 12,
    marginBottom: 8,
  },
  // profileImage style removed
  usernameTimeColumn: {
      flex: 1,
      justifyContent: 'center',
  },
  usernameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
  verifiedBadge: {},
  timestamp: {
    fontSize: 13,
  },
  // 2. Image Area
  imageWrapper: {
      width: '100%', // Image takes full width *of the container*
      marginBottom: 8, // Space below image before text
      // No background needed here
  },
  imagePlaceholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tweetImage: {
    width: '100%',
    height: undefined,
    // aspectRatio set dynamically
  },
  loadingIndicator: {},
  errorText: {
      marginTop: 5,
      fontSize: 12,
  },
  // 3. Text Area
  textArea: {
      paddingHorizontal: 16, // Padding inside the container
      paddingBottom: 12, // Padding at the bottom of the container
  },
  tweetText: {
    fontSize: 15,
    lineHeight: 21,
    flexWrap: 'wrap',
  },
  showMoreButton: {
      marginTop: 4,
      alignSelf: 'flex-start',
  },
  showMoreText: {
      fontSize: 14,
      fontWeight: '500',
  },
});

export default React.memo(TweetCard);
