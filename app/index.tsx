import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context'; // optional
import { UserContext } from '../app/UserContext'; // Adjust path as needed

import CustomButtonWithBar from '../components/ui/ChronicallyButton.tsx'; // Ensure correct path
import TrendingScreen from '../app/trending';
import TweetCard from '../components/TweetCard'; // Reusable TweetCard component
import ArticleCard from '../components/ArticleCard'; // Reusable ArticleCard component
import CategoryFilter from '../components/CategoryFilter'; // Reusable CategoryFilter component

// NOTE: This is the NEW HeaderTabs that includes the dynamic top-right login/username
import HeaderTabs from '../components/HeaderTabs.tsx';

// ------------------ AUTH0 CONFIG ------------------
const domain = 'dev-1uzu6bsvrd2mj3og.us.auth0.com';
const clientId = 'CZHJxAwp7QDLyavDaTLRzoy9yLKea4A1';

const redirectUri = makeRedirectUri({
  useProxy: Platform.OS !== 'web', // Use the Expo proxy if not on web
  path: 'loginstatus',             // must match your Auth0 callback route
});
// --------------------------------------------------

const HomePage: React.FC = () => {
  // Auth0 login states
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // For Auth0 request/response
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

  // Tab & Content states
  const [activeTab, setActiveTab] = useState<'My News' | 'Trending'>('My News');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [isSeeAll, setIsSeeAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // This will store the logged-in username if available
  const [username, setUsername] = useState<string | null>(null);

  // Context & Navigation
  const { userToken, setUserToken } = useContext(UserContext);
  const router = useRouter();
  const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

  // For controlling the floating bottom bar
  const lastOffset = useRef(0);
  const [showButton, setShowButton] = useState(true);

  // ------------------ AUTH0 login function ------------------
  const handleLogin = async () => {
    setLoadingLogin(true);
    setErrorMessage('');

    if (Platform.OS === 'web') {
      // Web: redirect user directly to Auth0 login page
      const authUrl = `https://${domain}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=openid%20profile%20email&prompt=login`;
      window.location.href = authUrl;
    } else {
      // Native (iOS/Android)
      try {
        if (request) {
          const result = await promptAsync();
          if (result.type === 'success' && result.params && result.params.code) {
            router.push({ pathname: '/loginStatus', params: { code: result.params.code } });
          } else {
            throw new Error('Authorization code not found in result');
          }
        }
      } catch (error) {
        console.error('Error during login process:', error);
        setErrorMessage('Login failed');
      }
    }

    setLoadingLogin(false);
  };
  // ----------------------------------------------------------

  // Utility functions to format dates
  const formatToUTCT = (isoDate: string): string => {
    const date = new Date(isoDate);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${hours}:${minutes} ${day}-${month}-${year}`;
  };

  const formatToUTCA = (isoDate: string): string => {
    const date = new Date(isoDate);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };

  // Fetch username from backend
  const fetchUsername = async () => {
    if (!userToken) {
      // No token => treat as guest
      setUsername(null);
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
      } else {
        setUsername(null);
        setPreferences([]);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername(null);
      setPreferences([]);
    }
  };

  // Fetch user preferences based on username
  const fetchPreferences = async (username: string) => {
    if (!userToken) {
      // If not logged in, provide some default preferences
      const fetchedPreferences = ['BREAKING NEWS', 'Football', 'Formula1', 'HEALTHY LIVING'];
      setPreferences(fetchedPreferences);
      setSelectedCategory(fetchedPreferences[0]);
      fetchContent(fetchedPreferences[0]);
    } else {
      try {
        const response = await fetch(`${domaindynamo}/check-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        const data = await response.json();
        if (data.status === 'Success') {
          const fetchedPreferences: string[] = data.data.map((item: any) => item.preference);
          setPreferences(fetchedPreferences);
          if (fetchedPreferences.length > 0) {
            setSelectedCategory(fetchedPreferences[0]);
            fetchContent(fetchedPreferences[0]);
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

  // Fetch content (tweets & articles) based on category
  const fetchContent = async (category: string) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const [articlesResponse, tweetsResponse] = await Promise.all([
        fetch(
          isSeeAll ? `${domaindynamo}/get-allarticles` : `${domaindynamo}/get-articles`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category }),
          }
        ),
        fetch(
          isSeeAll ? `${domaindynamo}/get-alltweets` : `${domaindynamo}/get-tweets`,
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
        const tweets = tweetsData.data || [];
        const articles = articlesData.data || [];

        let combinedContent: any[] = [];
        if (tweets.length > 0 && articles.length > 0) {
          // Combine & sort (70% tweets / 30% articles)
          const totalItems = tweets.length + articles.length;
          const desiredTweetsCount = Math.floor(totalItems * 0.7);
          const desiredArticlesCount = Math.floor(totalItems * 0.3);

          const selectedTweets = tweets.slice(0, desiredTweetsCount);
          const selectedArticles = articles.slice(0, desiredArticlesCount);

          combinedContent = [
            ...selectedTweets.map((item: any) => ({ type: 'tweet', ...item })),
            ...selectedArticles.map((item: any) => ({ type: 'article', ...item })),
          ];
          // Sort by date desc
          combinedContent.sort(
            (a, b) =>
              new Date(b.date || b.Created_At).getTime() -
              new Date(a.date || a.Created_At).getTime()
          );
        } else if (tweets.length > 0) {
          // Only tweets
          combinedContent = tweets.map((item: any) => ({ type: 'tweet', ...item }));
          combinedContent.sort(
            (a, b) => new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime()
          );
        } else if (articles.length > 0) {
          // Only articles
          combinedContent = articles.map((item: any) => ({ type: 'article', ...item }));
          combinedContent.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        }

        setArticlesAndTweets(combinedContent);
      } else {
        // Neither articles nor tweets found
        setArticlesAndTweets([]);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
      setErrorMessage('Failed to load content. Please try again later.');
      setArticlesAndTweets([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tapping a tweet
  const handleTweetPress = async (item: any) => {
    if (!userToken) {
      Platform.OS === 'web'
        ? alert('Login to Access More Features!')
        : Alert.alert('Error', 'Login to Access More Features!');
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
      console.error('Error setting tweet data:', error);
      Alert.alert('Error', 'Unable to set tweet data');
    }
  };

  // Handle tapping an article
  const handleArticlePress = async (item: any) => {
    if (!userToken) {
      Platform.OS === 'web'
        ? alert('Login to Access More Features!')
        : Alert.alert('Error', 'Login to Access More Features!');
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
      console.error('Error setting article data:', error);
      Alert.alert('Error', 'Unable to set article data');
    }
  };

  // On mount or whenever userToken changes, fetch username
  useEffect(() => {
    fetchUsername();
  }, [userToken]);

  // Handle category selection
  const handleCategorySelect = (category: string) => {
    setIsSeeAll(false);
    setSelectedCategory(category);
    fetchContent(category);
  };

  // Handle "See All"
  const handleSeeAll = () => {
    setIsSeeAll(true);
    setSelectedCategory(null);
    fetchContent('all');
  };

  // Render each item (TweetCard or ArticleCard)
  const renderContentCard = ({ item }: { item: any }) => {
    if (item.type === 'article') {
      return <ArticleCard item={item} onPress={handleArticlePress} />;
    } else if (item.type === 'tweet') {
      return <TweetCard item={item} onPress={handleTweetPress} />;
    }
    return null;
  };

  // Bottom bar navigation
  const handleHomePress = () => router.push('/');
  const handleBookmarkPress = () => {
    if (!userToken) {
      Platform.OS === 'web'
        ? alert('Login to Access More Features!')
        : Alert.alert('Error', 'Login to Access More Features!');
    } else {
      router.push('/savedarticles');
    }
  };
  const handleAddressBookPress = () => {
    if (!userToken) {
      Platform.OS === 'web'
        ? alert('Login to Access More Features!')
        : Alert.alert('Error', 'Login to Access More Features!');
    } else {
      router.push('/followingpage');
    }
  };
  const handleSearchPress = () => {
    if (!userToken) {
      Platform.OS === 'web'
        ? alert('Login to Access More Features!')
        : Alert.alert('Error', 'Login to Access More Features!');
    } else {
      router.push('/searchpage');
    }
  };

  // Show/hide floating button on scroll
  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    if (currentOffset > lastOffset.current && currentOffset > 50) {
      // Scrolling Down
      if (showButton) setShowButton(false);
    } else if (currentOffset < lastOffset.current) {
      // Scrolling Up
      if (!showButton) setShowButton(true);
    }
    lastOffset.current = currentOffset;
  };

  return (
    <View style={styles.container}>
      {/*
        HeaderTabs now receives:
        - activeTab & setActiveTab
        - username => if null => shows Login button, else shows username + dropdown
        - onLoginPress => calls handleLogin()
        - onSettingsPress => push to settings
      */}
      <HeaderTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        username={username}
        onLoginPress={handleLogin}
        onSettingsPress={() => router.push('/settings')}
      />

      {/* Show error if Auth0 login fails */}
      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* If "Trending" tab is active, show TrendingScreen; else show My News */}
      {activeTab === 'Trending' ? (
        <TrendingScreen />
      ) : (
        <>
          {/* Category Filter for "My News" */}
          <CategoryFilter
            categories={preferences}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            onSeeAll={handleSeeAll}
            isSeeAll={isSeeAll}
          />

          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#6C63FF" />
            </View>
          ) : errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : (
            <FlatList
              data={articlesAndTweets}
              renderItem={renderContentCard}
              keyExtractor={(item, index) => `${item.type}-${index}`}
              contentContainerStyle={styles.contentContainer}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No content available.</Text>
                </View>
              }
            />
          )}

          {/* Bottom Bar (home, bookmark, address-book, search) */}
          <CustomButtonWithBar
            isVisible={showButton}
            barButtons={[
              { iconName: 'home', onPress: handleHomePress },
              { iconName: 'bookmark', onPress: handleBookmarkPress },
              { iconName: 'address-book', onPress: handleAddressBookPress },
              { iconName: 'search', onPress: handleSearchPress },
            ]}
            onMainButtonPress={() => {
              console.log('Main floating button pressed!');
            }}
          />
        </>
      )}
    </View>
  );
};

export default HomePage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 100, // space for the floating button
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
  errorText: {
    color: '#FF0000',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#555555',
    fontSize: 16,
  },
});
