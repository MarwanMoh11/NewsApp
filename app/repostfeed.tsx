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
  Image, // Import Image for displaying profile pictures
} from 'react-native';
import { UserContext } from '../app/UserContext'; // Access UserContext
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';
import { useRouter } from 'expo-router';
import TweetModal from './tweetpage'; // Correct import path
import ArticleModal from './articlepage'; // Correct import path

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
  content_id: string; // Changed from 'id' to 'content_id' for consistency
  time: string;
  username: string;
  shared_at: string;
  content_type: 'article' | 'tweet';
  content_data?: ArticleData | TweetData;
}

interface ArticleData {
  id: number;
  headline: string;
  content: string;
  // Add other relevant fields
}

interface TweetData {
  Tweet_Link: string;
  Tweet: string;
  Created_At: string;
  // Add other relevant fields
}

const RepostFeedPage: React.FC = () => {
  const [sharedContent, setSharedContent] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext); // Consume isDarkTheme from context
  const router = useRouter();

  // Modal states
  const [tweetModalVisible, setTweetModalVisible] = useState<boolean>(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [articleModalVisible, setArticleModalVisible] = useState<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Helper function to fetch profile picture by username
  const fetchUserProfilePicture = async (username: string): Promise<string> => {
    try {
      const response = await fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(username)}`);
      const data = await response.json();

      if (data.status === 'Success' && data.profile_picture) {
        return data.profile_picture;
      } else {
        console.warn(`No profile picture found for username: ${username}. Using default.`);
        return 'https://via.placeholder.com/50?text=User'; // Default profile picture
      }
    } catch (error) {
      console.error(`Error fetching profile picture for ${username}:`, error);
      return 'https://via.placeholder.com/50?text=User'; // Default profile picture on error
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
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

    fetchProfile();
  }, [userToken]);

  const fetchSharedContent = async (username: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get_shared_content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: username }),
      });

      if (!response.ok) {
        throw new Error(`Error: failed to fetch ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.shared_content) {
        throw new Error('Shared content not found');
      }

      console.log('Shared Content:', data.shared_content);

      if (data.shared_content.length === 0) {
        // No shared content found, do not set error
        setSharedContent([]);
        setError(null);
        setLoading(false);
        return;
      }

      const detailedContent = await Promise.all(
        data.shared_content.map(async (item: any) => {
          // Fetch profile picture for the user who shared the content
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

      console.log('Detailed Content with Profile Pictures:', detailedContent);
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

      return data.data; // The article data
    } catch (error: any) {
      console.error(`Error in fetchArticleContent: ${error.message}`);
      return null; // Return null to handle gracefully
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

      return data.data; // The tweet data
    } catch (error: any) {
      console.error(`Error in fetchTweetContent: ${error.message}`);
      return null; // Return null to handle gracefully
    }
  };

  // Modify handleArticlePress and handleTweetPress to open modals with id and link
  const handleArticlePress = (articleData: ArticleData) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to view articles.');
      return;
    }

    // Open ArticleModal with the article ID
    setSelectedArticleId(articleData.id.toString());
    setArticleModalVisible(true);
  };

  const handleTweetPress = (tweetData: TweetData) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to view tweets.');
      return;
    }

    // Open TweetModal with the tweet link
    setSelectedTweetLink(tweetData.Tweet_Link);
    setTweetModalVisible(true);
  };

  const renderContentCard = ({ item }: { item: SearchResult }) => {
    console.log('Rendering Item:', item);
    if (!item.content_data) {
      console.warn('No content_data for item:', item);
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

    // Display who it was shared by and when
    const sharedByUsername = item.username || 'Unknown User';
    const sharedAt = new Date(item.shared_at).toLocaleString(); // format if needed

    return (
      <View
        style={[
          styles.sharedContentContainer,
          { backgroundColor: isDarkTheme ? '#1F2937' : '#FFFFFF' },
        ]}
      >
        {/* User Info Section */}
        <View style={styles.userInfoContainer}>
          <Image
            source={{ uri: item.profile_picture }}
            style={[
              styles.profilePicture,
              {
                borderColor: isDarkTheme ? '#BB9CED' : '#6D28D9',
              },
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

        {/* Content Card */}
        {item.content_type === 'article' ? (
          <ArticleCard
            item={item.content_data}
            onPress={() => handleArticlePress(item.content_data as ArticleData)}
            isDarkTheme={isDarkTheme} // Pass theme prop if needed
          />
        ) : item.content_type === 'tweet' ? (
          <TweetCard
            item={item.content_data}
            onPress={() => handleTweetPress(item.content_data as TweetData)}
            isDarkTheme={isDarkTheme} // Pass theme prop if needed
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
          { backgroundColor: isDarkTheme ? '#111827' : '#FFFFFF' },
        ]}
      >
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text
          style={[
            styles.loadingText,
            { color: isDarkTheme ? '#D1D5DB' : '#888888' },
          ]}
        >
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkTheme ? '#111827' : '#FFFFFF' },
      ]}
    >
      <FlatList
        data={sharedContent}
        renderItem={renderContentCard}
        keyExtractor={(item, index) => `${item.content_id}-${index}`}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={
          <Text
            style={[
              styles.noContent,
              { color: isDarkTheme ? '#D1D5DB' : '#555555' },
            ]}
          >
            No content found.
          </Text>
        }
        accessible={true}
        accessibilityLabel="List of shared content"
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

export default RepostFeedPage;

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
    color: '#888888', // Will be overridden dynamically
  },
  errorText: {
    fontSize: 18,
    color: 'red', // Will be overridden dynamically
  },
  noContent: {
    textAlign: 'center',
    fontSize: 16,
    color: '#555555', // Will be overridden dynamically
    marginTop: 20,
  },
  contentContainer: {
    padding: 20,
  },
  missingContent: {
    padding: 20,
    backgroundColor: '#FFEAEA', // Light red background for missing content
    borderRadius: 10,
    marginBottom: 10,
  },
  missingContentText: {
    color: '#AA0000', // Dark red text for missing content
    textAlign: 'center',
  },
  sharedContentContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    // Background color handled dynamically
  },
  sharedInfo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555555', // Default gray, overridden dynamically
  },
  sharedTimestamp: {
    fontSize: 12,
    color: '#555555', // Default gray, overridden dynamically
  },
  // ------------------ User Info Section ------------------
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  profilePicture: {
    width: 40, // Adjust size as needed
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    // borderColor set dynamically in the component
  },
  userTextContainer: {
    flexDirection: 'column',
  },
});
