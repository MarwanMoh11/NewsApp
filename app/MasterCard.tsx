// components/MasterCard.tsx
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
  TextLayoutLine, // Keep if used or remove if not directly needed after useCallback changes
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons'; // Make sure this is installed
import { UserContext } from '../app/UserContext'; // Adjust path if necessary

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Define the Props Interface (Matching Index.tsx feedData items) ---
interface MasterItem {
  // Add 'bluesky' to the possible types
  type: 'tweet' | 'article' | 'bluesky' | 'unknown'; // MODIFIED: Added 'bluesky'
  id: string | number; // Consistent ID (Tweet_Link, Article ID, or Bluesky URI)
  dateTime?: string | null; // Consistent date/time field

  // Fields likely coming directly from backend UNION query aliases
  author?: string | null;
  text_content?: string | null;
  media_url?: string | null;
  categories?: string | null; // This will now be the subcategory
  region?: string | null; // Added in backend
  Explanation?: string | null;

  // Fields specific to Tweet OR Bluesky (might be null/undefined for articles)
  Retweets?: number | null;  // Corresponds to Tweet Retweets OR Bluesky Reposts
  Favorites?: number | null; // Corresponds to Tweet Favorites OR Bluesky Likes
  IsVerified?: boolean; // Status from backend (check custom domain for Bluesky)

  // Compatibility fields added in backend query (optional for frontend use, but good practice)
  like_count?: number | null;
  repost_count?: number | null;

  // Add any other fields your backend might return and you need here...
}

interface MasterCardProps {
  item: MasterItem;
  onPress: (item: MasterItem) => void; // Pass the whole item
}

// --- Constants ---
const MAX_LINES_TEXT = 4;
const SCREEN_WIDTH = Dimensions.get('window').width;

// --- Helper Functions ---
const formatRelativeTime = (isoDate?: string | null): string => {
    // ... (implementation unchanged) ...
    if (!isoDate) return '';
    try {
        const date = new Date(isoDate); const now = new Date();
        const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
        const diffMinutes = Math.round(diffSeconds / 60); const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);
        if (diffSeconds < 60) return `${diffSeconds}s`; if (diffMinutes < 60) return `${diffMinutes}m`;
        if (diffHours < 24) return `${diffHours}h`; if (diffDays === 1) return '1d';
        if (diffDays < 7) return `${diffDays}d`;
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        if (date.getFullYear() !== now.getFullYear()) { options.year = 'numeric'; }
        return date.toLocaleDateString(undefined, options);
    } catch (e) { console.error("Error formatting date:", isoDate, e); return String(isoDate).split('T')[0] || 'Invalid Date'; }
};

// --- Component ---
const MasterCard: React.FC<MasterCardProps> = ({ item, onPress }) => {
  const { isDarkTheme } = useContext(UserContext);

  // --- State ---
  // ... (state variables unchanged) ...
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(16 / 9);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMoreButton, setShowMoreButton] = useState(false);


  // Theme-based colors
  const colors = {
    background: isDarkTheme ? '#1A1A1A' : '#FFFFFF',
    text: isDarkTheme ? '#EAEAEA' : '#1C1C1E',
    textSecondary: isDarkTheme ? '#A0A0A0' : '#6C6C6E',
    authorText: isDarkTheme ? '#EAEAEA' : '#1C1C1E',
    separator: isDarkTheme ? '#374151' : '#E5E7EB',
    imagePlaceholder: isDarkTheme ? '#2C2C2E' : '#F0F0F0',
    errorIcon: isDarkTheme ? '#FF6B6B' : '#D93025',
    accent: isDarkTheme ? '#9067C6' : '#007AFF',
    showMoreText: isDarkTheme ? '#c7c7c7' : '#505050',
    twitterColor: '#1DA1F2', // Twitter blue
    articleColor: isDarkTheme ? '#AAAAAA' : '#777777', // Neutral color for newspaper
    blueskyColor: '#007AFF', // Bluesky blue (adjust as needed) // MODIFIED: Added Bluesky color
  };

  // Extract properties
  const {
    type, // Now includes 'bluesky'
    id,
    dateTime,
    author = 'Unknown Source',
    text_content = '',
    media_url,
    Retweets, // Represents Retweets or Reposts
    Favorites, // Represents Favorites or Likes
    IsVerified = false, // Represents X Verified or Bluesky Domain Verified
    // Use Retweets/Favorites for display, as backend mapped them
  } = item;

  const formattedTime = formatRelativeTime(dateTime);

  // --- Effects (unchanged) ---
  useEffect(() => {
    // ... (implementation unchanged) ...
    if (media_url) {
      let isMounted = true;
      setImageLoading(true); setImageError(false); setImageAspectRatio(16/9);
      Image.getSize(media_url, (width, height) => {
        if (isMounted && width > 0 && height > 0) { setImageAspectRatio(width / height); }
        else if (isMounted) { setImageError(true); }
      }, (error) => { if (isMounted) { console.error(`Failed to get image size: ${error}`, media_url); setImageError(true); setImageLoading(false); } });
      return () => { isMounted = false; };
    } else { setImageLoading(false); setImageError(false); setImageAspectRatio(16/9); }
  }, [media_url]);


  // --- Callbacks (unchanged) ---
  const handlePress = useCallback(() => { onPress(item); }, [onPress, item]);
  const handleImageLoadEnd = useCallback(() => setImageLoading(false), []);
  const handleImageError = useCallback(() => { setImageLoading(false); setImageError(true); }, []);
  const onTextLayout = useCallback((event: { nativeEvent: { lines: TextLayoutLine[] } }) => {
      // ... (implementation unchanged) ...
      if (!isExpanded && !showMoreButton && event.nativeEvent.lines.length > MAX_LINES_TEXT) {
          setShowMoreButton(true);
      }
  }, [isExpanded, showMoreButton]);
  const toggleTextExpansion = useCallback(() => {
      // ... (implementation unchanged) ...
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(prev => !prev);
  }, []);


  // --- Icon Selection (MODIFIED) ---
  let TypeIcon = <Icon name="newspaper-outline" size={16} color={colors.articleColor} style={styles.typeIcon} />; // Default to article
  if (type === 'tweet') {
    TypeIcon = <Icon name="logo-twitter" size={16} color={colors.twitterColor} style={styles.typeIcon} />;
  } else if (type === 'bluesky') {
    // Use a placeholder icon from Ionicons. Replace with custom Image/SVG for better branding.
    TypeIcon = <Icon name="cloud-outline" size={16} color={colors.blueskyColor} style={styles.typeIcon} />;
  }

  // --- Accessibility Label (MODIFIED) ---
  const accessibilityLabel = type === 'tweet' ? 'Tweet'
                            : type === 'bluesky' ? 'Bluesky Post'
                            : 'Article'; // Default
  const imageAccessibilityLabel = type === 'tweet' ? "Image attached to tweet"
                                  : type === 'bluesky' ? "Image attached to Bluesky post"
                                  : "Article lead image"; // Default


  return (
    <TouchableOpacity
      style={[ styles.cardContainer, { backgroundColor: colors.background, borderColor: colors.separator } ]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessible={true}
      // MODIFIED: Updated accessibility label
      accessibilityLabel={`${accessibilityLabel} from ${author}. ${text_content.substring(0, 50)}...`}
      accessibilityRole="button"
    >
      {/* Header: Author/Source, Time, and Type Icon */}
      <View style={styles.headerContainer}>
        <View style={styles.authorTimeContainer}>
          <View style={styles.authorLine}>
             <Text style={[styles.authorText, { color: colors.authorText }]} numberOfLines={1}>
                {author}
             </Text>
             {/* Show checkmark for Tweets OR Bluesky posts if IsVerified is true */}
             {(type === 'tweet' || type === 'bluesky') && IsVerified && ( // MODIFIED: Condition includes bluesky
                <Icon name="checkmark-circle" size={15} color={colors.accent} style={styles.verifiedBadge} />
             )}
          </View>
          <Text style={[styles.dateText, { color: colors.textSecondary }]} numberOfLines={1}>
            {formattedTime}
          </Text>
        </View>
         {/* Display Type Icon */}
         {TypeIcon}
      </View>

      {/* Text Content (Tweet, Skeet, or Headline) */}
      {/* ... (Text content rendering unchanged) ... */}
       {text_content ? (
        <View style={styles.contentContainer}>
           <Text
              style={[styles.contentText, { color: colors.text }]}
              numberOfLines={isExpanded ? undefined : MAX_LINES_TEXT}
              onTextLayout={onTextLayout}
          >
              {text_content}
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


       {/* Image/Media */}
       {/* ... (Image loading/error handling unchanged, uses updated imageAccessibilityLabel) ... */}
       {media_url && (
        <View style={styles.mediaContainer}>
          {!imageError && imageAspectRatio ? (
              <Image
                  source={{ uri: media_url }}
                  style={[styles.mediaImage, { aspectRatio: imageAspectRatio }]}
                  resizeMode="cover"
                  onLoadEnd={handleImageLoadEnd}
                  onError={handleImageError}
                  accessible={true}
                  accessibilityLabel={imageAccessibilityLabel} // MODIFIED: Uses updated label
              />
          ) : null }
           {imageLoading && !imageError && imageAspectRatio && (
                <View style={[StyleSheet.absoluteFill, styles.placeholderOverlay, { backgroundColor: colors.imagePlaceholder }]}>
                    <ActivityIndicator size="small" color={colors.accent} />
                </View>
            )}
            {imageError && (
                 <View style={[styles.mediaImage, { aspectRatio: 16/9, backgroundColor: colors.imagePlaceholder }, styles.placeholderOverlay]}>
                    {/* Use cloud for tweet/bluesky errors, image for article errors */}
                    <Icon name={(type === 'tweet' || type === 'bluesky') ? "cloud-offline-outline" : "image-outline"} size={40} color={colors.errorIcon} />
                </View>
            )}
        </View>
      )}


      {/* Footer for Tweet/Bluesky Engagements (MODIFIED) */}
      {/* Show footer if it's a tweet OR a bluesky post and has counts */}
      {(type === 'tweet' || type === 'bluesky') && (Retweets != null || Favorites != null) && (
          <View style={[styles.footerContainer, { borderTopColor: colors.separator }]}>
              {/* Use repeat-outline for Retweets/Reposts */}
              {Retweets != null && Retweets > 0 && (
                  <Text style={[styles.engagementText, { color: colors.textSecondary }]}>
                      <Icon name="repeat-outline" size={14} color={colors.textSecondary} /> {Retweets}
                  </Text>
              )}
              {/* Use heart-outline for Favorites/Likes */}
               {Favorites != null && Favorites > 0 && (
                  <Text style={[styles.engagementText, { color: colors.textSecondary, marginLeft: 15 }]}>
                      <Icon name="heart-outline" size={14} color={colors.textSecondary} /> {Favorites}
                  </Text>
              )}
          </View>
      )}

    </TouchableOpacity>
  );
};

// --- Styles (unchanged) ---
const styles = StyleSheet.create({
    // ... (all existing styles remain the same) ...
  cardContainer: { marginVertical: 6, marginHorizontal: 0, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden', },
  headerContainer: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, },
  authorTimeContainer: { flex: 1, marginRight: 8, },
  authorLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 1, },
  authorText: { fontSize: 14, fontWeight: '600', marginRight: 4, },
  verifiedBadge: { marginLeft: 2, marginTop: 1, },
  dateText: { fontSize: 13, },
  typeIcon: { marginTop: 2, },
  contentContainer: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, },
  contentText: { fontSize: 15, lineHeight: 21, flexWrap: 'wrap', },
  mediaContainer: { width: '100%', marginTop: 4, },
  mediaImage: { width: '100%', height: undefined, },
  placeholderOverlay: { justifyContent: 'center', alignItems: 'center', },
  showMoreButton: { marginTop: 6, alignSelf: 'flex-start', paddingVertical: 2, },
  showMoreText: { fontSize: 14, fontWeight: '500', },
  footerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, paddingTop: 8, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, },
  engagementText: { fontSize: 13, },
});

export default React.memo(MasterCard);