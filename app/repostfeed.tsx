// app/repostFeed.tsx

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { UserContext } from '../app/UserContext'; // Adjust the path if needed
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';
import { useRouter } from 'expo-router';

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const RepostFeedPage: React.FC = () => {
  const [sharedContent, setSharedContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { userToken, setUserToken } = useContext(UserContext); // Access token from context
  const router = useRouter();

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!userToken) {
        setUsername('Guest');
        await fetchSharedContent('Guest'); // If userToken not present, consider guest logic if backend allows
        return;
      }
      try {
        // Fetch username from token
        const usernameResponse = await fetch(`${domaindynamo}/get-username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken }),
        });
        const usernameData = await usernameResponse.json();
        const currentUsername =
          usernameData.status === 'Success' && usernameData.username
            ? usernameData.username
            : 'Guest';
        setUsername(currentUsername);

        await fetchSharedContent(currentUsername);
      } catch (err) {
        console.error('Error fetching username:', err);
        setUsername('Guest');
        await fetchSharedContent('Guest');
      }
    };

    fetchInitialData();
  }, [userToken]);

  const fetchSharedContent = async (username: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get_shared_content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: username }),
      });

      if (!response.ok)
        throw new Error(`Error: failed to fetch ${response.statusText}`);

      const data = await response.json();
      if (!data.shared_content)
        throw new Error('Shared content not found');

      console.log('Shared Content:', data.shared_content);

      const detailedContent = await Promise.all(
        data.shared_content.map(async (item: any) => {
          if (item.content_type === 'article') {
            const articleData = await fetchArticleContent(item.content_id);
            return { ...item, content_data: articleData || null };
          } else if (item.content_type === 'tweet') {
            const tweetData = await fetchTweetContent(item.content_id);
            return { ...item, content_data: tweetData || null };
          }
          return item;
        })
      );

      console.log('Detailed Content:', detailedContent);
      setSharedContent(detailedContent);
    } catch (err: any) {
      console.error('Error fetching shared content:', err);
      setError(err.message || 'Error fetching shared content');
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

      if (!response.ok)
        throw new Error(`Error fetching article: ${response.statusText}`);

      const data = await response.json();

      if (data.status === 'Error')
        throw new Error(data.error || 'Failed to fetch article content');

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

      if (!response.ok)
        throw new Error(`Error fetching tweet: ${response.statusText}`);

      const data = await response.json();

      if (data.status === 'Error')
        throw new Error(data.error || 'Failed to fetch tweet content');

      return data.data; // The tweet data
    } catch (error: any) {
      console.error(`Error in fetchTweetContent: ${error.message}`);
      return null; // Return null to handle gracefully
    }
  };

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

  const renderContentCard = ({ item }: { item: any }) => {
    console.log('Rendering Item:', item);
    if (!item.content_data) {
      console.warn('No content_data for item:', item);
      return (
        <View style={styles.missingContent}>
          <Text style={styles.missingContentText}>Content unavailable</Text>
        </View>
      );
    }

    // Display who it was shared by and when
    const sharedByUsername = item.username || 'Unknown User';
    const sharedAt = new Date(item.shared_at).toLocaleString(); // format if needed

    return (
      <View style={styles.sharedContentContainer}>
        <Text style={styles.sharedInfo}>
          Shared by {sharedByUsername} on {sharedAt}
        </Text>
        {item.content_type === 'article' ? (
          <ArticleCard item={item.content_data} onPress={() => handleArticlePress(item.content_data)} />
        ) : item.content_type === 'tweet' ? (
          <TweetCard item={item.content_data} onPress={() => handleContentPressLive(item.content_data)} />
        ) : null}
      </View>
    );
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
      <FlatList
        data={sharedContent}
        renderItem={renderContentCard}
        keyExtractor={(item, index) => `${item.content_id}-${index}`}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={<Text style={styles.noContent}>No shared content found.</Text>}
        accessible={true}
        accessibilityLabel="List of shared content"
      />
    </View>
  );
};

export default RepostFeedPage;

const styles = StyleSheet.create({
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
    color: 'red',
    fontSize: 18,
  },
  noContent: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  contentContainer: {
    padding: 20,
  },
  missingContent: {
    padding: 20,
    backgroundColor: '#FFEAEA',
    borderRadius: 10,
    marginBottom: 10,
  },
  missingContentText: {
    color: '#AA0000',
    textAlign: 'center',
  },
  sharedContentContainer: {
    marginBottom: 20,
  },
  sharedInfo: {
    marginBottom: 8,
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
});
