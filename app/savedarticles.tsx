// pages/SavedArticles.tsx (Complete Code: MasterCard + Tweets/Bluesky Filter Only)

import React, {
    useState,
    useEffect,
    useContext,
    useRef,
    useCallback,
    useMemo, // Keep for filtering
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  // Modal is used implicitly by TweetModal
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';

// Contexts
import { UserContext } from '../app/UserContext'; // Adjust path if needed
import { ScrollContext } from '../app/ScrollContext'; // Adjust path if needed

// Components
import MasterCard from '../components/MasterCard'; // *** IMPORT MASTERCARD ***
import TweetModal from './tweetpage'; // Keep TweetModal component
// ArticleModal removed
import InAppMessage from '../components/ui/InAppMessage'; // Keep InAppMessage

const { height, width } = Dimensions.get('window');

// --- Configuration & Theming ---
import Constants from 'expo-constants';

// --- Environment Variable Validation ---
const domaindynamo = Constants.expoConfig?.extra?.API_URL as string;
if (!domaindynamo) {
    throw new Error("Required environment variable API_URL is not set.");
}

// --- Responsive Sizing ---
const getResponsiveSize = (baseSize: number): number => {
  if (width < 350) return baseSize * 0.9;
  if (width < 400) return baseSize;
  return baseSize * 1.1;
};
const fontSizes = {
    small: getResponsiveSize(11),
    base: getResponsiveSize(13),
    medium: getResponsiveSize(15),
    large: getResponsiveSize(18),
    button: getResponsiveSize(14),
};

// --- Type Definitions ---
// Define structure expected from fetchTweetContent (for both tweets/bluesky)
interface ContentData {
    id?: string | number;
    Tweet_Link?: string; // Tweet Link / Bluesky URI
    Username?: string;
    Tweet?: string;
    Created_At?: string; // ISO Date String
    Media_URL?: string;
    Retweets?: number;
    Favorites?: number;
    categories?: string; // Subcategory assigned by scraper
    Region?: string;
    Explanation?: string;
    IsVerified?: boolean;
    // Add any other specific fields returned by your /get-tweet-by-link endpoint
}

// Define the structure stored in savedItems state
interface SavedItem {
    id: string; // The saved ID (Tweet Link or Bluesky URI)
    type: 'tweet' | 'bluesky'; // Only allow these types now
    content_data: ContentData | null; // Detailed content fetched later
    saved_at?: string;
}

// Define the structure needed by MasterCard component's 'item' prop
interface MasterItem {
  type: 'tweet' | 'article' | 'bluesky' | 'unknown'; // Keep 'article'/'unknown' for prop type safety
  id: string | number;
  dateTime?: string | null;
  author?: string | null;
  text_content?: string | null;
  media_url?: string | null;
  categories?: string | null;
  region?: string | null;
  Explanation?: string | null;
  Retweets?: number | null;
  Favorites?: number | null;
  IsVerified?: boolean;
  like_count?: number | null;
  repost_count?: number | null;
}

// --- Component ---
const SavedArticles: React.FC = () => {
  // --- States ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]); // Use SavedItem type
  const [username, setUsername] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter State (Only All, Tweets, Bluesky)
  const [filterType, setFilterType] = useState<'All' | 'Tweets' | 'Bluesky'>('All');

  // Modal states (Only TweetModal needed)
  const [tweetModalVisible, setTweetModalVisible] = useState<boolean>(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);

  // In-App Message State
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  // --- Hooks ---
  const router = useRouter();
  const { userToken, isDarkTheme } = useContext(UserContext);
  const { setScrollToTop } = useContext(ScrollContext);
  const flatListRef = useRef<FlatList>(null);

  // --- Theming ---
   const themes = {
    light: {
      background: '#F8F9FA', cardBackground: '#FFFFFF', textPrimary: '#1F2937',
      textSecondary: '#6B7280', textTertiary: '#9CA3AF', accent: '#6366F1',
      accentContrast: '#FFFFFF', destructive: '#EF4444', success: '#10B981',
      info: '#3B82F6', borderColor: '#E5E7EB', placeholder: '#E5E7EB',
      filterButtonBg: '#E5E7EB', filterButtonText: '#374151',
      filterButtonActiveBg: '#6366F1', filterButtonActiveText: '#FFFFFF',
    },
    dark: {
      background: '#0A0A0A', cardBackground: '#1A1A1A', textPrimary: '#F9FAFB',
      textSecondary: '#9CA3AF', textTertiary: '#6B7280', accent: '#818CF8',
      accentContrast: '#FFFFFF', destructive: '#F87171', success: '#34D399',
      info: '#60A5FA', borderColor: '#374151', placeholder: '#374151',
      filterButtonBg: '#374151', filterButtonText: '#D1D5DB',
      filterButtonActiveBg: '#818CF8', filterButtonActiveText: '#FFFFFF',
    },
  };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;
  const styles = getStyles(currentTheme); // Generate styles based on theme

  // --- Utility Functions ---
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text); setMessageType(type); setMessageVisible(true);
  }, []);

  // --- Effects ---
  useEffect(() => {
    if (userToken) {
      fetchUsername();
    } else {
        setLoading(false);
        setError('Please log in to view saved items.');
        setSavedItems([]);
        setUsername('');
    }
  }, [userToken]);

  useEffect(() => {
    if (username) {
      fetchContent();
    } else if (!userToken) {
        // Only clear if definitely logged out, not just username fetch pending
        setSavedItems([]);
        setLoading(false);
    }
  }, [username]); // Re-fetch if username changes (e.g., after login)

  useEffect(() => {
    setScrollToTop(() => () => {
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    });
     // Cleanup function
     return () => setScrollToTop(() => () => {});
  }, [setScrollToTop]);

  // --- Data Fetching ---
  const fetchUsername = async () => {
    if (!userToken) return;
    setLoading(true); // Show loading while fetching username initially
    setError(null);
    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken }),
      });
      const data = await response.json();
      if (data.status === 'Success' && data.username) {
        setUsername(data.username);
        // fetchContent will be called by the useEffect watching username
      } else {
        setUsername('');
        // Don't set error here if token is just invalid, let logged-out state handle it
        if (!response.ok || data.status !== 'Success') {
             setError('Could not verify user.');
        }
         setLoading(false); // Stop loading if username fetch fails but token exists
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('');
      setError('Failed to fetch user details.');
      setLoading(false);
    }
  };

  // Only fetchTweetContent remains (assuming it handles bluesky URIs too via backend)
  const fetchTweetContent = async (link: string): Promise<ContentData | null> => {
    // Fetches details for BOTH tweets and bluesky posts using their link/URI
    try {
      const response = await fetch(`${domaindynamo}/get-tweet-by-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link }), // Send the link/URI as 'link'
      });
      if (!response.ok) throw new Error(`HTTP error fetching details for ${link}! status: ${response.status}`);
      const data = await response.json();
      // Check if data *or* data.data is null/undefined before accessing properties
      if (data.status === 'Error' || !data.data) {
          console.warn(`Failed to fetch content details for ${link}: ${data.error || 'No data returned'}`);
          throw new Error(data.error || 'Failed to fetch content details');
      }
      return data.data;
    } catch (error: any) {
      console.error(`Error in fetchTweetContent (${link}): ${error.message}`);
      return null; // Return null specifically on error
    }
  };

  // fetchContent adjusted to ONLY fetch tweets/bluesky
  const fetchContent = async (isRefreshingData = false) => {
    if (!userToken || !username) {
      setError('User information is missing.');
      if(!isRefreshingData) setLoading(false);
      setIsRefreshing(false);
      return;
    }
    if (!isRefreshingData) setLoading(true);
    setError(null);
    console.log('[SavedItems:fetchContent] Starting fetch for user:', username);
    try {
      const response = await fetch(`${domaindynamo}/show-saved`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      console.log(`[SavedItems:fetchContent] /show-saved status: ${response.status}`);
      if (!response.ok) throw new Error(`Server error fetching saved items: ${response.status} ${response.statusText}`);
      const data = await response.json();
      console.log('[SavedItems:fetchContent] Raw data from /show-saved:', JSON.stringify(data, null, 2));

      if (data.status === 'Success' && Array.isArray(data.data)) {
          // Filter out non-tweet/bluesky items first
          const tweetAndBlueskyItems = data.data.filter((item: any) =>
              item && (item.type === 'tweet' || item.type === 'bluesky') && item.id
          );
          console.log(`[SavedItems:fetchContent] Found ${tweetAndBlueskyItems.length} saved tweets/bluesky items.`);

          if (tweetAndBlueskyItems.length === 0) {
               setSavedItems([]); // Clear list if no relevant items saved
               console.log('[SavedItems:fetchContent] No relevant saved items found.');
               // Optionally show a message if data.data had items but none were tweets/bluesky
               if(data.data.length > 0) {
                   showInAppMessage("No saved Tweets or Bluesky posts found.", "info");
               }
               return; // Exit early
          }

          // Fetch details concurrently
          const detailedContentPromises = tweetAndBlueskyItems.map(async (item: any): Promise<SavedItem | null> => {
            try {
                const contentData = await fetchTweetContent(String(item.id)); // Use ID (link/uri)
                // Return the full structure needed for state, even if content fetch failed
                return {
                    id: item.id,
                    type: item.type as ('tweet' | 'bluesky'),
                    content_data: contentData, // Will be null if fetchTweetContent failed
                    saved_at: item.saved_at // Pass through saved_at if backend provides it
                };
            } catch (detailError) {
                // Log error but still return structure with null data
                console.error(`[SavedItems:fetchContent] Error processing details for ${item.type} ${item.id}:`, detailError);
                return { id: item.id, type: item.type as ('tweet' | 'bluesky'), content_data: null, saved_at: item.saved_at };
            }
          });

          const detailedContentResults = await Promise.all(detailedContentPromises);

          // Filter out items where content fetching failed *entirely* (returned null)
          // Keep items where content_data is null if you want to show a "failed to load" card state later
          // For simplicity now, let's only keep items where content_data is successfully fetched
          const validContent = detailedContentResults.filter((item): item is SavedItem => item !== null && item.content_data !== null);

          console.log(`[SavedItems:fetchContent] Valid content after detail fetch: ${validContent.length} items`);
          setSavedItems(validContent); // Set the state with successfully fetched items

          // Check if some detail fetches failed among the relevant items
          if (validContent.length < tweetAndBlueskyItems.length) {
              showInAppMessage("Could not load details for some saved items.", "error");
          }

      } else if (data.status === 'No saved content found') {
           console.log('[SavedItems:fetchContent] API reported no saved content found.');
           setSavedItems([]); // Ensure list is empty
      } else {
          // Handle other potential error statuses from /show-saved
          throw new Error(data.message || 'Failed to fetch saved content');
      }
    } catch (err: any) {
      console.error('[SavedItems:fetchContent] CATCH block:', err);
      setError(err.message || 'An unexpected error occurred');
      setSavedItems([]); // Clear list on error
    } finally {
      console.log('[SavedItems:fetchContent] Fetch finished.');
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // --- Pull to Refresh Handler ---
   const onRefresh = useCallback(async () => {
        if (!username || loading || isRefreshing) { // Prevent multiple refreshes
            return;
        }
        console.log("Refreshing saved items...");
        setIsRefreshing(true);
        await fetchContent(true); // Pass true to indicate refresh
    }, [username, loading, isRefreshing]); // Add loading/isRefreshing dependency

 // --- Filtering Logic (Corrected Comparison) ---
   const filteredContent = useMemo(() => {
     // console.log('Filtering Saved Items Data:', JSON.stringify(savedItems, null, 2)); // Keep temporarily if needed

     if (filterType === 'All') {
       return savedItems;
     }

     // --- Start Fix ---
     // Compare item.type directly with the expected singular, lowercase strings
     if (filterType === 'Tweets') {
         return savedItems.filter(item => item.type.toLowerCase() === 'tweet'); // Check for 'tweet'
     }
     if (filterType === 'Bluesky') {
         return savedItems.filter(item => item.type.toLowerCase() === 'bluesky'); // Check for 'bluesky'
     }
     // --- End Fix ---

     // Fallback if filterType is somehow unexpected (shouldn't happen)
     return [];
   }, [savedItems, filterType]);

  // --- Event Handlers ---
  const handleContentPress = (item: SavedItem) => {
    // Only handles tweet/bluesky, opens TweetModal for both
    // No need to check content_data here, as renderContentCard wouldn't render if it was null
    if (item.type === 'tweet' || item.type === 'bluesky') {
        if (!userToken) { showInAppMessage('Please log in.', 'info'); return; }
        const link = String(item.id); // ID is the link/uri
        if (link) {
            setSelectedTweetLink(link);
            setTweetModalVisible(true);
        } else {
            showInAppMessage(`Invalid ${item.type} data.`, 'error');
        }
    }
  };

  // --- Render Functions ---
  // Renders MasterCard by mapping SavedItem data
  const renderContentCard = ({ item }: { item: SavedItem }) => {
    // content_data should be present due to filtering in fetchContent
    if (!item?.content_data) {
      return null;
    }

    // Map data from item.content_data and item.type to MasterItem format
    // Explicitly type the object being created
    const mappedItem: MasterItem = {
        type: item.type, // 'tweet' or 'bluesky'
        id: item.id,
        dateTime: item.content_data.Created_At || null, // Use the fetched creation time
        author: item.content_data.Username || 'Unknown Author',
        text_content: item.content_data.Tweet || '',
        media_url: item.content_data.Media_URL || null,
        categories: item.content_data.categories || null,
        region: item.content_data.Region || null,
        Explanation: item.content_data.Explanation || null,
        Retweets: item.content_data.Retweets ?? 0, // Default to 0 if null/undefined
        Favorites: item.content_data.Favorites ?? 0, // Default to 0 if null/undefined
        IsVerified: item.content_data.IsVerified ?? false, // Default to false
        like_count: item.content_data.Favorites ?? 0, // Compatibility field
        repost_count: item.content_data.Retweets ?? 0, // Compatibility field
    };

    return (
      <MasterCard
        item={mappedItem}
        onPress={() => handleContentPress(item)} // Pass the original SavedItem wrapper
      />
    );
  };

  // Empty component for when *filtered* list is empty
   const renderFilteredEmptyComponent = () => (
      <View style={styles.emptyContainer}>
          <Icon name="filter-outline" size={50} color={currentTheme.textTertiary} />
          <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>
              No Saved {filterType} Found
          </Text>
           <Text style={[styles.emptySubText, { color: currentTheme.textTertiary }]}>
               Try selecting 'All' or saving more items of this type.
          </Text>
      </View>
  );

   // Empty component for when *no* saved items exist at all
   const renderEmptyListComponent = () => (
       <View style={styles.emptyContainer}>
           <Icon name="bookmark-outline" size={50} color={currentTheme.textTertiary} />
           <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>
               No Saved Items Yet
           </Text>
           <Text style={[styles.emptySubText, { color: currentTheme.textTertiary }]}>
               Save tweets and Bluesky posts to find them here later.
           </Text>
       </View>
   );


  // --- Main Render ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: currentTheme.borderColor }]}>
         <Icon name="bookmark" size={22} color={currentTheme.textPrimary} style={styles.headerIcon} />
        <Text style={[styles.headerTitle, { color: currentTheme.textPrimary }]}>
          Saved Items
        </Text>
      </View>

        {/* --- Filter Buttons (Tweets/Bluesky only) --- */}
        <View style={[styles.filterContainer, { borderBottomColor: currentTheme.borderColor }]}>
             {(['All', 'Tweets', 'Bluesky'] as const).map((type) => { // Articles removed
                 const isActive = filterType === type;
                 return (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.filterButton,
                            isActive ? { backgroundColor: currentTheme.filterButtonActiveBg } : { backgroundColor: currentTheme.filterButtonBg }
                        ]}
                        onPress={() => setFilterType(type)}
                        accessibilityLabel={`Filter by ${type}`}
                        accessibilityState={{ selected: isActive }}
                    >
                        <Text style={[
                            styles.filterButtonText,
                             isActive ? { color: currentTheme.filterButtonActiveText } : { color: currentTheme.filterButtonText }
                        ]}>
                            {type}
                        </Text>
                    </TouchableOpacity>
                 );
            })}
        </View>

        {/* Conditional Rendering for Loading/Error/List */}
        {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={currentTheme.accent} /><Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>Loading...</Text></View>
        ) : error ? (
            <View style={styles.centered}>
                 <Icon name="cloud-offline-outline" size={50} color={currentTheme.textTertiary} />
                <Text style={[styles.errorText, { color: currentTheme.destructive }]}>Error: {error}</Text>
                 <Text style={[styles.emptySubText, { color: currentTheme.textTertiary, marginTop: 10 }]}>Please try again later.</Text>
                 <TouchableOpacity style={[styles.retryButton, { borderColor: currentTheme.accent }]} onPress={onRefresh} disabled={loading || isRefreshing}>
                    <Text style={[styles.retryButtonText, { color: currentTheme.accent }]}>Try Again</Text>
                 </TouchableOpacity>
            </View>
        ) : (
             <FlatList
                ref={flatListRef}
                data={filteredContent} // Use filtered data
                renderItem={renderContentCard} // Use MasterCard renderer
                keyExtractor={(item, index) => `${item.type}-${item.id || index}`}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={savedItems.length === 0 ? renderEmptyListComponent : renderFilteredEmptyComponent}
                refreshControl={ <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={currentTheme.accent} colors={[currentTheme.accent]} progressBackgroundColor={currentTheme.cardBackground} /> }
            />
        )}

      {/* Modals (Only TweetModal) */}
      <TweetModal visible={tweetModalVisible} onClose={() => setTweetModalVisible(false)} tweetLink={selectedTweetLink} />
      <InAppMessage visible={messageVisible} message={messageText} type={messageType} onClose={() => setMessageVisible(false)} />
    </SafeAreaView>
  );
};

export default SavedArticles;

// ------------------------------------------------------
// STYLES (Simplified)
// ------------------------------------------------------
const getStyles = (currentTheme: any) => StyleSheet.create({
  container: { flex: 1, },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, },
  loadingText: { marginTop: 12, fontSize: fontSizes.base, color: currentTheme.textSecondary, },
  errorText: { fontSize: fontSizes.medium, fontWeight: '600', textAlign: 'center', marginBottom: 8, color: currentTheme.destructive, },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 8 : 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: currentTheme.borderColor, },
  headerIcon: { marginRight: 8, },
  headerTitle: { fontSize: fontSizes.large, fontWeight: 'bold', color: currentTheme.textPrimary, },
  filterContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: currentTheme.borderColor, },
  filterButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', },
  filterButtonText: { fontSize: fontSizes.base, fontWeight: '500', textAlign: 'center', },
  listContainer: { paddingTop: 6, paddingHorizontal: 10, paddingBottom: 100, },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: height * 0.1, minHeight: 250, },
  emptyText: { fontSize: fontSizes.medium, fontWeight: '600', textAlign: 'center', marginTop: 15, marginBottom: 5, color: currentTheme.textSecondary, },
  emptySubText: { fontSize: fontSizes.base, textAlign: 'center', color: currentTheme.textTertiary, lineHeight: fontSizes.base * 1.4, },
  retryButton: { marginTop: 20, paddingHorizontal: 25, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: currentTheme.accent, },
  retryButtonText: { fontSize: fontSizes.button, fontWeight: '600', color: currentTheme.accent, },
});