// HomePage.tsx

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
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';

import { UserContext } from '../app/UserContext';
import HeaderTabs from '../components/HeaderTabs';
import ChronicallyButton from '../components/ui/ChronicallyButton';
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';
import ArticleModal from './articlepage';
import TweetModal from './tweetpage';

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
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [tweetModalVisible, setTweetModalVisible] = useState(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);

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
  const [categories, setCategories] = useState<string[]>(['Trending', 'Technology', 'Health', 'Sports']);
  const [activeCategory, setActiveCategory] = useState<string>('Trending');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [isSeeAll, setIsSeeAll] = useState(false); // New state to track "See All" selection
  const [isLoading, setIsLoading] = useState(false);

  // User
  const [username, setUsername] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // Context & Nav
  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext);
  const router = useRouter();
  const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

  // For arrow-up button
  const [scrolledFarDown, setScrolledFarDown] = useState(false);

  // References to FlatList
  const flatListRef = useRef<FlatList<any> | null>(null);

  // Create Animated.Value for scroll position
  const scrollY = useRef(new Animated.Value(0)).current;

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
      console.log('Username: ', username);
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
        setCategories(['Trending']);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername(null);
      setProfilePictureUrl(null);
      setCategories(['Trending']);
    }
  };

  const fetchPreferences = async (uname: string) => {
    if (!userToken) {
      const defaultPrefs = ['BREAKING NEWS', 'Football', 'Formula1', 'HEALTHY LIVING'];
      setCategories(['Trending', ...defaultPrefs]);
      setActiveCategory('Trending');
      setSelectedFilter('All');
      fetchContent('Trending', 'All');
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
          setCategories(['Trending', ...fetchedPrefs]);
          if (fetchedPrefs.length > 0) {
            setActiveCategory('Trending');
            setSelectedFilter('All');
            fetchContent('Trending', 'All');
          }
        } else {
          setCategories(['Trending']);
          setActiveCategory('Trending');
          setSelectedFilter('All');
          fetchContent('Trending', 'All');
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
        setCategories(['Trending']);
        setActiveCategory('Trending');
        setSelectedFilter('All');
        fetchContent('Trending', 'All');
      }
    }
  };

  // ------------------ Fetch Content Function ------------------
  const fetchContent = async (category: string, filter: string) => {
    // Reset state before fetching new content
    setArticlesAndTweets([]);
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (category === 'Trending') {
        // **Trending Category: Only fetch tweets, and do not group or sort**
        const tweetsEndpoint = `${domaindynamo}/get_trending_tweets`;

        const tweetsResponse = await fetch(tweetsEndpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const tweetsData = await tweetsResponse.json();

        if (tweetsData.status === 'Success') {
          // Just display what was returned, no grouping or sorting
          const tweets = tweetsData.data || [];

          // If filter is 'Tweets' or 'All', display them. Otherwise, empty.
          if (filter === 'Tweets' || filter === 'All') {
            setArticlesAndTweets(tweets.map((t: any) => ({ type: 'tweet', ...t })));
          } else {
            setArticlesAndTweets([]);
          }
        } else if (tweetsData.status === 'No tweets found') {
          setArticlesAndTweets([]);
          setErrorMessage('No trending tweets found.');
        } else {
          setArticlesAndTweets([]);
          setErrorMessage('Failed to load trending tweets.');
        }
      } else if (category === 'See All') {
        // **See All Category: Fetch all articles and tweets**
        const articlesEndpoint = `${domaindynamo}/get-allarticles`;
        const tweetsEndpoint = `${domaindynamo}/get-alltweets`;

        const [articlesResponse, tweetsResponse] = await Promise.all([
          fetch(articlesEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: 'all' }),
          }),
          fetch(tweetsEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: 'all' }),
          }),
        ]);

        const articlesData = await articlesResponse.json();
        const tweetsData = await tweetsResponse.json();

        let isArticlesSuccess = false;
        let isTweetsSuccess = false;

        if (articlesResponse.ok && articlesData.status === 'Articles found') {
          isArticlesSuccess = true;
        }
        if (tweetsResponse.ok && tweetsData.status === 'Tweets found') {
          isTweetsSuccess = true;
        }

        if (isArticlesSuccess || isTweetsSuccess) {
          const articles = isArticlesSuccess ? articlesData.data : [];
          const tweets = isTweetsSuccess ? tweetsData.data : [];

          const combined = [
            ...tweets.map((t: any) => ({ type: 'tweet', dateTime: t.Created_At, ...t })),
            ...articles.map((a: any) => ({ type: 'article', dateTime: a.date, ...a })),
          ];

          // Group & sort logic
          const dayMap: Record<string, any[]> = {};
          for (const item of combined) {
            const day = formatDateToDay(item.dateTime);
            if (!dayMap[day]) {
              dayMap[day] = [];
            }
            dayMap[day].push(item);
          }
          const sortedDays = Object.keys(dayMap).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          let finalContent: any[] = [];
          for (const day of sortedDays) {
            dayMap[day].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
            finalContent.push(...dayMap[day]);
          }
          setArticlesAndTweets(finalContent);
        } else {
          setArticlesAndTweets([]);
          setErrorMessage('No content found for this category.');
        }
      } else {
        // **Other Categories: Fetch Both Articles and Tweets**
        const articlesEndpoint = isSeeAll
          ? `${domaindynamo}/get-allarticles`
          : `${domaindynamo}/get-articles`;
        const tweetsEndpoint = isSeeAll
          ? `${domaindynamo}/get-alltweets`
          : `${domaindynamo}/get-tweets`;

        const [articlesResponse, tweetsResponse] = await Promise.all([
          fetch(articlesEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: isSeeAll ? 'all' : category }),
          }),
          fetch(tweetsEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: isSeeAll ? 'all' : category }),
          }),
        ]);

        const articlesData = await articlesResponse.json();
        const tweetsData = await tweetsResponse.json();

        let isArticlesSuccess = false;
        let isTweetsSuccess = false;

        if (articlesResponse.ok && articlesData.status === 'Articles found') {
          isArticlesSuccess = true;
        }
        if (tweetsResponse.ok && tweetsData.status === 'Tweets found') {
          isTweetsSuccess = true;
        }

        if (isArticlesSuccess || isTweetsSuccess) {
          const articles = isArticlesSuccess ? articlesData.data : [];
          const tweets = isTweetsSuccess ? tweetsData.data : [];

          // Apply Filters
          let filteredArticles = articles;
          let filteredTweets = tweets;

          if (filter === 'Articles') {
            filteredTweets = [];
          } else if (filter === 'Tweets') {
            filteredArticles = [];
          }
          // If filter is 'All', no change to either

          const combined = [
            ...filteredTweets.map((t: any) => ({ type: 'tweet', dateTime: t.Created_At, ...t })),
            ...filteredArticles.map((a: any) => ({ type: 'article', dateTime: a.date, ...a })),
          ];

          // Group & sort
          const dayMap: Record<string, any[]> = {};
          for (const item of combined) {
            const day = formatDateToDay(item.dateTime);
            if (!dayMap[day]) {
              dayMap[day] = [];
            }
            dayMap[day].push(item);
          }
          const sortedDays = Object.keys(dayMap).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          let finalContent: any[] = [];
          for (const day of sortedDays) {
            dayMap[day].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
            finalContent.push(...dayMap[day]);
          }
          setArticlesAndTweets(finalContent);
        } else {
          setArticlesAndTweets([]);
          setErrorMessage('No content found for this category.');
        }
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
    // Instead of router.push('/tweetpage'), open the modal
    setSelectedTweetLink(item.Tweet_Link);
    setTweetModalVisible(true);
  };

  const handlesettingspress = async () => {
    if (!userToken) {
      alertNotLoggedIn();
      return;
    }
    router.push('/settings');
  };

  const handleArticlePress = (item: any) => {
    if (!userToken) {
      alertNotLoggedIn();
      return;
    }
    // Instead of pushing a new page, open the modal
    setSelectedArticleId(item.id);
    setModalVisible(true);
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

  useEffect(() => {
    fetchContent(activeCategory, selectedFilter);
  }, [activeCategory, selectedFilter]);

  // ------------------ Category & Filter Handlers ------------------
  const handleCategorySelect = (category: string) => {
    setActiveCategory(category);
    if (category === 'See All') {
      setIsSeeAll(true);
      setSelectedFilter('All'); // Optionally reset filter
    } else {
      setIsSeeAll(false);
    }
  };

  const handleFilterSelect = (filter: string) => {
    setSelectedFilter(filter);
    if (activeCategory === 'See All') {
      setSelectedFilter('All');
    }
  };

  // ------------------ Scroll Handling ------------------
  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    if (currentOffset > 300 && !scrolledFarDown) {
      setScrolledFarDown(true);
    } else if (currentOffset < 300 && scrolledFarDown) {
      setScrolledFarDown(false);
    }
  };

  const handleScrollToTop = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  // ------------------ Renders ------------------
  const renderContentCard = ({ item }: { item: any }) => {
    if (item.type === 'tweet') {
      return <TweetCard item={item} onPress={() => handleTweetPress(item)} />;
    }
    return <ArticleCard item={item} onPress={() => handleArticlePress(item)} />;
  };

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

  // ------------------ Header Rendering ------------------
  const renderHeader = () => {
    const categoriesWithSeeAll = [...categories, 'See All'];
    return (
      <HeaderTabs
        categories={categoriesWithSeeAll}
        activeCategory={activeCategory}
        onCategorySelect={handleCategorySelect}
        onFilterSelect={handleFilterSelect}
        selectedFilter={selectedFilter}
        username={username}
        profilePictureUrl={profilePictureUrl || undefined}
        onSettingsPress={handlesettingspress}
        onLoginPress={handleLogin}
      />
    );
  };

  // ------------------ Main Render ------------------

  // Define dynamic styles based on the theme
  const dynamicStyles = getStyles(isDarkTheme);

  if (pageLoading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={isDarkTheme ? '#BB9CED' : '#6C63FF'} />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      {renderHeader()}

      {/* Content Area */}
      <FlatList
        ref={flatListRef}
        data={articlesAndTweets}
        renderItem={renderContentCard}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
            listener: handleScroll,
          }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={dynamicStyles.listContentContainer}
        ListEmptyComponent={
          isLoading ? (
            <View style={dynamicStyles.loaderContainer}>
              <ActivityIndicator size="large" color={isDarkTheme ? '#BB9CED' : '#6C63FF'} />
            </View>
          ) : (
            <View style={dynamicStyles.emptyContainer}>
              <Text style={dynamicStyles.emptyText}>No content available.</Text>
            </View>
          )
        }
      />

      {/* Bottom Bar - Visible for all categories */}
      {renderBottomBar()}

      {/* Article Modal */}
      <ArticleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        articleId={selectedArticleId}
      />

      {/* Tweet Modal */}
      <TweetModal
        visible={tweetModalVisible}
        onClose={() => setTweetModalVisible(false)}
        tweetLink={selectedTweetLink}
      />
    </View>
  );
};

export default HomePage;

// ------------------ Styles ------------------
const getStyles = (isDarkTheme: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#1F2937' : '#F4F7FA',
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#1F2937' : '#F4F7FA',
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContentContainer: {
      paddingHorizontal: 15,
      paddingBottom: 80, // So bottom bar doesn't overlap content
      paddingTop: 10,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 20,
    },
    emptyContainer: {
      padding: 10,
      alignItems: 'center',
    },
    emptyText: {
      color: isDarkTheme ? '#D1D5DB' : '#555555',
      fontSize: 16,
    },
  });
