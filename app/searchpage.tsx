import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomButton from '../components/ui/ChronicallyButton';
import BackButton from '../components/ui/BackButton';
import TweetCard from '../components/TweetCard'; // Reusable TweetCard component
import ArticleCard from '../components/ArticleCard'; // Reusable ArticleCard component
import { UserContext } from '../app/UserContext'; // Adjust path as needed

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const FollowingPage: React.FC = () => {
  const [searchUsername, setSearchUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { userToken, setUserToken } = useContext(UserContext);
  const router = useRouter();

  useEffect(() => {
    // If needed, add any initial fetching logic here.
  }, []);

  const handleContentPressLive = async (item: any) => {
    // For tweets, item passed to TweetCard is `item.content_data`, so we receive `item.content_data` here.
    // Ensure `item` here matches what's coming from renderResultsCard.
    // If `item` is the entire object, item.content_data is the actual tweet data.
    // Adjust if needed depending on how data is structured after fetch.

    // Since we used `onPress={() => handleContentPressLive(item.content_data)}` below,
    // here we will get `item` as `item.content_data` (the actual tweet data).
    const tweet = item; // item is already the tweet data

    try {
      const response = await fetch(`${domaindynamo}/set-tweettodisp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken,tweet: tweet }),
      });

      const data = await response.json();
      if (data.status === 'Success') {
          setUserToken(data.token)
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
    // For articles, we pass `item.content_data` to ArticleCard, so here `item`
    // will be `item.content_data` of the original object.
    const content = item; // item is the actual article or tweet data based on how we pass it below.

    if (content.Tweet_Link) {
      // It's a tweet
      try {
        const response = await fetch(`${domaindynamo}/set-tweet-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: content.Tweet_Link }),
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
    } else if (content.id) {
      // It's an article
      try {
        const response = await fetch(`${domaindynamo}/set-article-id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken, id: content.id }),
        });

        const data = await response.json();
        if (data.status === 'Success') {
            setUserToken(data.token)
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
      return null;
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
      return null;
    }
  };

  const search = async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${domaindynamo}/search_content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: query }),
      });

      const data = await response.json();

      const detailedContent = await Promise.all(
        data.data.map(async (item: any) => {
          if (item.type === 'article') {
            const articleData = await fetchArticleContent(item.id);
            return { ...item, content_data: articleData };
          } else if (item.type === 'tweet') {
            const tweetData = await fetchTweetContent(item.id);
            return { ...item, content_data: tweetData };
          }
          return item;
        })
      );

      setSearchResults(detailedContent);
    } catch (err) {
      console.error('Error fetching shared content:', err);
      setErrorMessage('Failed to search content. Please try again.');
    }
    setLoading(false);
  };

  const renderResultsCard = ({ item }: any) => {
    // Now we use TweetCard and ArticleCard the same way as in saved articles
    if (item.type === 'article' && item.content_data) {
      // Pass article data and handle press
      return (
        <ArticleCard
          item={item.content_data}
          onPress={() => handleContentPress(item.content_data)}
        />
      );
    } else if (item.type === 'tweet' && item.content_data) {
      // Pass tweet data and handle press
      return (
        <TweetCard
          item={item.content_data}
          onPress={() => handleContentPressLive(item.content_data)}
        />
      );
    }
    return null;
  };

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
  };

  return (
    <View style={styles.container}>
      <BackButton />
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a Tweet or Article"
          placeholderTextColor="#888"
          value={searchUsername}
          onChangeText={(text) => setSearchUsername(text)}
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => search(searchUsername)}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <FlatList
        data={searchResults}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        renderItem={renderResultsCard}
        contentContainerStyle={styles.resultsContainer}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#6C63FF" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <Text style={styles.noResultsText}>No results found!</Text>
          )
        }
      />

      <CustomButton
        barButtons={[
          { iconName: 'home', onPress: handleHomePress },
          { iconName: 'bookmark', onPress: handleBookmarkPress },
          { iconName: 'address-book', onPress: handleAddressBookPress },
          { iconName: 'search', onPress: handleSearchPress },
        ]}
      />
    </View>
  );
};

export default FollowingPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
    paddingHorizontal: 20,
  },
  searchInput: {
    marginTop: 50,
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#FFF',
    color: '#000',
  },
  searchButton: {
    marginTop: 50,
    marginLeft: 10,
    backgroundColor: '#6C63FF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginHorizontal: 20,
    marginTop: 5,
    fontSize: 14,
    textAlign: 'center',
  },
  resultsContainer: {
    paddingHorizontal: 10,
    paddingBottom: 100,
  },
  noResultsText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 50,
    fontSize: 16,
  },
  centered: {
    marginTop: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6C63FF',
  },
});
