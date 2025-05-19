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
    TextLayoutLine,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust path if necessary

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Define the Props Interface (Matching Index.tsx feedData items) ---
interface MasterItem {
    // Core fields created in fetchContent
    type: 'tweet' | 'article' | 'unknown'; // Type determined by frontend logic
    id: string | number; // Consistent ID (Tweet_Link or Article ID)
    dateTime?: string | null; // Consistent date/time field

    // Fields likely coming directly from backend UNION query aliases
    author?: string | null;
    text_content?: string | null;
    media_url?: string | null;
    categories?: string | null;
    region?: string | null;
    Explanation?: string | null;

    // Tweet specific fields (might be null/undefined for articles)
    Retweets?: number | null;
    Favorites?: number | null;
    IsVerified?: boolean; // Assuming tweets might have this

    // Article specific fields (if needed beyond common ones)
    // e.g., authors if different from 'author', short_description, etc.
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
    const [imageLoading, setImageLoading] = useState<boolean>(false);
    const [imageError, setImageError] = useState<boolean>(false);
    const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(16 / 9); // Default aspect ratio
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
    };

    // Extract properties using the MasterCardProps['item'] structure
    const {
        type, // Use 'type' from frontend mapping
        id,   // Use 'id' from frontend mapping
        dateTime, // Use 'dateTime' from frontend mapping
        author = 'Unknown Source',
        text_content = '',
        media_url,
        Retweets,
        Favorites,
        IsVerified = false,
    } = item;

    const formattedTime = formatRelativeTime(dateTime);

    // --- Effects ---
    useEffect(() => {
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

    // --- Callbacks ---
    const handlePress = useCallback(() => { onPress(item); }, [onPress, item]);
    const handleImageLoadEnd = useCallback(() => setImageLoading(false), []);
    const handleImageError = useCallback(() => { setImageLoading(false); setImageError(true); }, []);
    const onTextLayout = useCallback((event: { nativeEvent: { lines: TextLayoutLine[] } }) => {
        if (!isExpanded && !showMoreButton && event.nativeEvent.lines.length > MAX_LINES_TEXT) {
            setShowMoreButton(true);
        }
    }, [isExpanded, showMoreButton]);
    const toggleTextExpansion = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(prev => !prev);
    }, []);

    // --- Icon Selection ---
    const TypeIcon = type === 'tweet'
        ? <Icon name="logo-twitter" size={16} color={colors.twitterColor} style={styles.typeIcon} />
        : <Icon name="newspaper-outline" size={16} color={colors.articleColor} style={styles.typeIcon} />;


    // @ts-ignore
    return (
        <TouchableOpacity
            style={[ styles.cardContainer, { backgroundColor: colors.background, borderColor: colors.separator } ]}
            onPress={handlePress}
            activeOpacity={0.8}
            accessible={true}
            accessibilityLabel={`${type === 'tweet' ? 'Tweet' : 'Article'} from ${author}. ${text_content.substring(0, 50)}...`}
            accessibilityRole="button"
        >
            {/* Header: Author/Source, Time, and Type Icon */}
            <View style={styles.headerContainer}>
                <View style={styles.authorTimeContainer}>
                    <View style={styles.authorLine}>
                        <Text style={[styles.authorText, { color: colors.authorText }]} numberOfLines={1}>
                            {author}
                        </Text>
                        {type === 'tweet' && IsVerified && (
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

            {/* Text Content (Tweet or Headline) */}
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
            {media_url && (
                <View style={styles.mediaContainer}>
                    {!imageError && imageAspectRatio ? (
                        <Image
                            source={{ uri: media_url }}
                            style={[styles.mediaImage, { aspectRatio: imageAspectRatio }]}
                            resizeMode="cover"
                            onLoadEnd={handleImageLoadEnd} // Only need end usually
                            onError={handleImageError}
                            accessible={true}
                            accessibilityLabel={type === 'tweet' ? "Image attached to tweet" : "Article lead image"}
                        />
                    ) : null }
                    {imageLoading && !imageError && imageAspectRatio && ( // Show loader only while loading AND aspect ratio is known
                        <View style={[StyleSheet.absoluteFill, styles.placeholderOverlay, { backgroundColor: colors.imagePlaceholder }]}>
                            <ActivityIndicator size="small" color={colors.accent} />
                        </View>
                    )}
                    {imageError && (
                        <View style={[styles.mediaImage, { aspectRatio: 16/9, backgroundColor: colors.imagePlaceholder }, styles.placeholderOverlay]}>
                            <Icon name={type === 'tweet' ? "cloud-offline-outline" : "image-outline"} size={40} color={colors.errorIcon} />
                        </View>
                    )}
                </View>
            )}


            {/* Footer for Tweet Engagements */}
            {type === 'tweet' && (Retweets != null || Favorites != null) && (
                <View style={[styles.footerContainer, { borderTopColor: colors.separator }]}>
                    {Retweets != null && Retweets > 0 && (
                        <Text style={[styles.engagementText, { color: colors.textSecondary }]}>
                            <Icon name="repeat-outline" size={14} color={colors.textSecondary} /> {Retweets}
                        </Text>
                    )}
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

// --- Styles ---
const styles = StyleSheet.create({
    cardContainer: {
        marginVertical: 6,
        marginHorizontal: 0, // Assuming parent has padding
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        overflow: 'hidden',
        // backgroundColor, borderColor added dynamically
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start', // Align items to the top
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 6,
    },
    authorTimeContainer: {
        flex: 1, // Take available space
        marginRight: 8, // Space before icon
    },
    authorLine: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 1,
    },
    authorText: {
        fontSize: 14,
        fontWeight: '600',
        marginRight: 4,
    },
    verifiedBadge: {
        marginLeft: 2,
        marginTop: 1, // Align vertically slightly better
    },
    dateText: {
        fontSize: 13,
    },
    typeIcon: { // Style for the new icon
        marginTop: 2, // Align vertically with author text roughly
    },
    contentContainer: {
        paddingHorizontal: 12,
        paddingTop: 4, // Reduced top padding
        paddingBottom: 12,
    },
    contentText: {
        fontSize: 15,
        lineHeight: 21,
        flexWrap: 'wrap',
    },
    mediaContainer: {
        width: '100%',
        marginTop: 4, // Add margin if text is above
    },
    mediaImage: {
        width: '100%',
        height: undefined,
    },
    placeholderOverlay: {
        // position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, // Keep if using absolute
        justifyContent: 'center',
        alignItems: 'center',
    },
    showMoreButton: {
        marginTop: 6,
        alignSelf: 'flex-start',
        paddingVertical: 2,
    },
    showMoreText: {
        fontSize: 14,
        fontWeight: '500',
    },
    footerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 10,
        paddingTop: 8, // More padding above footer
        marginTop: 4, // Space between content and footer
        borderTopWidth: StyleSheet.hairlineWidth,
        // borderColor set by theme
    },
    engagementText: {
        fontSize: 13,
        // color set by theme
    },
});

export default React.memo(MasterCard);