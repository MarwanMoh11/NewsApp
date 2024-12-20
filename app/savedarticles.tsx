// pages/SavedArticles.tsx

import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserContext } from '../app/UserContext';
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';
import BackButton from '../components/ui/BackButton';

const domaindynamo = 'https://keen-alfajores-31c262.netlify.app/.netlify/functions/index';

const SavedArticles: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const router = useRouter();
  const { userToken, setUserToken } = useContext(UserContext);

  const lastOffset = useRef(0);
  const [showButton, setShowButton] = useState(true); // Controls button visibility

  const formatToUTCA = (isoDate: string): string => {
    const date = new Date(isoDate);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    // Fetch username once the token is available
    if (userToken) {
      fetchUsername();
    }
  }, [userToken]);

  useEffect(() => {
    // Fetch saved content once the username is available
    if (username) {
      fetchContent();
    }
  }, [username]);

  const fetchUsername = async () => {
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
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('');
    }
  };

  const fetchContent = async () => {
    if (!userToken) {
      console.error('Token is required for fetching content.');
      return;
    }
    try {
      const response = await fetch(`${domaindynamo}/show-saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username }), // backend should decode username
      });

      const textResponse = await response.clone().text();
      console.log('Server response:', textResponse);

      const data = await response.json();
      if (!data.data) throw new Error('Saved content not found');
      console.log(data.data);

      const detailedContent = await Promise.all(
        data.data.map(async (item: any) => {
          if (item.type === 'article') {
            return { ...item, content_data: await fetchArticleContent(item.id) };
          } else if (item.type === 'tweet') {
            return { ...item, content_data: await fetchTweetContent(item.id) };
          }
          return item;
        })
      );

      setArticlesAndTweets(detailedContent);
    } catch (err: any) {
      console.error('Error fetching saved content:', err);
      setError(err.message || 'Error fetching saved content');
    } finally {
      setLoading(false);
    }
  };

  const fetchArticleContent = async (id: number) => {
    try {
      const response = await fetch(`${domaindynamo}/get-article-by-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error(`Error fetching article: ${response.statusText}`);

      const data = await response.json();

      if (data.status === 'Error') throw new Error(data.error || 'Failed to fetch article content');

      return data.data; // The article data
    } catch (error: any) {
      console.error(`Error in fetchArticleContent: ${error.message}`);
      return null; // Return null to handle gracefully
    }
  };

  const fetchTweetContent = async (link: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get-tweet-by-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link }),
      });

      if (!response.ok) throw new Error(`Error fetching tweet: ${response.statusText}`);

      const data = await response.json();

      if (data.status === 'Error') throw new Error(data.error || 'Failed to fetch tweet content');

      return data.data; // The tweet data
    } catch (error: any) {
      console.error(`Error in fetchTweetContent: ${error.message}`);
      return null; // Return null to handle gracefully
    }
  };

  const handleContentPressLive = async (item: any) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to view tweets.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/set-tweettodisp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, tweet: item }),
      });

      console.log('Response Status:', response.status);
      const data = await response.json();
      console.log('Response Data:', data);

      if (data.status === 'Success') {
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

  const handleContentPress = async (item: any) => {
    if (item.type === 'tweet') {
      if (!userToken) {
        Alert.alert('Error', 'You must be logged in to view tweets.');
        return;
      }

      try {
        const response = await fetch(`${domaindynamo}/set-tweet-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: item.id }),
        });

        const data = await response.json();
        if (data.status === 'Success') {
          router.push('/tweetpage');
        } else {
          Alert.alert('Error', 'Failed to set tweet link');
        }
      } catch (error) {
        console.error('Error setting tweet link:', error);
        Alert.alert('Error', 'Unable to set tweet link');
      }
    } else if (item.type === 'article') {
      try {
        const response = await fetch(`${domaindynamo}/set-article-id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken, id: item.id }),
        });

        const data = await response.json();
        if (data.status === 'Success') {
          router.push('/articlepage');
        } else {
          Alert.alert('Error', 'Failed to set article ID');
        }
      } catch (error) {
        console.error('Error setting article ID:', error);
        Alert.alert('Error', 'Unable to set article ID');
      }
    }
  };

  const renderContentCard = ({ item }: { item: any }) => {
    console.log('Rendering: ', item);
    if (item.type === 'article' && item.content_data) {
      return (
        <ArticleCard
          item={item.content_data}
          onPress={() => handleContentPress(item)}
        />
      );
    } else if (item.type === 'tweet' && item.content_data) {
      return (
        <TweetCard
          item={item.content_data}
          onPress={() => handleContentPressLive(item.content_data)}
        />
      );
    }
    return null;
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button and "Saved Articles" Title */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Saved Articles</Text>
      </View>

      <FlatList
        data={articlesAndTweets}
        renderItem={renderContentCard}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        contentContainerStyle={styles.listContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No saved articles</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  logoImage: {
    width: 300,
    height: 100,
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60, // Adjust if you have a safe area or need more spacing
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  listContainer: {
    paddingVertical: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});

export default SavedArticles;
