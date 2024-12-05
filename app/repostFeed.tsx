import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';

const domaindynamo = Platform.OS === 'web'
  ? 'http://localhost:3000' // Use your local IP address for web
  : 'http://192.168.100.2:3000'; // Use localhost for mobile emulator or device

const RepostFeedPage = () => {
  const [sharedContent, setSharedContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const usernameResponse = await fetch(`${domaindynamo}/get-username`);
        const usernameData = await usernameResponse.json();
        const currentUsername = usernameData.username || 'Guest';
        setUsername(currentUsername);
        await fetchSharedContent(currentUsername);
      } catch (err) {
        console.error('Error fetching username:', err);
        setUsername('Guest');
        await fetchSharedContent('Guest');
      }
    };

    fetchInitialData();
  }, []);

  const fetchSharedContent = async (followerUsername) => {
    try {
      const response = await fetch(`${domaindynamo}/get_shared_content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: followerUsername }),
      });

      if (!response.ok) throw new Error(`Error:failed to fetch ${response.statusText}`);

      const data = await response.json();
      if (!data.shared_content) throw new Error('Shared content not found');

      const detailedContent = await Promise.all(
        data.shared_content.map(async (item) => {
          if (item.content_type === 'article') {
            return { ...item, content_data: await fetchArticleContent(item.content_id) };
          } else if (item.content_type === 'tweet') {
            return { ...item, content_data: await fetchTweetContent(item.content_id) };
          }
          return item;
        })
      );

      setSharedContent(detailedContent);
    } catch (err) {
      console.error('Error fetching shared content:', err);
      setError(err.message || 'Error fetching shared content');
    } finally {
      setLoading(false);
    }
  };

  const fetchArticleContent = async (id) => {
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
    } catch (error) {
      console.error(`Error in fetchArticleContent: ${error.message}`);
      return null; // Return null to handle gracefully
    }
  };

  const fetchTweetContent = async (link) => {
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
    } catch (error) {
      console.error(`Error in fetchTweetContent: ${error.message}`);
      return null; // Return null to handle gracefully
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
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

  const renderItem = ({ item }) => (
    <View key={item.content_id} style={styles.card}>
      <Text style={styles.subTitle}>
        Shared by {item.username} on {new Date(item.shared_at).toLocaleString()}
      </Text>
      {item.content_type === 'article' && item.content_data && (
        <View>
          <Text style={styles.headline}>{item.content_data.headline}</Text>
          <Text>{item.content_data.short_description}</Text>
          <Text>Category: {item.content_data.category}</Text>
          <Text>Authors: {item.content_data.authors}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(item.content_data.link)}>
            <Text style={styles.link}>Read more</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.content_type === 'tweet' && item.content_data && (
        <View>
          <Text>{item.content_data.Tweet}</Text>
          <Text>
            <Text style={styles.bold}>Retweets:</Text> {item.content_data.Retweets} |{' '}
            <Text style={styles.bold}>Favorites:</Text> {item.content_data.Favorites}
          </Text>
          <Text>
            <Text style={styles.bold}>Created at:</Text> {new Date(item.content_data.Created_At).toLocaleString()}
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(item.content_data.Tweet_Link)}>
            <Text style={styles.link}>View tweet</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={sharedContent}
      keyExtractor={(item) => item.content_id.toString()}
      renderItem={renderItem}
      ListEmptyComponent={<Text style={styles.noContent}>No shared content found.</Text>}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  card: {
        backgroundColor: '#8A7FDC',
        borderRadius: 10,
        marginBottom: 5,
        padding: 10,
        alignSelf: 'center',
        width: '95%',
  },
  headline: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  link: {
    color: '#007BFF',
    marginTop: 8,
  },
  bold: {
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontSize: 18,
  },
  noContent: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },

  backIcon: {
    marginBottom: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  tweetCard: {
    backgroundColor: '#000000',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  tweetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  tweetText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  media: {
    width: '100%',
    height: 200,
    marginBottom: 10,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  aiExplanationHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  aiExplanationText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 20,
  },
  actionIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loadingText: {
    fontSize: 16,
    color: '#A1A0FE',},
});

export default RepostFeedPage;