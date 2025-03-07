// ------------------------------------------------------
// app/repostFeed.tsx
// ------------------------------------------------------
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
  Image,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { UserContext } from '../app/UserContext';
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';
import { useRouter } from 'expo-router';
import TweetModal from './tweetpage';
import ArticleModal from './articlepage';

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

// TypeScript Interfaces
interface ApiResponse<T> {
  status: 'Success' | 'Error';
  data?: T;
  message?: string;
  error?: string;
}

interface SearchResult {
  type: 'article' | 'tweet';
  content_id: string;
  time: string;
  username: string;
  shared_at: string;
  content_type: 'article' | 'tweet';
  content_data?: ArticleData | TweetData;
  profile_picture?: string;
}

interface ArticleData {
  id: number;
  headline: string;
  content: string;
}

interface TweetData {
  Tweet_Link: string;
  Tweet: string;
  Created_At: string;
}

const RepostFeedPage: React.FC = () => {
  const [sharedContent, setSharedContent] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { userToken, isDarkTheme } = useContext(UserContext);
  const router = useRouter();

  // Modal states
  const [tweetModalVisible, setTweetModalVisible] = useState<boolean>(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [articleModalVisible, setArticleModalVisible] = useState<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Get dynamic styles based on theme
  const styles = getStyles(isDarkTheme);

  // Helper to fetch profile picture
  const fetchUserProfilePicture = async (user: string): Promise<string> => {
    try {
      const response = await fetch(
        `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(user)}`
      );
      const data = await response.json();
      console.log(`Fetched profile picture for ${user}:`, data);
      if (data.status === 'Success' && data.profile_picture) {
        return data.profile_picture;
      } else {
        console.warn(`No profile picture for ${user}. Using default.`);
        return 'https://via.placeholder.com/50?text=User';
      }
    } catch (error) {
      console.error(`Error fetching profile picture for ${user}:`, error);
      return 'https://via.placeholder.com/50?text=User';
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userToken) {
        setUsername('Guest');
        await fetchSharedContent('Guest');
        return;
      }
      try {
        const usernameResponse = await fetch(`${domaindynamo}/get-username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken }),
        });
        const usernameData = await usernameResponse.json();
        console.log('Username fetched:', usernameData);
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

    fetchProfile();
  }, [userToken]);

  const fetchSharedContent = async (user: string) => {
    try {
      console.log(`Fetching shared content for ${user}...`);
      const response = await fetch(`${domaindynamo}/get_shared_content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: user }),
      });
      if (!response.ok) {
        throw new Error(`Error: failed to fetch ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Raw shared content data:', data);
      if (!data.shared_content) {
        throw new Error('Shared content not found');
      }
      if (data.shared_content.length === 0) {
        setSharedContent([]);
        setError(null);
        setLoading(false);
        return;
      }
      // Enhance each shared item with profile picture and detailed content
      const detailedContent = await Promise.all(
        data.shared_content.map(async (item: any) => {
          const profile_picture = await fetchUserProfilePicture(item.username);
          if (item.content_type === 'article') {
            const articleData = await fetchArticleContent(item.content_id);
            return { ...item, content_data: articleData || null, profile_picture };
          } else if (item.content_type === 'tweet') {
            const tweetData = await fetchTweetContent(item.content_id);
            return { ...item, content_data: tweetData || null, profile_picture };
          }
          return { ...item, profile_picture };
        })
      );
      console.log('Detailed shared content:', detailedContent);
      setSharedContent(detailedContent);
    } catch (err: any) {
      console.error('Error fetching shared content:', err);
      setError(err.message || 'Error fetching shared content');
    } finally {
      setLoading(false);
    }
  };

  const fetchArticleContent = async (id: number): Promise<ArticleData | null> => {
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
      return data.data;
    } catch (error: any) {
      console.error(`Error in fetchArticleContent: ${error.message}`);
      return null;
    }
  };

  const fetchTweetContent = async (link: string): Promise<TweetData | null> => {
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
      return data.data;
    } catch (error: any) {
      console.error(`Error in fetchTweetContent: ${error.message}`);
      return null;
    }
  };

  const handleArticlePress = (articleData: ArticleData) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to view articles.');
      return;
    }
    setSelectedArticleId(articleData.id.toString());
    setArticleModalVisible(true);
  };

  const handleTweetPress = (tweetData: TweetData) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to view tweets.');
      return;
    }
    setSelectedTweetLink(tweetData.Tweet_Link);
    setTweetModalVisible(true);
  };

  const renderContentCard = ({ item }: { item: SearchResult }) => {
    console.log('Rendering shared item:', item);
    if (!item.content_data) {
      console.warn('Missing content_data for item:', item);
      return (
        <View
          style={[
            styles.missingContent,
            { backgroundColor: isDarkTheme ? '#374151' : '#FFEAEA' },
          ]}
        >
          <Text
            style={[
              styles.missingContentText,
              { color: isDarkTheme ? '#F87171' : '#AA0000' },
            ]}
          >
            Content unavailable
          </Text>
        </View>
      );
    }
    const sharedByUsername = item.username || 'Unknown User';
    const sharedAt = new Date(item.shared_at).toLocaleString();
    return (
      <View
        style={[
          styles.sharedContentContainer,
          { backgroundColor: isDarkTheme ? '#0F0F0F' : '#FFFFFF' },
        ]}
      >
        <View style={styles.userInfoContainer}>
          <Image
            source={{ uri: item.profile_picture }}
            style={[
              styles.profilePicture,
              { borderColor: isDarkTheme ? '#BB9CED' : '#6D28D9' },
            ]}
            accessibilityLabel={`${sharedByUsername}'s profile picture`}
          />
          <View style={styles.userTextContainer}>
            <Text
              style={[
                styles.sharedInfo,
                { color: isDarkTheme ? '#D1D5DB' : '#555555' },
              ]}
            >
              {sharedByUsername}
            </Text>
            <Text
              style={[
                styles.sharedTimestamp,
                { color: isDarkTheme ? '#D1D5DB' : '#555555' },
              ]}
            >
              Shared on {sharedAt}
            </Text>
          </View>
        </View>
        {item.content_type === 'article' ? (
          <ArticleCard
            item={item.content_data}
            onPress={() => handleArticlePress(item.content_data as ArticleData)}
            isDarkTheme={isDarkTheme}
          />
        ) : item.content_type === 'tweet' ? (
          <TweetCard
            item={item.content_data}
            onPress={() => handleTweetPress(item.content_data as TweetData)}
            isDarkTheme={isDarkTheme}
          />
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: isDarkTheme ? '#121212' : '#FFFFFF' },
        ]}
      >
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={[styles.loadingText, { color: isDarkTheme ? '#D1D5DB' : '#888888' }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkTheme ? '#121212' : '#FFFFFF' }]}>
      <FlatList
        data={sharedContent}
        renderItem={renderContentCard}
        keyExtractor={(item, index) => `${item.content_id}-${index}`}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={
          <Text style={[styles.noContent, { color: isDarkTheme ? '#D1D5DB' : '#555555' }]}>
            No content found.
          </Text>
        }
        accessible={true}
        accessibilityLabel="List of shared content"
        style={{ backgroundColor: isDarkTheme ? '#121212' : '#FFFFFF' }}
      />
      <ArticleModal
        visible={articleModalVisible}
        onClose={() => setArticleModalVisible(false)}
        articleId={selectedArticleId}
      />
      <TweetModal
        visible={tweetModalVisible}
        onClose={() => setTweetModalVisible(false)}
        tweetLink={selectedTweetLink}
      />
    </View>
  );
};

export default RepostFeedPage;

// ------------------------------------------------------
// Dynamic STYLES
// ------------------------------------------------------
const getStyles = (isDarkTheme: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#121212' : '#F4F7FA',
      position: 'relative',
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
      fontSize: 18,
      color: 'red',
    },
    noContent: {
      textAlign: 'center',
      fontSize: 16,
      marginTop: 20,
    },
    contentContainer: {
      padding: 20,
    },
    missingContent: {
      padding: 20,
      borderRadius: 10,
      marginBottom: 10,
    },
    missingContentText: {
      textAlign: 'center',
    },
    sharedContentContainer: {
      marginBottom: 20,
      padding: 15,
      borderRadius: 8,
    },
    sharedInfo: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    sharedTimestamp: {
      fontSize: 12,
    },
    userInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    profilePicture: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
    },
    userTextContainer: {
      flexDirection: 'column',
      marginLeft: 10,
    },
  });
