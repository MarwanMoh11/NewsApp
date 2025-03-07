// app/index.tsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';

import { UserContext } from '../app/UserContext';
import { ContentChoiceContext } from './contentchoice';
import HeaderTabs from '../components/HeaderTabs';
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

const Index: React.FC = () => {
  // Use ContentChoiceContext to determine the content type.
  const { contentChoice, setContentChoice } = useContext(ContentChoiceContext);

  // Other states
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [tweetModalVisible, setTweetModalVisible] = useState(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [isSeeAll, setIsSeeAll] = useState(false);

  // ------------------ Auth0 ------------------
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

  // ------------------ Categories ------------------
  const articleCategories = [
    "Business", "Crime", "Domestic", "Education", "Entertainment", "Environment",
    "Food", "Health", "Lifestyle", "Other", "Politics", "Science", "Sports",
    "Technology", "Top", "Tourism", "World",
  ];
  const tweetCategories = [
    "BREAKING NEWS", "Formula1", "Football", "Entertainment", "Health",
    "Science", "Business", "Travel", "Gaming",
  ];

  const [userPreferences, setUserPreferences] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    if (contentChoice.toLowerCase() === 'trending') {
      setCategories(["Trending"]);
      setActiveCategory("Trending");
    } else if (contentChoice.toLowerCase() === 'articles') {
      const filtered = articleCategories.filter((cat) =>
        userPreferences.some((pref) => pref.toLowerCase() === cat.toLowerCase())
      );
      const newCats = filtered.length > 0 ? filtered : articleCategories;
      setCategories(newCats);
      setActiveCategory(newCats[0]);
    } else if (contentChoice.toLowerCase() === 'tweets') {
      const filtered = tweetCategories.filter((cat) =>
        userPreferences.some((pref) => pref.toLowerCase() === cat.toLowerCase())
      );
      const newCats = filtered.length > 0 ? filtered : tweetCategories;
      setCategories(newCats);
      setActiveCategory(newCats[0]);
    } else {
      // "All" view: merge and remove duplicates.
      const filteredArticles = articleCategories.filter((cat) =>
        userPreferences.some((pref) => pref.toLowerCase() === cat.toLowerCase())
      );
      const filteredTweets = tweetCategories.filter((cat) =>
        userPreferences.some((pref) => pref.toLowerCase() === cat.toLowerCase())
      );
      const merged = [...filteredArticles, ...filteredTweets];
      const unique = merged.filter((item, index) =>
        merged.findIndex((i) => i.toLowerCase() === item.toLowerCase()) === index
      );
      const newCats = unique.length > 0 ? unique : [...articleCategories, ...tweetCategories];
      setCategories(newCats);
      setActiveCategory(newCats[0]);
    }
    setIsSeeAll(false);
  }, [contentChoice, userPreferences]);

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ------------------ User ------------------
  const [username, setUsername] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // ------------------ Context & Navigation ------------------
  const { userToken, isDarkTheme } = useContext(UserContext);
  const router = useRouter();
  const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

  // ------------------ Scroll Handling ------------------
  const [scrolledFarDown, setScrolledFarDown] = useState(false);
  const flatListRef = useRef<FlatList<any> | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // ------------------ Auth/Login ------------------
  const handleLogin = async () => {
    setLoadingLogin(true);
    setErrorMessage('');
    if (Platform.OS === 'web') {
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
        fetchProfilePicture(data.username);
        fetchPreferences(data.username);
      } else {
        setUsername(null);
        setProfilePictureUrl(null);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername(null);
      setProfilePictureUrl(null);
    }
  };

  const fetchPreferences = async (uname: string) => {
    if (!userToken) {
      const defaultPrefs = ['BREAKING NEWS', 'Football', 'Formula1', 'HEALTHY LIVING'];
      setUserPreferences(defaultPrefs);
      return;
    }
    try {
      const response = await fetch(`${domaindynamo}/check-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname }),
      });
      const data = await response.json();
      if (data.status === 'Success') {
        const fetchedPrefs: string[] = data.data.map((item: any) => item.preference);
        setUserPreferences(fetchedPrefs);
      } else {
        setUserPreferences([]);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      setUserPreferences([]);
    }
  };

  const fetchContent = async (category: string, filter: string) => {
    setArticlesAndTweets([]);
    setIsLoading(true);
    setErrorMessage('');
    try {
      if (contentChoice.toLowerCase() === 'trending') {
        const tweetsEndpoint = `${domaindynamo}/get_trending_tweets`;
        const tweetsResponse = await fetch(tweetsEndpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const tweetsData = await tweetsResponse.json();
        if (tweetsData.status === 'Success') {
          const tweets = tweetsData.data || [];
          setArticlesAndTweets(tweets.map((t: any) => ({ type: 'tweet', ...t })));
        } else if (tweetsData.status === 'No tweets found') {
          setArticlesAndTweets([]);
          setErrorMessage('No trending tweets found.');
        } else {
          setArticlesAndTweets([]);
          setErrorMessage('Failed to load trending tweets.');
        }
      } else {
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
            body: JSON.stringify({ category: activeCategory }),
          }),
          fetch(tweetsEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: activeCategory }),
          }),
        ]);

        const articlesData = await articlesResponse.json();
        const tweetsData = await tweetsResponse.json();

        let isArticlesSuccess = articlesResponse.ok && articlesData.status === 'Articles found';
        let isTweetsSuccess = tweetsResponse.ok && tweetsData.status === 'Tweets found';

        if (isArticlesSuccess || isTweetsSuccess) {
          let articles = isArticlesSuccess ? articlesData.data : [];
          let tweets = isTweetsSuccess ? tweetsData.data : [];

          if (contentChoice.toLowerCase() === 'articles') {
            tweets = [];
          } else if (contentChoice.toLowerCase() === 'tweets') {
            articles = [];
          } else if (contentChoice.toLowerCase() === 'all') {
            if (selectedFilter === 'Articles') {
              tweets = [];
            } else if (selectedFilter === 'Tweets') {
              articles = [];
            }
          }
          const combined = [
            ...tweets.map((t: any) => ({ type: 'tweet', dateTime: t.Created_At, ...t })),
            ...articles.map((a: any) => ({ type: 'article', dateTime: a.date, ...a })),
          ];

          const dayMap: Record<string, any[]> = {};
          combined.forEach((item) => {
            const day = formatDateToDay(item.dateTime);
            dayMap[day] = dayMap[day] ? [...dayMap[day], item] : [item];
          });
          const sortedDays = Object.keys(dayMap).sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
          );
          let finalContent: any[] = [];
          sortedDays.forEach((day) => {
            dayMap[day].sort(
              (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
            );
            finalContent.push(...dayMap[day]);
          });
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

  const handleTweetPress = async (item: any) => {
    if (!userToken) {
      alertNotLoggedIn();
      return;
    }
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

  useEffect(() => {
    fetchUsername();
  }, [userToken]);

  useEffect(() => {
    fetchContent(activeCategory, selectedFilter);
  }, [activeCategory, selectedFilter, contentChoice, isSeeAll]);

  const handleCategorySelect = (category: string) => {
    setActiveCategory(category);
    setIsSeeAll(false);
  };

  const handleFilterSelect = (filter: string) => {
    if (contentChoice.toLowerCase() === 'all') {
      setSelectedFilter(filter);
    }
  };

  const handleSeeAll = () => {
    setIsSeeAll(true);
  };

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

  const renderContentCard = ({ item }: { item: any }) => {
    if (item.type === 'tweet') {
      return <TweetCard item={item} onPress={() => handleTweetPress(item)} />;
    }
    return <ArticleCard item={item} onPress={() => handleArticlePress(item)} />;
  };

  const renderHeader = () => (
    <HeaderTabs
      categories={categories}
      activeCategory={activeCategory}
      onCategorySelect={handleCategorySelect}
      activeFilter={selectedFilter}
      onFilterSelect={handleFilterSelect}
      username={username}
      profilePictureUrl={profilePictureUrl || undefined}
      onSettingsPress={handlesettingspress}
      onLoginPress={handleLogin}
      onSavedPress={() => {
        if (!userToken) {
          alertNotLoggedIn();
        } else {
          router.push('/savedarticles');
        }
      }}
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
    />
  );

  const dynamicStyles = getStyles(isDarkTheme);

  if (pageLoading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      {renderHeader()}
      <FlatList
        ref={flatListRef}
        data={articlesAndTweets}
        renderItem={renderContentCard}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false, listener: handleScroll })}
        scrollEventThrottle={16}
        contentContainerStyle={dynamicStyles.listContentContainer}
        ListEmptyComponent={
          isLoading ? (
            <View style={dynamicStyles.loaderContainer}>
              <ActivityIndicator size="large" color="#1565C0" />
            </View>
          ) : (
            <View style={dynamicStyles.emptyContainer}>
              <Text style={dynamicStyles.emptyText}>No content available.</Text>
            </View>
          )
        }
        ListFooterComponent={
          !isSeeAll && articlesAndTweets.length > 0 ? (
            <TouchableOpacity style={dynamicStyles.seeAllButton} onPress={handleSeeAll}>
              <Text style={dynamicStyles.seeAllButtonText}>See All</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <ArticleModal visible={modalVisible} onClose={() => setModalVisible(false)} articleId={selectedArticleId} />
      <TweetModal visible={tweetModalVisible} onClose={() => setTweetModalVisible(false)} tweetLink={selectedTweetLink} />
    </View>
  );
};

export default Index;

const getStyles = (isDarkTheme: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#121212' : '#F4F7FA',
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#121212' : '#F4F7FA',
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContentContainer: {
      paddingHorizontal: 15,
      paddingBottom: 80, // Ensure content is not hidden behind the bottom bar.
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
      color: isDarkTheme ? '#B0B0B0' : '#555555',
      fontSize: 16,
    },
    seeAllButton: {
      backgroundColor: isDarkTheme ? '#333333' : '#A3A3A3',
      paddingVertical: 12,
      marginVertical: 10,
      borderRadius: 6,
      alignItems: 'center',
      marginHorizontal: 50,
    },
    seeAllButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
