import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, FlatList, Alert, Image,  ActivityIndicator, Platform} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomButton from '../components/ui/ChronicallyButton';

const domaindynamo = Platform.OS === 'web'
  ? 'http://localhost:3000' // Use your local IP address for web
  : 'http://192.168.100.2:3000'; // Use localhost for mobile emulator or device

const HomePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const router = useRouter();
  const formatToUTCT = (isoDate: string) => {
    const date = new Date(isoDate);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${hours}:${minutes} ${day}-${month}-${year}`;
  };
  const formatToUTCA = (isoDate: string) => {
    const date = new Date(isoDate);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    if (username) {
      console.log('Username is set:', username);
      fetchContent();
    }
  }, [username]);


  const fetchUsername = async () => {
    try {
      const response = await fetch(`${domaindynamo}/get-username`);
      const data = await response.json();
      if (data.username) {
        setUsername(data.username)
      } else {
        setUsername('');
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('');
    }
  };

  const handleContentPressLive = async (item: any) => {
        console.log('Item:', item);
        console.log('Request Body:', JSON.stringify({ tweet: item }));
        try {
          const response = await fetch(`${domaindynamo}/set-tweettodisp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tweet: item }),
          });

          console.log('Response Status:', response.status);
          const data = await response.json();
          console.log('Response Data:', data);

          if (data.status === 'Success') {
            router.push('/tweetpage');
          } else {
            Alert.alert('Error', 'Failed to set tweet data');
          }
        } catch (error) {
          console.error('Error setting tweet data:', error);
          Alert.alert('Error', 'Unable to set tweet data');
        }
    };


  const fetchContent = async () => {
    if (!username) {
      console.error('Username is required for fetching content.');
      return;
    }
    try {
      const response = await fetch(`${domaindynamo}/show-saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const responseClone = response.clone();

      const textResponse = await responseClone.text();

      console.log('Server response:', textResponse);
    const data = await response.json();
    if (!data.data) throw new Error('Saved content not found');
    console.log(data.data);

    const detailedContent = await Promise.all(
      data.data.map(async (item) => {
        if (item.type === 'article') {
          return { ...item, content_data: await fetchArticleContent(item.id) };
        } else if (item.type === 'tweet') {
          return { ...item, content_data: await fetchTweetContent(item.id) };
        }
        return item;
      })
    );

    setArticlesAndTweets(detailedContent);
  } catch (err) {
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
    } catch (error) {
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
    } catch (error) {
      console.error(`Error in fetchTweetContent: ${error.message}`);
      return null; // Return null to handle gracefully
    }
  };


  const handleContentPress = async (item: any) => {
    if (item.type === 'tweet') {
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
          body: JSON.stringify({ id: item.id }),
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

  useEffect(() => {
    fetchUsername();
  }, []);

  const renderContentCard = ({ item }: { item: any }) => {
    console.log('Rendering: ', item);
    if (item.type === 'article') {
      return (
        <TouchableOpacity style={styles.articleCard} onPress={() => handleContentPress(item)}>
          <Image source={require('../assets/images/logo.png')} style={styles.logoImage} />
          <Text style={styles.articleTitle}>{item.content_data.headline}</Text>
          <Text style={styles.articleAuthor}>{item.content_data.authors}</Text>
          <Text style={styles.articleDate}>{formatToUTCA(item.date)}</Text>
        </TouchableOpacity>
      );
    } else if (item.type === 'tweet') {
      return (
        <TouchableOpacity style={styles.tweetCard} onPress={() => handleContentPressLive(item.content_data)}>
          <Image source={{ uri: item.content_data.Media_URL }} style={styles.tweetImage} />
          <Text style={styles.tweetUsername}>{item.content_data.Username}</Text>
          <Text style={styles.tweetDate}>{formatToUTCT(item.content_data.Created_At)}</Text>
          <Text style={styles.tweetText} numberOfLines={3} ellipsizeMode="tail">
            {item.Tweet}
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  };
  const [isButtonVisible, setIsButtonVisible] = useState(true);

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setIsButtonVisible(offsetY < 100);
  };

  const handleHomePress = () => {
    router.push('/mynews');
  };

  const handleBookmarkPress = () => {
    router.push('/savedArticles');
  };

  const handleAddressBookPress = () => {
    router.push('/followingPage');
  };

  const handleSearchPress = () => {
    router.push('/searchPage');
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsIcon}>
          <Icon name="settings-outline" size={24} color="#888" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={articlesAndTweets}
        renderItem={renderContentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No saved articles</Text>
          </View>
        }
      />

      {isButtonVisible && (
        <CustomButton
          barButtons={[
            { iconName: 'home', onPress: handleHomePress },
            { iconName: 'bookmark', onPress: handleBookmarkPress },
            { iconName: 'address-book', onPress: handleAddressBookPress },
            { iconName: 'search', onPress: handleSearchPress },
          ]}
        />
      )}
    </View>
  );
};

export default HomePage;


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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 10,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flex: 1,
  },
  tabButton: {
    marginHorizontal: 20,
    paddingBottom: 5,
  },
  tabText: {
    fontSize: 18,
    color: '#888',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#A1A0FE',
  },
  activeTabText: {
    color: '#333',
    fontWeight: 'bold',
  },
  settingsIcon: {
    position: 'absolute',
    right: 20,
  },
  filterContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  filterScroll: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryWrapper: {
    flexDirection: 'row',
  },
  filterButton: {
    backgroundColor: '#FFFF',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 15,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#A1A0FE',
    borderColor: '#FFFFFF'
  },
  filterText: {
    color: '#000000',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 15,
  },
  articleCard: {
    backgroundColor: '#8A7FDC',
    borderRadius: 10,
    marginBottom: 15,
    padding: 10,
    alignSelf: 'center',
    width: 500,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  articleAuthor: {
    fontSize: 12,
    color: '#333333',
  },
  articleDate: {
    fontSize: 12,
    color: '#333333',
  },
  articleDescription: {
    fontSize: 14,
    color: '#555555',
    marginTop: 5,
  },
  tweetCard: {
    backgroundColor: '#2A2B2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
    width: 500,
    alignSelf: 'center',
  },
  tweetUsername: {
    color: '#8A7FDC',
    fontSize: 18,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  tweetText: {
    fontSize: 14,
    color: '#A9A9A9',
    lineHeight: 20,
  },
  tweetDate: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tweetImage: {
    height: 300,
    width: 'auto',
    resizeMode: 'contain',
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