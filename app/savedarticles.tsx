// pages/SavedArticles.tsx
// This is the full, unabbreviated code for the SavedArticles component,
// with visual refinements for compactness and aesthetics, and Alert replaced.

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  // Alert removed
  ActivityIndicator,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  RefreshControl, // Added for consistency, though refresh logic isn't implemented here yet
  Modal, // Keep modal imports for viewing content
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust path if needed
import { ScrollContext } from '../app/ScrollContext'; // Shared context
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';
import TweetModal from './tweetpage'; // TweetModal component
import ArticleModal from './articlepage'; // ArticleModal component
import InAppMessage from '../components/ui/InAppMessage'; // Import InAppMessage

const { height, width } = Dimensions.get('window'); // Use width if needed for responsive sizing

// --- Configuration & Theming ---
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

// --- Responsive Sizing (Using compact base sizes) ---
const getResponsiveSize = (baseSize: number): number => {
  if (width < 350) return baseSize * 0.9;
  if (width < 400) return baseSize;
  return baseSize * 1.1;
};

// Define font sizes locally for this component if needed, or use a shared definition
const fontSizes = {
  small: getResponsiveSize(11),
  base: getResponsiveSize(13),
  medium: getResponsiveSize(15), // For titles/important text
  large: getResponsiveSize(18), // Header title size
};


const SavedArticles: React.FC = () => {
  // --- States ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [username, setUsername] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false); // State for pull-to-refresh

  // Modal states
  const [tweetModalVisible, setTweetModalVisible] = useState<boolean>(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [articleModalVisible, setArticleModalVisible] = useState<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

  // *** State for In-App Message ***
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
    },
    dark: {
      background: '#0A0A0A', cardBackground: '#1A1A1A', textPrimary: '#F9FAFB',
      textSecondary: '#9CA3AF', textTertiary: '#6B7280', accent: '#818CF8',
      accentContrast: '#FFFFFF', destructive: '#F87171', success: '#34D399',
      info: '#60A5FA', borderColor: '#374151', placeholder: '#374151',
    },
  };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;
  const styles = getStyles(currentTheme);

  // --- Utility Functions ---
  // *** Function to show In-App Message ***
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
  }, []);

  const formatToUTCA = (isoDate: string): string => {
    // Logic unchanged
    try {
        const date = new Date(isoDate);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}-${month}-${year}`;
    } catch {
        return 'Invalid Date';
    }
  };

  // --- Effects ---
  useEffect(() => {
    // Logic unchanged
    if (userToken) {
      fetchUsername();
    } else {
        setLoading(false);
        setError('Please log in to view saved items.');
        setArticlesAndTweets([]);
        setUsername('');
    }
  }, [userToken]);

  useEffect(() => {
    // Logic unchanged
    if (username) {
      fetchContent();
    } else if (!userToken) {
        setArticlesAndTweets([]);
        setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    // Logic unchanged
    setScrollToTop(() => () => {
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
        console.log('SavedArticles: Scrolling to top');
      }
    });
     return () => setScrollToTop(() => () => {});
  }, [setScrollToTop]);

  // --- Data Fetching ---
  const fetchUsername = async () => {
    // Logic unchanged
    if (!userToken) return;
    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken }),
      });
      const data = await response.json();
      if (data.status === 'Success' && data.username) {
        setUsername(data.username);
      } else {
        setUsername('');
        setError('Could not verify user.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('');
       setError('Failed to fetch user details.');
       setLoading(false);
    }
  };





      // --- Data Fetching (Corrected Article ID Handling) ---

      // Updated fetchArticleContent to accept string ID
      const fetchArticleContent = async (id: string): Promise<ContentData | null> => {
        console.log(`[fetchArticleContent] Fetching article with string ID: ${id}`); // DEBUG
        try {
          const response = await fetch(`${domaindynamo}/get-article-by-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Send the string ID directly in the body
            body: JSON.stringify({ id }),
          });
          if (!response.ok) throw new Error(`Error fetching article: ${response.statusText}`);
          const data = await response.json();
          if (data.status === 'Error') throw new Error(data.error || 'Failed to fetch article content');
          // Assuming data.data contains the article details
          return data.data;
        } catch (error: any) {
          console.error(`Error in fetchArticleContent (ID: ${id}): ${error.message}`);
          return null; // Return null on error
        }
      };

      // fetchTweetContent remains the same as it expects a string (link)
      const fetchTweetContent = async (link: string): Promise<ContentData | null> => {
        try {
          const response = await fetch(`${domaindynamo}/get-tweet-by-link`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link }),
          });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          if (data.status === 'Error' || !data.data) throw new Error(data.error || 'Failed to fetch tweet content');
          return data.data;
        } catch (error: any) {
          console.error(`Error in fetchTweetContent (${link}): ${error.message}`);
          return null;
        }
      };


      // Updated fetchContent to pass string ID for articles
      const fetchContent = async (isRefreshingData = false) => {
        if (!userToken || !username) {
          setError('User information is missing.');
          setLoading(!isRefreshingData);
          setIsRefreshing(false);
          return;
        }
        if (!isRefreshingData) {
            setLoading(true);
        }
        setError(null);
        console.log('[fetchContent] Starting fetch for user:', username);
        try {
          const response = await fetch(`${domaindynamo}/show-saved`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
          });

          console.log(`[fetchContent] /show-saved response status: ${response.status}`);

          if (!response.ok) {
              throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          console.log('[fetchContent] Raw data from /show-saved:', JSON.stringify(data, null, 2));

          if (data.status === 'Success' && Array.isArray(data.data)) {
              console.log(`[fetchContent] Found ${data.data.length} saved items.`);

              const detailedContentPromises = data.data.map(async (item: any) => {
                console.log('[fetchContent] Processing saved item:', item);

                if (!item || !item.type || !item.id) {
                    console.warn('[fetchContent] Invalid saved item structure, skipping:', item);
                    return null;
                }

                try {
                    if (item.type === 'article') {
                        // *** FIX: Pass the string ID directly, remove Number() conversion and isNaN check ***
                        console.log(`[fetchContent] Fetching details for article with string ID: ${item.id}`);
                        const contentData = await fetchArticleContent(item.id); // Pass string ID
                        console.log(`[fetchContent] Result for fetchArticleContent(${item.id}):`, contentData);
                        return contentData ? { ...item, content_data: contentData } : null;

                    } else if (item.type === 'tweet') {
                        // Logic for tweets remains the same (assuming item.id is the link)
                        console.log(`[fetchContent] Fetching details for tweet with Link/ID: ${item.id}`);
                        const contentData = await fetchTweetContent(item.id);
                        console.log(`[fetchContent] Result for fetchTweetContent(${item.id}):`, contentData);
                        return contentData ? { ...item, content_data: contentData } : null;
                    }
                } catch (detailError) {
                     console.error(`[fetchContent] Error fetching details for ${item.type} ${item.id}:`, detailError);
                     return null;
                }
                console.warn(`[fetchContent] Unknown item type: ${item.type}, skipping.`);
                return null;
              });

              const detailedContentResults = await Promise.all(detailedContentPromises);
              console.log('[fetchContent] Results after fetching details:', detailedContentResults);

              const validContent = detailedContentResults.filter(item => item !== null && item.content_data !== null);
              console.log(`[fetchContent] Valid content after filtering: ${validContent.length} items`);

              setArticlesAndTweets(validContent);

              if (validContent.length === 0 && data.data.length > 0) {
                  showInAppMessage("Could not load details for some saved items.", "error");
              }

          } else if (data.status === 'No saved content found') {
               console.log('[fetchContent] No saved content found from API.');
               setArticlesAndTweets([]);
          }
          else {
              throw new Error(data.message || 'Failed to fetch saved content');
          }
        } catch (err: any) {
          console.error('[fetchContent] CATCH block: Error fetching saved content:', err);
          setError(err.message || 'An unexpected error occurred');
          setArticlesAndTweets([]);
        } finally {
          console.log('[fetchContent] Fetch finished. Setting loading states to false.');
          setLoading(false);
          setIsRefreshing(false);
        }
      }; // End of fetchContent

  // --- Pull to Refresh Handler ---
   const onRefresh = useCallback(async () => {
        if (!username || username === 'Guest') {
            setIsRefreshing(false);
            return;
        }
        console.log("Refreshing saved items...");
        setIsRefreshing(true);
        await fetchContent(true); // Pass true to indicate refresh
    }, [username]); // Depend on username


  // --- Event Handlers (Replaced Alert) ---
  const handleContentPress = (item: any) => {
    if (!item?.content_data) {
         // Use InAppMessage instead of Alert
         showInAppMessage('Content details are missing.', 'error');
         return;
    }

    if (item.type === 'tweet') {
      if (!userToken) {
          showInAppMessage('Please log in to view tweets.', 'info');
          return;
      }
      const link = item.content_data?.Tweet_Link;
      if (link) {
        setSelectedTweetLink(link);
        setTweetModalVisible(true);
      } else {
          showInAppMessage('Invalid tweet data.', 'error');
      }

    } else if (item.type === 'article') {
      if (!userToken) {
          showInAppMessage('Please log in to view articles.', 'info');
          return;
      }
      const id = item.content_data?.id;
      if (id) {
        // Ensure id is number if ArticleModal expects number
        setSelectedArticleId(id);
        setArticleModalVisible(true);
      } else {
          showInAppMessage('Invalid article data.', 'error');
      }
    }
  };

  // --- Render Functions ---
  const renderContentCard = ({ item }: { item: any }) => {
     // Logic unchanged
    if (!item?.content_data) {
        return null; // Don't render items that failed to load details
    }

    if (item.type === 'article') {
      return (
        <ArticleCard
          item={item.content_data}
          onPress={() => handleContentPress(item)}
          // Pass theme via context preferably
        />
      );
    } else if (item.type === 'tweet') {
      return (
        <TweetCard
          item={item.content_data}
          onPress={() => handleContentPress(item)}
          // Pass theme via context preferably
        />
      );
    }
    return null;
  };

  const renderEmptyListComponent = () => (
      // Uses refined styles
      <View style={styles.emptyContainer}>
          <Icon name="bookmark-outline" size={50} color={currentTheme.textTertiary} />
          <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>
              No Saved Items Yet
          </Text>
          <Text style={[styles.emptySubText, { color: currentTheme.textTertiary }]}>
              Save articles and tweets to find them here later.
          </Text>
      </View>
  );

  // --- Main Render ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {/* Refined Header */}
      <View style={[styles.header, { borderBottomColor: currentTheme.borderColor }]}>
         <Icon name="bookmark" size={22} color={currentTheme.textPrimary} style={styles.headerIcon} />
        <Text style={[styles.headerTitle, { color: currentTheme.textPrimary }]}>
          Saved Items
        </Text>
      </View>

        {/* Conditional Rendering for Loading/Error/List */}
        {loading ? (
             <View style={styles.centered}>
                <ActivityIndicator size="large" color={currentTheme.accent} />
                <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>Loading Saved Items...</Text>
            </View>
        ) : error ? (
             <View style={styles.centered}>
                 <Icon name="cloud-offline-outline" size={50} color={currentTheme.textTertiary} />
                <Text style={[styles.errorText, { color: currentTheme.destructive }]}>Error: {error}</Text>
                 <Text style={[styles.emptySubText, { color: currentTheme.textTertiary, marginTop: 10 }]}>
                     Please check your connection or try again later.
                </Text>
                 {/* Optional: Add a retry button here */}
                 <TouchableOpacity
                    style={[styles.retryButton, { borderColor: currentTheme.accent }]}
                    onPress={() => username ? fetchContent() : fetchUsername()} // Retry fetching content or username
                    disabled={loading || isRefreshing}
                 >
                    <Text style={[styles.retryButtonText, { color: currentTheme.accent }]}>Try Again</Text>
                 </TouchableOpacity>
            </View>
        ) : (
             <FlatList
                ref={flatListRef}
                data={articlesAndTweets}
                renderItem={renderContentCard}
                keyExtractor={(item, index) => `${item.type}-${item.id || index}`}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={renderEmptyListComponent}
                // Add Pull to Refresh
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={currentTheme.accent}
                        colors={[currentTheme.accent]}
                        progressBackgroundColor={currentTheme.cardBackground}
                    />
                }
            />
        )}


      {/* Render Modals */}
      <ArticleModal
        visible={articleModalVisible}
        onClose={() => setArticleModalVisible(false)}
        articleId={selectedArticleId}
      />
      <TweetModal
        visible={tweetModalVisible}
        onClose={() => setTweetModalVisible(false)}
        tweetLink={selectedTweetLink}
      />
      {/* In-App Message Display */}
       <InAppMessage
            visible={messageVisible}
            message={messageText}
            type={messageType}
            onClose={() => setMessageVisible(false)}
        />
    </SafeAreaView>
  );
};

export default SavedArticles;

// ------------------------------------------------------
// STYLES (Refined for Compactness & Aesthetics)
// ------------------------------------------------------
const getStyles = (currentTheme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: { // Refined centered container
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20, // Reduced padding
  },
  loadingText: {
    marginTop: 12, // Reduced margin
    fontSize: fontSizes.base, // Reduced font size
    color: currentTheme.textSecondary,
  },
  errorText: {
    fontSize: fontSizes.medium, // Reduced font size
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    color: currentTheme.destructive,
  },
  header: { // Refined header
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12, // Reduced padding
    paddingBottom: 10, // Reduced padding
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: currentTheme.borderColor,
  },
  headerIcon: {
      marginRight: 8,
  },
  headerTitle: {
    fontSize: fontSizes.large, // Reduced font size
    fontWeight: 'bold',
    color: currentTheme.textPrimary,
  },
  listContainer: {
    paddingTop: 6, // Reduced padding
    paddingHorizontal: 0, // Let cards handle margin
    paddingBottom: 100,
  },
  // Empty List Styles (Refined)
  emptyContainer: {
      flex: 1, // Allow filling space
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
      marginTop: height * 0.1, // Reduced margin
      minHeight: 200, // Ensure minimum height
  },
  emptyText: {
      fontSize: fontSizes.medium, // Reduced font size
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 15, // Keep some margin
      marginBottom: 5,
      color: currentTheme.textSecondary,
  },
  emptySubText: {
      fontSize: fontSizes.base, // Reduced font size
      textAlign: 'center',
      color: currentTheme.textTertiary,
      lineHeight: fontSizes.base * 1.4,
  },
  retryButton: { // Style for retry button in error state
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: currentTheme.accent,
  },
  retryButtonText: {
      fontSize: fontSizes.button,
      fontWeight: '600',
      color: currentTheme.accent,
  },
});
