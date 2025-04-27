// app/repostFeed.tsx
// This is the full, unabbreviated code for the RepostFeedPage component,
// with styling refinements for compactness and improved aesthetics.

import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  TouchableOpacity,
  SafeAreaView, // Keep import if needed, though component uses View
  Platform,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust path if needed
import TweetCard from '../components/TweetCard'; // Use redesigned card
import ArticleCard from '../components/ArticleCard'; // Use redesigned card
import { useRouter } from 'expo-router';
import TweetModal from './tweetpage'; // Assuming path
import ArticleModal from './articlepage'; // Assuming path
import InAppMessage from '../components/ui/InAppMessage'; // Import InAppMessage

const { height, width } = Dimensions.get('window'); // Keep width import

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

// --- Interfaces ---
interface ApiResponse<T> {
  status: 'Success' | 'Error';
  data?: T;
  message?: string;
  error?: string;
}

interface ContentData {
    id?: number | string;
    Tweet_Link?: string;
    // Add other common fields if necessary
}

interface SearchResult {
  type: 'article' | 'tweet';
  content_id: string;
  time: string; // Original share time?
  username: string; // Who shared it
  shared_at: string; // When it was shared
  content_type: 'article' | 'tweet';
  content_data?: ContentData | null;
  profile_picture?: string;
}

// --- Responsive Sizing (Kept compact base sizes) ---
const getResponsiveSize = (baseSize: number): number => {
  if (width < 350) return baseSize * 0.9;
  if (width < 400) return baseSize;
  return baseSize * 1.1;
};

const fontSizes = {
  small: getResponsiveSize(11),
  base: getResponsiveSize(13),
  medium: getResponsiveSize(15), // Used for feedback text
  button: getResponsiveSize(14), // Used for retry button
};

// --- Default Placeholder (Adjusted size) ---
const defaultPFP = 'https://via.placeholder.com/32/cccccc/969696?text=User'; // Smaller placeholder

// --- Component ---
const RepostFeedPage: React.FC = () => {
  // --- State ---
  const [sharedContent, setSharedContent] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tweetModalVisible, setTweetModalVisible] = useState<boolean>(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [articleModalVisible, setArticleModalVisible] = useState<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<number | string | null>(null);
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  // --- Hooks ---
  const { userToken, isDarkTheme } = useContext(UserContext);
  const router = useRouter();

  // --- Theming ---
   const themes = {
    light: {
      background: '#F8F9FA', cardBackground: '#FFFFFF', textPrimary: '#1F2937',
      textSecondary: '#6B7280', textTertiary: '#9CA3AF', accent: '#6366F1',
      accentContrast: '#FFFFFF', destructive: '#EF4444', success: '#10B981',
      info: '#3B82F6', borderColor: '#E5E7EB', placeholder: '#E5E7EB',
      inputBackground: '#FFFFFF', destructiveContrast: '#FFFFFF',
      successContrast: '#FFFFFF', infoContrast: '#FFFFFF',
      buttonSecondaryBackground: '#E5E7EB', buttonSecondaryText: '#374151',
    },
    dark: {
      background: '#0A0A0A', cardBackground: '#1A1A1A', textPrimary: '#F9FAFB',
      textSecondary: '#9CA3AF', textTertiary: '#6B7280', accent: '#818CF8',
      accentContrast: '#FFFFFF', destructive: '#F87171', success: '#34D399',
      info: '#60A5FA', borderColor: '#374151', placeholder: '#374151',
      inputBackground: '#1F2937', destructiveContrast: '#FFFFFF',
      successContrast: '#111827', infoContrast: '#111827',
      buttonSecondaryBackground: '#374151', buttonSecondaryText: '#D1D5DB',
    },
  };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;
  // Generate styles with the current theme
  const styles = getStyles(currentTheme);

  // --- Helper Functions ---
   const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
  }, []);

  const formatRelativeTime = (isoDate?: string): string => {
     if (!isoDate) return '';
    try {
        const date = new Date(isoDate);
        const now = new Date();
        const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
        const diffMinutes = Math.round(diffSeconds / 60);
        const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffSeconds < 5) return 'now';
        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return 'Invalid Date'; }
  };

  // --- Effects ---
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userToken) {
        setUsername('Guest');
        setLoading(false);
        setError("Please log in to view shared content.");
        setSharedContent([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const usernameResponse = await fetch(`${domaindynamo}/get-username`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken }),
        });
        const usernameData = await usernameResponse.json();
        console.log('RepostFeed: Username fetched:', usernameData);
        if (usernameResponse.ok && usernameData.status === 'Success' && usernameData.username) {
            const currentUsername = usernameData.username;
            setUsername(currentUsername);
            await fetchSharedContent(currentUsername);
        } else {
             setUsername('Guest');
             setError(usernameData.message || "Could not verify user session.");
             setSharedContent([]);
             setLoading(false);
        }
      } catch (err: any) {
        console.error('RepostFeed: Error fetching username:', err);
        setUsername('Guest');
        setError(`Error fetching user: ${err.message}`);
        setSharedContent([]);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userToken]);

  // --- Data Fetching ---
  const fetchUserProfilePicture = async (user: string): Promise<string> => {
    if (!user) return defaultPFP;
    try {
      const response = await fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(user)}`);
      const data = await response.json();
      if (response.ok && data.status === 'Success' && data.profile_picture) {
        return data.profile_picture;
      } else {
        return defaultPFP;
      }
    } catch (error) {
      console.error(`Error fetching profile picture for ${user}:`, error);
      return defaultPFP;
    }
  };

  const fetchSharedContent = async (user: string) => {
     setError(null);
     setSharedContent([]);
    try {
      console.log(`Fetching shared content for ${user}...`);
      const response = await fetch(`${domaindynamo}/get_shared_content`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: user }),
      });

      const data = await response.json();
      console.log('Raw shared content data:', data);

      if (!response.ok) { throw new Error(data.message || `Server error: ${response.status}`); }
      if (!data.shared_content || !Array.isArray(data.shared_content)) {
          console.warn('Shared content data is missing or not an array:', data);
          setSharedContent([]);
          setLoading(false);
          return;
      }
       if (data.shared_content.length === 0) {
           setSharedContent([]);
           setError(null);
           setLoading(false);
           return;
       }

      const validItems = data.shared_content.filter((item: any) => item.content_id && item.username && item.content_type && item.shared_at);

      const detailedContentPromises = validItems.map(async (item: any) => {
        const profile_picture = await fetchUserProfilePicture(item.username);
        let contentData = null;
        try {
            if (item.content_type === 'article') {
                contentData = await fetchArticleContent(item.content_id);
            } else if (item.content_type === 'tweet') {
                contentData = await fetchTweetContent(item.content_id);
            }
        } catch (fetchError) {
             console.error(`Failed to fetch details for ${item.content_type} ID ${item.content_id}:`, fetchError);
        }
        return { ...item, content_data: contentData, profile_picture };
      });

      const detailedContent = await Promise.all(detailedContentPromises);
      console.log('Detailed shared content:', detailedContent);

      const successfullyFetchedContent = detailedContent.filter(item => item.content_data !== null);
      if (successfullyFetchedContent.length < detailedContent.length) {
          console.warn("Some shared items could not be loaded.");
          // showInAppMessage("Some shared items could not be loaded.", "info");
      }

      successfullyFetchedContent.sort((a, b) => new Date(b.shared_at).getTime() - new Date(a.shared_at).getTime());

      setSharedContent(successfullyFetchedContent);

    } catch (err: any) {
      console.error('Error fetching shared content:', err);
      setError(err.message || 'Error fetching shared content');
      setSharedContent([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticleContent = async (id: number | string): Promise<ContentData | null> => {
    try {
      const response = await fetch(`${domaindynamo}/get-article-by-id`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.status === 'Error' || !data.data) throw new Error(data.error || 'Failed to fetch article content');
      return data.data;
    } catch (error: any) {
      console.error(`Error in fetchArticleContent (${id}): ${error.message}`);
      return null;
    }
  };

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

  // --- Action Handlers ---
  const handleArticlePress = (articleData: ContentData | null) => {
    if (!userToken) { showInAppMessage('Login required to view articles.', 'info'); return; }
    if (articleData?.id) {
        setSelectedArticleId(articleData.id);
        setArticleModalVisible(true);
    } else {
        showInAppMessage('Could not open article details.', 'error');
    }
  };

  const handleTweetPress = (tweetData: ContentData | null) => {
    if (!userToken) { showInAppMessage('Login required to view tweets.', 'info'); return; }
    if (tweetData?.Tweet_Link) {
        setSelectedTweetLink(tweetData.Tweet_Link);
        setTweetModalVisible(true);
    } else {
         showInAppMessage('Could not open tweet details.', 'error');
    }
  };

  // --- Render Logic ---
  const renderContentCard = ({ item }: { item: SearchResult }) => {
    // Render placeholder if content fetching failed
    if (!item.content_data) {
      return (
         <View style={styles.sharedItemContainer}>
            <View style={styles.sharerInfoContainer}>
               <Image source={{ uri: item.profile_picture || defaultPFP }} style={styles.sharerPfp} />
               <View style={styles.sharerTextContainer}>
                 <Text style={[styles.sharerName, { color: currentTheme.textPrimary }]} numberOfLines={1}>{item.username}</Text>
                 <Text style={[styles.shareTime, { color: currentTheme.textSecondary }]}>Shared {formatRelativeTime(item.shared_at)}</Text>
               </View>
            </View>
            <View style={styles.failedItemPlaceholder}>
                <Icon name="alert-circle-outline" size={22} color={currentTheme.textTertiary} />
                <Text style={[styles.failedItemText, { color: currentTheme.textTertiary }]}>Content Unavailable</Text>
            </View>
         </View>
      );
    }

    // Render redesigned container + original card
    return (
      <View style={styles.sharedItemContainer}>
        {/* Sharer Info Header */}
        <View style={styles.sharerInfoContainer}>
          <Image source={{ uri: item.profile_picture || defaultPFP }} style={styles.sharerPfp} />
          <View style={styles.sharerTextContainer}>
            <Text style={[styles.sharerName, { color: currentTheme.textPrimary }]} numberOfLines={1}>
              {item.username}
            </Text>
            <Text style={[styles.shareTime, { color: currentTheme.textSecondary }]}>
              Shared {formatRelativeTime(item.shared_at)}
            </Text>
          </View>
          {/* Optional: Add options menu (...) here */}
        </View>

        {/* Render the actual Article or Tweet Card */}
        {item.content_type === 'article' ? (
          <ArticleCard
            item={item.content_data}
            onPress={() => handleArticlePress(item.content_data)}
            // Pass isDarkTheme via context or props if needed by ArticleCard
          />
        ) : item.content_type === 'tweet' ? (
          <TweetCard
            item={item.content_data}
            onPress={() => handleTweetPress(item.content_data)}
            // Pass isDarkTheme via context or props if needed by TweetCard
          />
        ) : null}
      </View>
    );
  };

  // --- Render States ---
  const renderEmptyState = () => (
      <View style={styles.feedbackContainer}>
          <Icon name="repeat-outline" size={50} color={currentTheme.textTertiary} />
          <Text style={[styles.feedbackText, { color: currentTheme.textSecondary }]}>
              No Shared Items Yet
          </Text>
          <Text style={[styles.feedbackSubText, { color: currentTheme.textTertiary }]}>
              Content shared by friends will appear here.
          </Text>
      </View>
  );

  const renderErrorState = () => (
       <View style={styles.feedbackContainer}>
          <Icon name="cloud-offline-outline" size={50} color={currentTheme.destructive} />
          <Text style={[styles.feedbackText, { color: currentTheme.textSecondary }]}>
             {error || "Something went wrong."}
          </Text>
           <TouchableOpacity
              style={[styles.retryButton, { borderColor: currentTheme.accent }]}
              onPress={() => fetchSharedContent(username)} // Retry fetching content
           >
              <Text style={[styles.retryButtonText, { color: currentTheme.accent }]}>Try Again</Text>
           </TouchableOpacity>
      </View>
  );

   const renderLoadingState = () => (
       <View style={styles.feedbackContainer}>
           <ActivityIndicator size="large" color={currentTheme.accent} />
           <Text style={[styles.feedbackText, { color: currentTheme.textSecondary, marginTop: 10 }]}>
                Loading Shared Feed...
            </Text>
       </View>
   );

  // --- Main Render ---
  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {loading ? (
          renderLoadingState()
      ) : error ? (
          renderErrorState()
      ) : (
          <FlatList
            data={sharedContent}
            renderItem={renderContentCard}
            keyExtractor={(item, index) => `${item.content_type}-${item.content_id}-${item.username}-${index}`} // Improved key
            contentContainerStyle={styles.listContentContainer}
            ListEmptyComponent={renderEmptyState}
            style={styles.listStyle}
            // Optional: Add pull-to-refresh if needed
            // refreshControl={ ... }
          />
      )}

      {/* Render Modals */}
      <ArticleModal
        visible={articleModalVisible}
        onClose={() => setArticleModalVisible(false)}
        articleId={selectedArticleId ? selectedArticleId: null}
      />
      <TweetModal
        visible={tweetModalVisible}
        onClose={() => setTweetModalVisible(false)}
        tweetLink={selectedTweetLink}
      />
      {/* InAppMessage Display */}
       <InAppMessage
            visible={messageVisible}
            message={messageText}
            type={messageType}
            onClose={() => setMessageVisible(false)}
        />
    </View>
  );
};

export default RepostFeedPage;

// ------------------------------------------------------
// STYLES (Refined for Compactness & Aesthetics)
// ------------------------------------------------------
const getStyles = (currentTheme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      // backgroundColor set inline
    },
    listStyle: {
        flex: 1,
    },
    listContentContainer: {
        paddingTop: 6, // Reduced top padding
        paddingBottom: 100,
    },
    // Centered feedback container (loading, error, empty)
    feedbackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: height * 0.1, // Reduced top margin
    },
    feedbackText: {
        marginTop: 10, // Reduced margin
        fontSize: fontSizes.medium, // Kept size
        fontWeight: '600',
        textAlign: 'center',
        color: currentTheme.textSecondary, // Use theme color
    },
    feedbackSubText: {
        marginTop: 5, // Reduced margin
        fontSize: fontSizes.base, // Kept size
        textAlign: 'center',
        color: currentTheme.textTertiary, // Use theme color
    },
     retryButton: {
        marginTop: 16, // Reduced margin
        paddingHorizontal: 20, // Reduced padding
        paddingVertical: 8, // Reduced padding
        borderRadius: 18,
        borderWidth: 1, // Thinner border
        borderColor: currentTheme.accent,
    },
    retryButtonText: {
        fontSize: fontSizes.button,
        fontWeight: '600',
        color: currentTheme.accent,
    },
    // Shared Item Styling
    sharedItemContainer: {
        marginBottom: 12, // Reduced space between items
    },
    sharerInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16, // Keep horizontal padding consistent
        marginBottom: 6, // Reduced space below sharer info
    },
    sharerPfp: {
        width: 32, // Reduced size
        height: 32, // Reduced size
        borderRadius: 16, // Adjust radius
        borderWidth: 0.5, // Thinner border
        borderColor: currentTheme.borderColor,
    },
    sharerTextContainer: {
        flex: 1,
        marginLeft: 8, // Reduced margin
    },
    sharerName: {
        fontSize: fontSizes.base, // Kept size
        fontWeight: '600',
        color: currentTheme.textPrimary,
    },
    shareTime: {
        fontSize: fontSizes.small, // Kept size
        color: currentTheme.textSecondary,
    },
    // Placeholder for failed content fetch
    failedItemPlaceholder: {
        borderWidth: 1,
        borderColor: currentTheme.borderColor,
        borderRadius: 12,
        padding: 15, // Reduced padding
        marginHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 80, // Reduced height
        opacity: 0.7,
    },
    failedItemText: {
        marginTop: 6, // Reduced margin
        fontSize: fontSizes.base, // Kept size
        color: currentTheme.textTertiary,
    },
  });
