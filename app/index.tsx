// ------------------------------------------------------
// HomePage.tsx
// ------------------------------------------------------
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';

import { UserContext } from '../app/UserContext';
import TrendingScreen from '../app/trending';

// New Reusable Components
import HeaderTabs from '../components/HeaderTabs';
import ChronicallyButton from '../components/ui/ChronicallyButton';
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';

// ------------------ AUTH0 CONFIG ------------------
const domain = 'dev-1uzu6bsvrd2mj3og.us.auth0.com';
const clientId = 'CZHJxAwp7QDLyavDaTLRzoy9yLKea4A1';

const redirectUri = makeRedirectUri({
  useProxy: Platform.OS !== 'web',
  path: 'loginstatus',
});
// --------------------------------------------------

const HomePage: React.FC = () => {
  // ------------------ States ------------------
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Auth0
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false,
      prompt: 'login',
    },
    { authorizationEndpoint: `https://${domain}/authorize` }
  );

  // Tabs & Data
  const [activeTab, setActiveTab] = useState<'My News' | 'Trending'>('My News');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [isSeeAll, setIsSeeAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter
  const [filterType, setFilterType] = useState<'all' | 'tweet' | 'article'>('all');

  // User
  const [username, setUsername] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // Context & Nav
  const { userToken, setUserToken } = useContext(UserContext);
  const router = useRouter();
  const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

  // For arrow-up button
  const [scrolledFarDown, setScrolledFarDown] = useState(false);

  // References to FlatList
  const flatListRef = useRef<FlatList<any> | null>(null);
  const trendingFlatListRef = useRef<FlatList<any> | null>(null); // Reference for TrendingScreen FlatList

  // Create Animated.Value for scroll position
  const scrollY = useRef(new Animated.Value(0)).current;

  // Interpolate scrollY to get header opacity
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100], // Adjust the range as needed
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // ------------------ Auth / Login ------------------
  const handleLogin = async () => {
    setLoadingLogin(true);
    setErrorMessage('');
    if (Platform.OS === 'web') {
      // On web, just open the Auth0 URL
      const authUrl = `https://${domain}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=openid%20profile%20email&prompt=login`;
      window.location.href = authUrl;
    } else {
      try {
        if (request) {
          const result = await promptAsync();
          if (result.type === 'success' && result.params.code) {
            router.push({ pathname: '/loginstatus', params: { code: result.params.code } });
          } else {
            throw new Error('Authorization code not found');
          }
        }
      } catch (error) {
        console.error('Error during login:', error);
        setErrorMessage('Login failed');
      }
    }
    setLoadingLogin(false);
  };

  // ------------------ Data Helpers ------------------
  const formatDateToDay = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  const fetchProfilePicture = async (uname: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get-profile-picture?username=${uname}`);
      const data = await response.json();
      if (data.status === 'Success' && data.profile_picture) {
        setProfilePictureUrl(data.profile_picture);
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const fetchUsername = async () => {
    if (!userToken) {
      setUsername(null);
      setProfilePictureUrl(null);
      fetchPreferences('Guest');
      return;
    }
    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken }),
      });
      const data = await response.json();
      if (data.status === 'Success' && data.username) {
        setUsername(data.username);
        fetchPreferences(data.username);
        fetchProfilePicture(data.username);
      } else {
        setUsername(null);
        setProfilePictureUrl(null);
        setPreferences([]);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername(null);
      setProfilePictureUrl(null);
      setPreferences([]);
    }
  };

  const fetchPreferences = async (uname: string) => {
    if (!userToken) {
      const defaultPrefs = ['BREAKING NEWS', 'Football', 'Formula1', 'HEALTHY LIVING'];
      setPreferences(defaultPrefs);
      setSelectedCategory(defaultPrefs[0]);
      fetchContent(defaultPrefs[0]);
    } else {
      try {
        const response = await fetch(`${domaindynamo}/check-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: uname }),
        });
        const data = await response.json();
        if (data.status === 'Success') {
          const fetchedPrefs: string[] = data.data.map((item: any) => item.preference);
          setPreferences(fetchedPrefs);
          if (fetchedPrefs.length > 0) {
            setSelectedCategory(fetchedPrefs[0]);
            fetchContent(fetchedPrefs[0]);
          }
        } else {
          setPreferences([]);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
        setPreferences([]);
      }
    }
  };

  const fetchContent = async (category: string) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [articlesResponse, tweetsResponse] = await Promise.all([
        fetch(
          isSeeAll
            ? `${domaindynamo}/get-allarticles`
            : `${domaindynamo}/get-articles`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category }),
          }
        ),
        fetch(
          isSeeAll
            ? `${domaindynamo}/get-alltweets`
            : `${domaindynamo}/get-tweets`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category }),
          }
        ),
      ]);

      const articlesData = await articlesResponse.json();
      const tweetsData = await tweetsResponse.json();

      if (articlesData.status === 'Articles found' || tweetsData.status === 'Tweets found') {
        const articles = articlesData.data || [];
        const tweets = tweetsData.data || [];

        // Merge and group
        const combined = [
          ...tweets.map((t: any) => ({ type: 'tweet', dateTime: t.Created_At, ...t })),
          ...articles.map((a: any) => ({ type: 'article', dateTime: a.date, ...a })),
        ];

        // Group by day
        const dayMap: Record<string, any[]> = {};
        for (const item of combined) {
          const day = formatDateToDay(item.dateTime);
          if (!dayMap[day]) {
            dayMap[day] = [];
          }
          dayMap[day].push(item);
        }

        // Sort days
        const sortedDays = Object.keys(dayMap).sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime()
        );

        // Flatten
        let finalContent: any[] = [];
        for (const day of sortedDays) {
          // Sort items within each day by newest first
          dayMap[day].sort(
            (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
          );
          finalContent.push(...dayMap[day]);
        }
        setArticlesAndTweets(finalContent);
      } else {
        setArticlesAndTweets([]);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
      setErrorMessage('Failed to load content. Please try again later.');
      setArticlesAndTweets([]);
    } finally {
      setIsLoading(false);
      setPageLoading(false);
    }
  };

  // ------------------ Press Handlers ------------------
  const handleTweetPress = async (item: any) => {
    if (!userToken) {
      alertNotLoggedIn();
      return;
    }
    try {
      const response = await fetch(`${domaindynamo}/set-tweettodisp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, tweet: item }),
      });
      const data = await response.json();
      if (data.status === 'Success' && data.token) {
        setUserToken(data.token);
        router.push('/tweetpage');
      } else {
        Alert.alert('Error', 'Failed to set tweet data');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Unable to set tweet data');
    }
  };

  const handleArticlePress = async (item: any) => {
    if (!userToken) {
      alertNotLoggedIn();
      return;
    }
    try {
      const response = await fetch(`${domaindynamo}/set-article-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, id: item.id }),
      });
      const data = await response.json();
      if (data.status === 'Success') {
        setUserToken(data.token);
        router.push('/articlepage');
      } else {
        Alert.alert('Error', 'Failed to set article data');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Unable to set article data');
    }
  };

  const alertNotLoggedIn = () => {
    if (Platform.OS === 'web') {
      alert('Login to Access More Features!');
    } else {
      Alert.alert('Error', 'Login to Access More Features!');
    }
  };

  // ------------------ Lifecycle ------------------
  useEffect(() => {
    fetchUsername();
  }, [userToken]);

  // ------------------ Category & Filter ------------------
  const handleCategorySelect = (category: string) => {
    setIsSeeAll(false);
    setSelectedCategory(category);
    fetchContent(category);
  };

  const handleSeeAll = () => {
    setIsSeeAll(true);
    setSelectedCategory(null);
    fetchContent('all');
  };

  const handleFilterSelect = (type: 'all' | 'tweet' | 'article') => {
    setFilterType(type);
  };

  // Returns the items that match the current filter
  const getFilteredData = () => {
    if (filterType === 'all') return articlesAndTweets;
    return articlesAndTweets.filter((item) => item.type === filterType);
  };

  // ------------------ Scroll Handling ------------------
  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    // Show "arrow up" if user scrolls beyond 300px
    if (currentOffset > 300 && !scrolledFarDown) {
      setScrolledFarDown(true);
    } else if (currentOffset < 300 && scrolledFarDown) {
      setScrolledFarDown(false);
    }
  };

  const handleScrollToTop = () => {
    console.log("handleScrollToTop called");
    console.log("activeTab:", activeTab);

    if (activeTab === 'My News' && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    } else if (activeTab === 'Trending' && trendingFlatListRef.current) {
      trendingFlatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  // ------------------ Renders ------------------
  const renderContentCard = ({ item }: { item: any }) => {
    if (item.type === 'tweet') {
      return <TweetCard item={item} onPress={() => handleTweetPress(item)} />;
    }
    return <ArticleCard item={item} onPress={() => handleArticlePress(item)} />;
  };

  // ------------------ Header Rendering ------------------
  const renderHeader = () => (
    <HeaderTabs
      activeTab={activeTab}
      onTabPress={(tab) => {
        if (tab === 'Trending') {
          setActiveTab('Trending');
        } else {
          setActiveTab('My News');
        }
      }}
      username={username}
      profilePictureUrl={profilePictureUrl || undefined}
      onSettingsPress={() => router.push('/settings')}
      onLoginPress={handleLogin}
      headerOpacity={headerOpacity} // Pass the interpolated opacity
    />
  );

  // ------------------ Bottom Bar ------------------
  const renderBottomBar = () => (
    <ChronicallyButton
      onHomePress={() => router.push('/')}
      onBookmarkPress={() => {
        if (!userToken) {
          alertNotLoggedIn();
        } else {
          router.push('/savedarticles');
        }
      }}
      onArrowPress={handleScrollToTop}
      arrowDisabled={!scrolledFarDown}
      onFollowingPress={() => {
        if (!userToken) {
          alertNotLoggedIn();
        } else {
          router.push('/followingpage');
        }
      }}
      onSearchPress={() => {
        if (!userToken) {
          alertNotLoggedIn();
        } else {
          router.push('/searchpage');
        }
      }}
      scrolledFarDown={scrolledFarDown}
    />
  );

  // ------------------ List Header ------------------
  const renderListHeader = () => (
    <View>
      {/* Header */}
      {renderHeader()}

      {/* Categories and Filter (only for 'My News') */}
      {activeTab === 'My News' && (
        <View style={styles.categoryFilterWrapper}>
          {/* SCROLLABLE CATEGORIES */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginVertical: 5 }}
            contentContainerStyle={styles.categoriesContainer}
          >
            {preferences.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  selectedCategory === cat && styles.categoryButtonActive,
                ]}
                onPress={() => handleCategorySelect(cat)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === cat && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}

            {/* "See All" button */}
            <TouchableOpacity
              style={[styles.categoryButton, isSeeAll && styles.categoryButtonActive]}
              onPress={handleSeeAll}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  isSeeAll && styles.categoryButtonTextActive,
                ]}
              >
                See All
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* FILTER ROW */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Filter by:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filterType === 'all' && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterSelect('all')}
              >
                <Text style={styles.filterButtonText}>All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filterType === 'tweet' && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterSelect('tweet')}
              >
                <Text style={styles.filterButtonText}>Tweets</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filterType === 'article' && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterSelect('article')}
              >
                <Text style={styles.filterButtonText}>Articles</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );

// ------------------ Main Render ------------------
if (pageLoading) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6C63FF" />
    </View>
  );
}

return (
  <View style={styles.container}>
    {/* Content Area */}
    {activeTab === 'Trending' ? (
      <TrendingScreen flatListRef={trendingFlatListRef} />
    ) : (
      <FlatList
        ref={flatListRef}
        data={getFilteredData()}
        renderItem={renderContentCard}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        ListHeaderComponent={renderListHeader}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
            listener: handleScroll,
          }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#6C63FF" />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No content available.</Text>
            </View>
          )
        }
      />
    )}

    {/* Bottom Bar - Always Rendered */}
    {activeTab === 'My News' && renderBottomBar()}
  </View>
);
};
export default HomePage;

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FA',
    position: 'relative', // Ensure that absolutely positioned children are relative to this container
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F4F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryFilterWrapper: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E2E2',
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  categoriesContainer: {
    alignItems: 'center',
    // Optional: Add paddingHorizontal if needed
  },
  categoryButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    marginRight: 4,
    marginVertical: 4,
  },
  categoryButtonActive: {
    backgroundColor: '#6C63FF',
  },
  categoryButtonText: {
    color: '#333',
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: '#FFF',
  },
  filterRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    color: '#333',
    fontSize: 14,
    marginRight: 8,
  },
  filterButton: {
    marginRight: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
  },
  filterButtonActive: {
    backgroundColor: '#6C63FF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
  },
  listContentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 80, // So bottom bar doesn't overlap content
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorMessage: {
    color: '#FF0000',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: '#555',
    fontSize: 16,
  },
});
