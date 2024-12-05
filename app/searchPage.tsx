import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, FlatList, Alert, Image, TextInput , ActivityIndicator ,Platform, Linking} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomButton from '../components/ui/ChronicallyButton';
import RepostFeedPage from '../app/repostFeed';

const FollowingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Add Friends');
  var [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [follower, setFollower] = useState('');
   const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const router = useRouter();

  const domaindynamo = Platform.OS === 'web'
    ?  'http://localhost:3000' // Use your local IP address for web
    : 'http://192.168.100.2:3000';       // Use localhost for mobile emulator or device

  useEffect(() => {
    fetchUsername();
  }, []);

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



  const handleLinkPress = (url) => {
      Linking.openURL(url).catch((err) => console.error("Failed to open URL:", err));
    };

  const fetchUsername = async () => {
    try {
      const response = await fetch(`${domaindynamo}/get-username`);
      const data = await response.json();
      if (data.username) {
        setFollower(data.username);
      } else {
        setFollower('');
        setFollowedUsers([]);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setFollowedUsers([]);
    }
  };

 const handleContentPressLive = async (item: any) => {
  if (item.type === 'tweet') {
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
  } else if (item.type === 'article') {
    // Existing code for handling articles
  }
};

  const handleContentPress = async (item: any) => {
    if (item.type === 'tweet') {
      try {
        const response = await fetch(`${domaindynamo}/set-tweet-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: item.content_data.Tweet_Link }),
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
          body: JSON.stringify({ id: item.content_data.id }),
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

const fetchTweets = async (query) => {
    setLoading(true);
  try {
    const response = await fetch(`http://10.40.34.34:5000/get_tweets?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Error fetching tweets: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Fetched tweets:', data);
    setSearchResults(data);
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
  setLoading(false);
};


  const search = async (query : string) => {
    try{
    const response = await fetch(`${domaindynamo}/search_content`, {
        method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchQuery: query }),
    })

    const data = await response.json();

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

      setSearchResults(detailedContent);
      console.log('Detailed:',detailedContent);
    } catch (err) {
      console.error('Error fetching shared content:', err);
    }
  }
  const renderResultsCard = ({ item } : any) => {
    if (item.type === 'article') {
        return (
          <TouchableOpacity style={styles.articleCard} onPress={() => handleContentPress(item)}>
            <Image source={require('../assets/images/logo.png')} style={styles.logoImage} />
            <Text style={styles.articleTitle}>{item.content_data.headline}</Text>
            <Text style={styles.articleAuthor}>{item.content_data.authors}</Text>
            <Text style={styles.articleDate}>{ formatToUTCA(item.content_data.date)}</Text>
          </TouchableOpacity>
        );
      } else if (item.type === 'tweet' ) {
        return (
          <TouchableOpacity style={styles.tweetCard} onPress={() => handleContentPressLive(item)}>
            <Image source={{ uri: item.Media_URL}} style={styles.tweetImage} />
            <Text style={styles.tweetUsername}>{item.Username}</Text>
            <Text style={styles.tweetDate}>{item.Created_At}</Text>
            <Text style={styles.tweetText} numberOfLines={3} ellipsizeMode="tail">
              {item.Tweet}
            </Text>
          </TouchableOpacity>
        );
      }
      return null;
  }

  const [isButtonVisible, setIsButtonVisible] = useState(true);

  const handleHomePress = () => {
    console.log(router.push('/mynews'));
  };

  const handleBookmarkPress = () => {
    router.push('/savedArticles');
  };

  const handleAddressBookPress = () => {
      router.push('/followingPage');
  };

  const handleSearchPress = () => {
    router.push('./searchPage');
  };

  return (
  <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsIcon}>
        <Icon name="settings-outline" size={24} color="#888" />
      </TouchableOpacity>
    </View>

    {activeTab === 'Reposts' ? (
      <RepostFeedPage />
    ) : (
      <>
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a Tweet or Article!"
            placeholderTextColor="#888"
            value={searchUsername}
            onChangeText={(text) => {
              setSearchUsername(text);
            }}
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => fetchTweets(searchUsername)}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
        <>
          {isButtonPressed && errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.Tweet_Link}
            renderItem={renderResultsCard}
            ListEmptyComponent={
              loading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color="#0000ff" />
                </View>
              ) : (
                <Text style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>
                  No results Found!
                </Text>
              )
            }
          />
        </>
      </>
    )}

    <CustomButton
      barButtons={[
        { iconName: 'home', onPress: handleHomePress },
        { iconName: 'bookmark', onPress: handleBookmarkPress },
        { iconName: 'address-book', onPress: handleAddressBookPress },
        { iconName: 'search', onPress: handleSearchPress },
      ]}
    />
  </View>
);};

export default FollowingPage;

const styles = StyleSheet.create({
    searchResultText: {
        padding: 10,
        fontSize: 16,
        color: '#000',
    },
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
  followedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    position: 'relative',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 5,
  },
  userIcon: {
    marginRight: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  closeIcon: {
    color: 'red',
  },
  contentContainer: {
    padding: 10,
    paddingBottom: 80,
    backgroundColor: '#f9f9f9',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
    paddingHorizontal: 20,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 20,
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
    color: '#000',
  },
  searchButton: {
    marginLeft: 10,
    backgroundColor: '#A1A0FE',
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
    marginTop: 5,
    marginLeft: 20,
    fontSize: 14,
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
    width: 350,
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
});