// ------------------------------------------------------
// pages/SavedArticles.tsx
// ------------------------------------------------------
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserContext } from '../app/UserContext'; // Adjust the import path as necessary
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';
import BackButton from '../components/ui/BackButton';
import TweetModal from './tweetpage'; // Import the TweetModal component
import ArticleModal from './articlepage'; // Import the ArticleModal component

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const SavedArticles: React.FC = () => {
  // ------------------ States ------------------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [username, setUsername] = useState<string>('');
  const router = useRouter();
  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext); // Consume isDarkTheme

  const lastOffset = useRef(0);
  const [showButton, setShowButton] = useState(true); // Controls button visibility

  // Modal states
  const [tweetModalVisible, setTweetModalVisible] = useState<boolean>(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [articleModalVisible, setArticleModalVisible] = useState<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

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

  // Remove handleContentPressLive as it's redundant
  // Modify handleContentPress to open the modal for tweets and articles
  const handleContentPress = (item: any) => {
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
          onPress={() => handleContentPress(item)} // Pass the item to handleContentPress
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
      <View style={[styles.centered, { backgroundColor: isDarkTheme ? '#111827' : '#FFFFFF' }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={[styles.loadingText, { color: isDarkTheme ? '#D1D5DB' : '#888' }]}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: isDarkTheme ? '#111827' : '#FFFFFF' }]}>
        <Text style={[styles.errorText, { color: isDarkTheme ? '#F87171' : 'red' }]}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkTheme ? '#111827' : '#FFFFFF' }]}>
      {/* Header with Back Button and "Saved Articles" Title */}
      <View style={[styles.header, { borderBottomColor: isDarkTheme ? '#374151' : '#E0E0E0' }]}>
        <BackButton />
        <Text style={[styles.headerTitle, { color: isDarkTheme ? '#F3F4F6' : '#333333' }]}>Saved Articles</Text>
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
            <Text style={[styles.emptyText, { color: isDarkTheme ? '#D1D5DB' : '#555555' }]}>
              No saved articles
            </Text>
          </View>
        }
        // Adjust FlatList background based on theme
        style={{ backgroundColor: isDarkTheme ? '#111827' : '#FFFFFF' }}
      />

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
    </View>
  );
};

export default SavedArticles;

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative', // Ensure that absolutely positioned children are relative to this container
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60, // Adjust if you have a safe area or need more spacing
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
  },
});
