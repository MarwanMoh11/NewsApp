// pages/HomePage.tsx

import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomButtonWithBar from '../components/ui/ChronicallyButton.tsx'; // Ensure correct path
import TrendingScreen from '../app/trending';
import { UserContext } from '../app/UserContext'; // Adjust path as needed
import TweetCard from '../components/TweetCard'; // Reusable TweetCard component
import ArticleCard from '../components/ArticleCard'; // Reusable ArticleCard component
import CategoryFilter from '../components/CategoryFilter'; // Reusable CategoryFilter component
import HeaderTabs from '../components/HeaderTabs.tsx'

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'My News' | 'Trending'>('My News');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [isSeeAll, setIsSeeAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { userToken, setUserToken } = useContext(UserContext);
  const router = useRouter();
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

  const lastOffset = useRef(0);
  const [showButton, setShowButton] = useState(true); // Controls button visibility

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

  // Fetch username based on token
  const fetchUsername = async () => {
    if (!userToken) {
      console.error('No token available to fetch username');
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
        fetchPreferences(data.username);
      } else {
        setPreferences([]);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setPreferences([]);
    }
  };

  // Fetch user preferences based on username
  const fetchPreferences = async (username: string) => {
    if (!userToken) return;
    try {
      const response = await fetch(`${domaindynamo}/check-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username }),
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
  };

  // Fetch content (tweets and articles) based on category
  const fetchContent = async (category: string) => {
    setIsLoading(true);
    setErrorMessage(null);
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

      // Check if either articles or tweets are found
      if (articlesData.status === 'Articles found' || tweetsData.status === 'Tweets found') {
        const tweets = tweetsData.data || [];
        const articles = articlesData.data || [];

        let combinedContent: any[] = [];

        if (tweets.length > 0 && articles.length > 0) {
          // Total number of items available
          const totalItems = tweets.length + articles.length;

          // Desired counts based on 70/30 ratio
          const desiredTweetsCount = Math.floor(totalItems * 0.7);
          const desiredArticlesCount = Math.floor(totalItems * 0.3);

          // Ensure we don't exceed available tweets and articles
          const actualTweetsCount = Math.min(desiredTweetsCount, tweets.length);
          const actualArticlesCount = Math.min(desiredArticlesCount, articles.length);

          // Select the top tweets and articles based on the desired counts
          const selectedTweets = tweets.slice(0, actualTweetsCount);
          const selectedArticles = articles.slice(0, actualArticlesCount);

          // Combine the selected tweets and articles
          combinedContent = [
            ...selectedTweets.map((item: any) => ({ type: 'tweet', ...item })),
            ...selectedArticles.map((item: any) => ({ type: 'article', ...item })),
          ];

          // Sort the combined content by date descending (most recent first)
          combinedContent.sort(
            (a, b) =>
              new Date(b.date || b.Created_At).getTime() -
              new Date(a.date || a.Created_At).getTime()
          );
        } else if (tweets.length > 0) {
          // Only tweets are available
          combinedContent = tweets.map((item: any) => ({ type: 'tweet', ...item }));
          combinedContent.sort(
            (a, b) => new Date(b.Created_At).getTime() - new Date(a.Created_At).getTime()
          );
        } else if (articles.length > 0) {
          // Only articles are available
          combinedContent = articles.map((item: any) => ({ type: 'article', ...item }));
          combinedContent.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        }

        setArticlesAndTweets(combinedContent);
      } else {
        // Neither articles nor tweets are found
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

  // Handle pressing on a tweet
  const handleTweetPress = async (item: any) => {
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

  // Handle pressing on an article
  const handleArticlePress = async (item: any) => {
    const endpoint = 'set-article-id';
    try {
      const response = await fetch(`${domaindynamo}/${endpoint}`, {
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

  // Initialize user data
  useEffect(() => {
    if (userToken) {
      fetchUsername();
    }
  }, [userToken]);

  // Handle category selection
  const handleCategorySelect = (category: string) => {
    setIsSeeAll(false);
    setSelectedCategory(category);
    fetchContent(category);
  };

  // Handle "See All" selection
  const handleSeeAll = () => {
    setIsSeeAll(true);
    setSelectedCategory(null);
    fetchContent('all');

  };

  // Render individual content cards
  const renderContentCard = ({ item }: { item: any }) => {
    if (item.type === 'article') {
      return <ArticleCard item={item} onPress={handleArticlePress} />;
    } else if (item.type === 'tweet') {
      return <TweetCard item={item} onPress={handleTweetPress} />;
    }
    return null;
  };

  // Navigation handlers
  const handleHomePress = () => {
    router.push('/mynews');
  };

  const handleBookmarkPress = () => {
    router.push('/savedarticles');
  };

  const handleAddressBookPress = () => {
    router.push('/followingpage');
  };

  const handleSearchPress = () => {
    router.push('/searchpage');
    console.log('Search button pressed!');
  };

  // Handle scroll to show/hide the button
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
      {/* Header with Tabs */}
      <HeaderTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSettingsPress={() => router.push('/settings')}
      />

      {/* Content Based on Active Tab */}
      {activeTab === 'Trending' ? (
        <TrendingScreen />
      ) : (
        <>
          {/* Category Filter */}
          <CategoryFilter
            categories={preferences}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            onSeeAll={handleSeeAll}
            isSeeAll={isSeeAll}
          />

          {/* Loading Indicator */}
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

          {/* Custom Floating Button */}
          <CustomButtonWithBar
            isVisible={showButton}
            barButtons={[
              { iconName: 'home', onPress: handleHomePress },
              { iconName: 'bookmark', onPress: handleBookmarkPress },
              { iconName: 'address-book', onPress: handleAddressBookPress },
              { iconName: 'search', onPress: handleSearchPress },
            ]}
            onMainButtonPress={() => {
              // Optional: handle main button press if needed
              console.log('Main button pressed!');
            }}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 100, // Space for the floating button
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

export default HomePage;
