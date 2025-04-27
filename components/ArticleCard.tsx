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
interface ArticleCardProps {
  item: {
    id: number | string;
    image_url?: string | null;
    headline?: string;
    authors?: string;
    date?: string;
    sourceName?: string;
    description?: string;
  };
  onPress: (item: ArticleCardProps['item']) => void;
}

// --- Constants ---
const MAX_LINES_HEADLINE = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Helper function to format date
const formatArticleDate = (isoDate?: string): string => {
    if (!isoDate) return '';
    try {
        const date = new Date(isoDate); const now = new Date();
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        if (date.getFullYear() !== now.getFullYear()) { options.year = 'numeric'; }
        return date.toLocaleDateString(undefined, options);
    } catch (e) { console.error("Error formatting article date:", isoDate, e); return isoDate.split('T')[0] || 'Invalid Date'; }
};


const ArticleCard: React.FC<ArticleCardProps> = ({ item, onPress }) => {
  const { isDarkTheme } = useContext(UserContext);

  // --- State ---
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMoreButton, setShowMoreButton] = useState(false);

  // Theme-based colors
  const colors = {
    background: isDarkTheme ? '#1A1A1A' : '#FFFFFF', // Use card background
    text: isDarkTheme ? '#EAEAEA' : '#1C1C1E',
    textSecondary: isDarkTheme ? '#A0A0A0' : '#6C6C6E',
    headline: isDarkTheme ? '#FFFFFF' : '#000000',
    separator: isDarkTheme ? '#374151' : '#E5E7EB', // Subtle border color
    imagePlaceholder: isDarkTheme ? '#2C2C2E' : '#F0F0F0',
    errorIcon: isDarkTheme ? '#FF6B6B' : '#D93025',
    accent: isDarkTheme ? '#9067C6' : '#007AFF',
    showMoreText: isDarkTheme ? '#c7c7c7' : '#505050',
  };

  // Extract item properties
  const { image_url, headline = 'Untitled Article', authors, date, sourceName } = item;
  const formattedDate = formatArticleDate(date);

  // --- Effects ---
  // Effect to get image dimensions
  useEffect(() => {
    if (image_url) {
      let isMounted = true;
      setImageLoading(true); setImageError(false); setImageAspectRatio(null);
      Image.getSize(image_url, (width, height) => {
        if (isMounted && width > 0 && height > 0) { setImageAspectRatio(width / height); }
        else if (isMounted) { console.warn("Image dimensions invalid:", image_url); setImageError(true); setImageLoading(false); }
      }, (error) => { if (isMounted) { console.error(`Failed to get image size: ${error}`, image_url); setImageError(true); setImageLoading(false); } });
      return () => { isMounted = false; };
    } else { setImageLoading(false); setImageError(false); setImageAspectRatio(null); }
  }, [image_url]);

  // --- Callbacks ---
  const handlePress = useCallback(() => { onPress(item); }, [onPress, item]);
  const handleImageLoadStart = useCallback(() => { /* Loading starts with getSize */ }, []);
  const handleImageLoadEnd = useCallback(() => setImageLoading(false), []);
  const handleImageError = useCallback(() => { console.log("Image failed to load:", image_url); setImageLoading(false); setImageError(true); }, [image_url]);
  const onHeadlineLayout = useCallback((event: { nativeEvent: { lines: TextLayoutLine[] } }) => { if (!showMoreButton && event.nativeEvent.lines.length > MAX_LINES_HEADLINE) { setShowMoreButton(true); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } }, [showMoreButton]);
  const toggleHeadlineExpansion = useCallback(() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsExpanded(prev => !prev); }, []);

  return (
    // Touchable container with subtle card styles
    <TouchableOpacity
      style={[
          styles.container,
          {
              backgroundColor: colors.background,
              borderColor: colors.separator,
          }
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessible={true}
      accessibilityLabel={`Article: ${headline}. ${authors ? `By ${authors}` : ''}`}
      accessibilityRole="button"
    >
        {/* 1. Header Area */}
        <View style={styles.headerArea}>
            {(authors || sourceName) && (
                <Text style={[styles.authors, { color: colors.textSecondary }]} numberOfLines={1}>
                    {authors ? `By ${authors}` : sourceName?.toUpperCase()}
                </Text>
            )}
            {formattedDate && (
                <Text style={[styles.date, { color: colors.textSecondary }]}>
                    {(authors || sourceName) ? ` · ${formattedDate}` : formattedDate}
                </Text>
            )}
        </View>

        {/* 2. Image Area */}
        {image_url && (
          <View style={styles.imageWrapper}>
             {/* A. Render Image */}
            {!imageError && imageAspectRatio && (
                <Image
                    source={{ uri: image_url }}
                    style={[styles.articleImage, { aspectRatio: imageAspectRatio }]}
                    resizeMode="cover"
                    onLoadStart={handleImageLoadStart}
                    onLoadEnd={handleImageLoadEnd}
                    onError={handleImageError}
                    accessible={true}
                    accessibilityLabel="Article lead image"
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
                    <Icon name="image-outline" size={40} color={colors.errorIcon} />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>Image failed</Text>
                </View>
            )}
          </View>
        )}

        {/* 3. Headline Area */}
        <View style={styles.headlineArea}>
            <Text
                style={[styles.headline, { color: colors.headline }]}
                numberOfLines={isExpanded ? undefined : MAX_LINES_HEADLINE}
                onTextLayout={onHeadlineLayout}
            >
                {headline}
            </Text>
            {showMoreButton && (
                <TouchableOpacity onPress={toggleHeadlineExpansion} style={styles.showMoreButton}>
                    <Text style={[styles.showMoreText, { color: colors.showMoreText }]}>
                        {isExpanded ? 'Show Less' : 'Show More'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>

    </TouchableOpacity>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    // Hybrid card styles
    marginVertical: 8,
    marginHorizontal: 16, // Adjust if parent has padding
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', // Clip image corners
    // backgroundColor and borderColor set dynamically
  },
  // 1. Header Area Styles
  headerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, // Padding inside container
    paddingTop: 12,
    marginBottom: 12,
  },
  authors: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 4,
  },
  date: {
    fontSize: 13,
  },
  // 2. Image Area Styles
  imageWrapper: {
      width: '100%', // Full width of container
      marginBottom: 12,
      // No background needed
  },
  imagePlaceholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  articleImage: {
    width: '100%',
    height: undefined,
    // aspectRatio set dynamically
  },
  loadingIndicator: {},
  errorText: {
      marginTop: 5,
      fontSize: 12,
  },
  // 3. Headline Area Styles
  headlineArea: {
      paddingHorizontal: 16, // Padding inside container
      paddingBottom: 16, // Padding at the bottom
  },
  headline: {
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 24,
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

export default React.memo(ArticleCard);
