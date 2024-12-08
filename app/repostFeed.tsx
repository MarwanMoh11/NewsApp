import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { UserContext } from '../app/UserContext'; // Adjust the path if needed

const domaindynamo = 'https://keen-alfajores-31c262.netlify.app/.netlify/functions/index';

const RepostFeedPage = () => {
  const [sharedContent, setSharedContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { userToken } = useContext(UserContext); // Access token from context

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!userToken) {
        setUsername('Guest');
        await fetchSharedContent(); // If userToken not present, we consider guest logic if backend allows
        return;
      }
      try {
        // Fetch username from token
        const usernameResponse = await fetch(`${domaindynamo}/get-username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken })
        });
        const usernameData = await usernameResponse.json();
        const currentUsername = (usernameData.status === 'Success' && usernameData.username) ? usernameData.username : 'Guest';
        setUsername(currentUsername);

        await fetchSharedContent(currentUsername);
      } catch (err) {
        console.error('Error fetching username:', err);
        setUsername('Guest');
        await fetchSharedContent();
      }
    };

    fetchInitialData();
  }, [userToken]);

  const fetchSharedContent = async (username: string) => {
    try {
      // Send token to get_shared_content.
      const response = await fetch(`${domaindynamo}/get_shared_content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: username })
      });

      if (!response.ok) throw new Error(`Error:failed to fetch ${response.statusText}`);

      const data = await response.json();
      if (!data.shared_content) throw new Error('Shared content not found');

      const detailedContent = await Promise.all(
        data.shared_content.map(async (item: any) => {
          if (item.content_type === 'article') {
            return { ...item, content_data: await fetchArticleContent(item.content_id) };
          } else if (item.content_type === 'tweet') {
            return { ...item, content_data: await fetchTweetContent(item.content_id) };
          }
          return item;
        })
      );

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

  const renderItem = ({ item }: { item: any }) => (
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
      keyExtractor={(item: any) => item.content_id.toString()}
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
  errorText: {
    color: 'red',
    fontSize: 18,
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
  noContent: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
});

export default RepostFeedPage;
