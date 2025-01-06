// ------------------------------------------------------
// app/searchpage.tsx
// ------------------------------------------------------
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import FilterPicker from '../components/filterpicker';
import ArticleCard from '../components/ArticleCard';
import TweetCard from '../components/TweetCard';
import BackButton from '../components/ui/BackButton';
import { UserContext } from '../app/UserContext';
import { useRouter } from 'expo-router';
import TweetModal from './tweetpage'; // Import TweetModal
import ArticleModal from './articlepage'; // Import ArticleModal

const DOMAIN_DYNAMO = 'https://chronically.netlify.app/.netlify/functions/index';

// TypeScript Interfaces
interface ApiResponse<T> {
  status: 'Success' | 'Error';
  data?: T;
  message?: string;
  error?: string;
}

interface SearchResult {
  type: 'article' | 'tweet';
  id: string;
  time: string;
  content_data?: ArticleData | TweetData;
}

interface ArticleData {
  id: string;
  headline: string;
  content: string;
  // Add other relevant fields
}

interface TweetData {
  Tweet_Link: string;
  Tweet: string;
  Created_At: string;
  // Add other relevant fields
}

const HEADER_HEIGHT = 100; // Increased to accommodate stacked layout
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const NewsSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'articles' | 'tweets'>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');

  // Access userToken, setUserToken, and isDarkTheme from UserContext
  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext);

  // Initialize router
  const router = useRouter();

  // Animated value for scroll position
  const scrollY = useRef(new Animated.Value(0)).current;

  // Ref for FlatList to enable scrolling
  const flatListRef = useRef<FlatList>(null);

  // Animated translateY for header (slides up as user scrolls)
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  // Animated opacity for scroll-to-top button (appears after scrolling down)
  const showScrollToTop = scrollY.interpolate({
    inputRange: [200, 250], // Threshold for showing the button
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Debounce timer reference
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Modal states
  const [tweetModalVisible, setTweetModalVisible] = useState<boolean>(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [articleModalVisible, setArticleModalVisible] = useState<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Implement alertNotLoggedIn function
  const alertNotLoggedIn = () => {
    if (Platform.OS === 'web') {
      alert('Please log in to access this feature.');
    } else {
      Alert.alert('Not Logged In', 'Please log in to access this feature.');
    }
  };

  // Fetch Detailed Tweet Data
  const fetchTweetContent = async (link: string): Promise<TweetData | null> => {
    try {
      const response = await fetch(`${DOMAIN_DYNAMO}/get-tweet-by-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link }),
      });

      if (!response.ok) {
        throw new Error(`Error fetching tweet: ${response.statusText}`);
      }

      const data: ApiResponse<TweetData> = await response.json();

      if (data.status === 'Error') {
        throw new Error(data.error || 'Failed to fetch tweet content');
      }

      return data.data || null;
    } catch (error: any) {
      console.error(`Error in fetchTweetContent: ${error.message}`);
      return null;
    }
  };

  // Fetch Detailed Article Data
  const fetchArticleContent = async (articleId: string): Promise<ArticleData | null> => {
    try {
      const response = await fetch(`${DOMAIN_DYNAMO}/get-article-by-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: articleId }),
      });

      if (!response.ok) {
        throw new Error(`Error fetching article: ${response.statusText}`);
      }

      const data: ApiResponse<ArticleData> = await response.json();

      if (data.status === 'Error') {
        throw new Error(data.error || 'Failed to fetch article content');
      }

      return data.data || null;
    } catch (error: any) {
      console.error(`Error in fetchArticleContent: ${error.message}`);
      return null;
    }
  };

  // Handle Search Function with Filter
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const response = await fetch(`${DOMAIN_DYNAMO}/search_content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchQuery }),
      });

      const data: ApiResponse<SearchResult[]> = await response.json();

      if (data.status === 'Success' && data.data) {
        let searchResults: SearchResult[] = data.data;

        // Apply Filter
        if (filterType !== 'all') {
          const typeFilter = filterType === 'articles' ? 'article' : 'tweet';
          searchResults = searchResults.filter((item) => item.type === typeFilter);
        }

        if (searchResults.length === 0) {
          setError('No results found for the selected filter.');
          setLoading(false);
          return;
        }

        // Fetch detailed content for each result
        const detailedContent = await Promise.all(
          searchResults.map(async (item: SearchResult) => {
            if (item.type === 'article') {
              const articleData = await fetchArticleContent(item.id);
              return { ...item, content_data: articleData };
            } else if (item.type === 'tweet') {
              const tweetData = await fetchTweetContent(item.id);
              return { ...item, content_data: tweetData };
            }
            return item;
          })
        );

        setResults(detailedContent);
      } else {
        setError(data.message || 'No results found.');
      }
    } catch (error: any) {
      console.error(error);
      setError('An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search to handle filter changes
  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setResults([]);
        setError('');
      }
    }, 500); // 500ms debounce

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  // ------------------ Press Handlers ------------------
  const handleContentPress = (item: SearchResult) => {
    if (item.type === 'tweet') {
      if (!userToken) {
        Alert.alert('Error', 'You must be logged in to view tweets.');
        return;
      }

      // Open TweetModal with the tweet link
      setSelectedTweetLink(item.content_data?.Tweet_Link || null);
      if (item.content_data?.Tweet_Link) {
        setTweetModalVisible(true);
      } else {
        Alert.alert('Error', 'Invalid tweet link.');
      }
    } else if (item.type === 'article') {
      if (!userToken) {
        Alert.alert('Error', 'You must be logged in to view articles.');
        return;
      }

      // Open ArticleModal with the article ID
      setSelectedArticleId(item.content_data?.id || null);
      if (item.content_data?.id) {
        setArticleModalVisible(true);
      } else {
        Alert.alert('Error', 'Invalid article ID.');
      }
    }
  };

  // Scroll to top function
  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Render Each Search Result
  const renderResultsCard = ({ item }: { item: SearchResult }) => {
    if (item.type === 'article' && item.content_data) {
      return (
        <ArticleCard
          item={item.content_data as ArticleData}
          onPress={() => handleContentPress(item)}
          isDarkTheme={isDarkTheme} // Pass theme prop if needed
        />
      );
    } else if (item.type === 'tweet' && item.content_data) {
      return (
        <TweetCard
          item={item.content_data as TweetData}
          onPress={() => handleContentPress(item)}
          isDarkTheme={isDarkTheme} // Pass theme prop if needed
        />
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDarkTheme ? '#1F2937' : '#FFFFFF' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY: headerTranslateY }],
            backgroundColor: isDarkTheme ? '#1F2937' : '#FFFFFF', // Dynamic background
            shadowColor: isDarkTheme ? '#000000' : '#000000', // Shadow remains for both themes
          },
        ]}
      >
        <View style={styles.headerTop}>
          <BackButton topOffset={-15} />
          <Text
            style={[
              styles.title,
              { color: isDarkTheme ? '#F3F4F6' : '#A020F0' }, // Dynamic text color
            ]}
          >
            News Search
          </Text>
        </View>

        <View
          style={[
            styles.form,
            {
              // Additional dynamic styles if needed
            },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: isDarkTheme ? '#374151' : '#F9F9F9', // Dynamic background
                borderColor: isDarkTheme ? '#374151' : '#A020F0', // Dynamic border
              },
            ]}
          >
            <Icon
              name="search"
              size={20}
              color={isDarkTheme ? '#D1D5DB' : '#A020F0'} // Dynamic icon color
              style={styles.searchIcon}
            />
            <TextInput
              style={[
                styles.input,
                { color: isDarkTheme ? '#F3F4F6' : '#000000' }, // Dynamic text color
              ]}
              placeholder="Search for news..."
              placeholderTextColor={isDarkTheme ? '#D1D5DB' : '#A020F0'} // Dynamic placeholder color
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
          <FilterPicker
            filterType={filterType}
            setFilterType={setFilterType}
            isDarkTheme={isDarkTheme} // Pass theme prop if needed
          />
        </View>
      </Animated.View>

      {/* Animated FlatList */}
      <Animated.FlatList
        ref={flatListRef}
        data={results}
        keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
        renderItem={renderResultsCard}
        contentContainerStyle={[
          styles.resultsContainer,
          { paddingTop: HEADER_HEIGHT + 20 },
        ]}
        ListEmptyComponent={
          !loading ? (
            <View style={[styles.resultsPlaceholder, { backgroundColor: isDarkTheme ? '#374151' : '#F0F0F0' }]}>
              <Text
                style={[
                  styles.resultsText,
                  { color: isDarkTheme ? '#D1D5DB' : '#A020F0' }, // Dynamic text color
                ]}
              >
                {error ? error : 'No results found'}
              </Text>
            </View>
          ) : (
            <ActivityIndicator size="large" color="#A020F0" />
          )
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />

      {/* Scroll-to-Top Button */}
      <Animated.View
        style={[
          styles.scrollToTopButtonContainer,
          { opacity: showScrollToTop },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.scrollToTopButton,
            { backgroundColor: '#A020F0' }, // Consistent accent color
          ]}
          onPress={scrollToTop}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Scroll to top"
        >
          <Icon name="arrow-up" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Render the ArticleModal */}
      <ArticleModal
        visible={articleModalVisible}
        onClose={() => setArticleModalVisible(false)}
        articleId={selectedArticleId}
      />

      {/* Render the TweetModal */}
      <TweetModal
        visible={tweetModalVisible}
        onClose={() => setTweetModalVisible(false)}
        tweetLink={selectedTweetLink}
      />
    </KeyboardAvoidingView>
  );
};

export default NewsSearch;

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937', // Default to dark background, overridden dynamically
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    paddingHorizontal: 15, // Reduced horizontal padding for more space
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 10,
    backgroundColor: '#1F2937', // Dynamic background
    shadowColor: '#000000', // Dynamic shadow color
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
    zIndex: 1,
    justifyContent: 'center', // Center content vertically
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20, // Slightly reduced font size for better fit
    fontWeight: 'bold',
    color: '#F3F4F6', // Dynamic text color
    flex: 1,
    textAlign: 'center',
  },
  form: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Distribute space between input and picker
    marginBottom: 0, // Remove bottom margin for tighter layout
    paddingHorizontal: 0, // Already handled in header
  },
  inputWrapper: {
    height: 40,
    flex: 2, // Allocate sufficient space to the input
    position: 'relative',
    marginRight: 8, // Reduced margin for compactness
    borderWidth: 1,
    borderColor: '#374151', // Dynamic border color
    borderRadius: 8, // Consistent border radius
    backgroundColor: '#374151', // Dynamic background color
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    top: 10, // Vertically center the icon within the input
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 40,
    paddingLeft: 35, // Space for the search icon
    paddingRight: 10,
    fontSize: 14, // Slightly reduced font size for compactness
    color: '#F3F4F6', // Dynamic text color
    backgroundColor: 'transparent',
  },
  resultsContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: HEADER_HEIGHT + 20, // Ensure content starts below the header
    paddingBottom: 100,
  },
  resultsPlaceholder: {
    backgroundColor: '#374151', // Default dark background for placeholder
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 0,
  },
  resultsText: {
    color: '#D1D5DB', // Dynamic text color
    fontSize: 16,
    textAlign: 'center',
  },
  scrollToTopButtonContainer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    zIndex: 2,
  },
  scrollToTopButton: {
    backgroundColor: '#A020F0', // Consistent accent color
    width: 40, // Reduced size for compactness
    height: 40, // Reduced size
    borderRadius: 20, // Ensures the button remains circular
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  // Additional styles
  sharedContentContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#1F2937', // Dynamic background
    borderWidth: 1,
    borderColor: '#374151', // Dynamic border
  },
  sharedInfo: {
    marginBottom: 8,
    fontSize: 14,
    color: '#D1D5DB', // Dynamic text color
    fontStyle: 'italic',
  },
  missingContent: {
    padding: 20,
    backgroundColor: '#374151', // Dynamic background for missing content
    borderRadius: 10,
    marginBottom: 10,
  },
  missingContentText: {
    color: '#F87171', // Soft red text
    textAlign: 'center',
  },
});
