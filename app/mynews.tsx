import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, FlatList, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomButton from '../components/ui/ChronicallyButton';
import TrendingScreen from '../app/trending';
import { UserContext } from '../app/UserContext'; // Adjust path as needed

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('My News');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [isSeeAll, setIsSeeAll] = useState(false);

  const { userToken, setUserToken } = useContext(UserContext);
  const router = useRouter();
  const domaindynamo = 'https://keen-alfajores-31c262.netlify.app/.netlify/functions/index';

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

  const fetchUsername = async () => {
    if (!userToken) {
      console.error('No token available to fetch username');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken })
      });
      const data = await response.json();
      if (data.status === 'Success' && data.username) {
        fetchPreferences(data.username);
      } else {
        setPreferences([]);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setPreferences([]);
    }
  };

  const fetchPreferences = async (username: string) => {
    if (!userToken) return;
    try {
      const response = await fetch(`${domaindynamo}/check-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username }) // Backend should decode username from token.
      });
      const data = await response.json();
      if (data.status === 'Success') {
        const fetchedPreferences = data.data.map((item: any) => item.preference);
        setPreferences(fetchedPreferences);
        if (fetchedPreferences.length > 0) {
          setSelectedCategory(fetchedPreferences[0]);
          fetchContent(fetchedPreferences[0]);
        }
      } else {
        setPreferences([]);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      setPreferences([]);
    }
  };

  const fetchContent = async (category: string) => {
    try {
      const [articlesResponse, tweetsResponse] = await Promise.all([
        fetch(
          isSeeAll
            ? `${domaindynamo}/get-allarticles`
            : `${domaindynamo}/get-articles`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category }),
          }
        ),
        fetch(
          isSeeAll
            ? `${domaindynamo}/get-alltweets`
            : `${domaindynamo}/get-tweets`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category }),
          }
        ),
      ]);

      const articlesData = await articlesResponse.json();
      const tweetsData = await tweetsResponse.json();

      if (articlesData.status === 'Articles found' || tweetsData.status === 'Tweets found') {
        const combinedContent = [
          ...(articlesData.data || []).map((item: any) => ({ type: 'article', ...item })),
          ...(tweetsData.data || []).map((item: any) => ({ type: 'tweet', ...item })),
        ];

        setArticlesAndTweets(combinedContent);
      } else {
        setArticlesAndTweets([]);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
      setArticlesAndTweets([]);
    }
  };

  const handleContentPressLive = async (item: any) => {
    if (item.type === 'tweet') {
      try {
        const response = await fetch(`${domaindynamo}/set-tweettodisp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken, tweet: item }),
        });

        const data = await response.json();
        if (data.status === 'Success' && data.token) {
          // Update the global token
          setUserToken(data.token);
          router.push('/tweetpage');
        } else {
          Alert.alert('Error', 'Failed to set tweet data');
        }
      } catch (error) {
        console.error('Error setting tweet data:', error);
        Alert.alert('Error', 'Unable to set tweet data');
      }
    } else if (item.type === 'article') {
      // handle articles logic if needed
    }
  };

  const handleContentPress = async (item: any) => {
    const endpoint = item.type === 'tweet' ? 'set-tweet-link' : 'set-article-id';
    console.log("article: ", item);

    try {
      const response = await fetch(`${domaindynamo}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({token: userToken, id: item.id}),
      });

      const data = await response.json();
      if (data.status === 'Success') {
          setUserToken(data.token);
        router.push(item.type === 'tweet' ? '/tweetpage' : '/articlepage');
      } else {
        Alert.alert('Error', `Failed to set ${item.type === 'tweet' ? 'tweet link' : 'article ID'}`);
      }
    } catch (error) {
      console.error(`Error setting ${item.type === 'tweet' ? 'tweet link' : 'article ID'}:`, error);
      Alert.alert('Error', `Unable to set ${item.type === 'tweet' ? 'tweet link' : 'article ID'}`);
    }
  };

  useEffect(() => {
    // If userToken is available, fetch username and preferences
    if (userToken) {
      fetchUsername();
    }
  }, [userToken]);

  const renderContentCard = ({ item }: { item: any }) => {
    if (item.type === 'article') {
      return (
        <TouchableOpacity style={styles.articleCard} onPress={() => handleContentPress(item)}>
          <Image source={require('../assets/images/logo.png')} style={styles.logoImage} />
          <Text style={styles.articleTitle}>{item.headline}</Text>
          <Text style={styles.articleAuthor}>{item.authors}</Text>
          <Text style={styles.articleDate}>{formatToUTCA(item.date)}</Text>
        </TouchableOpacity>
      );
    } else if (item.type === 'tweet') {
      return (
        <TouchableOpacity style={styles.tweetCard} onPress={() => handleContentPressLive(item)}>
          <Image source={{ uri: item.Media_URL }} style={styles.tweetImage} />
          <Text style={styles.tweetUsername}>{item.Username}</Text>
          <Text style={styles.tweetDate}>{formatToUTCT(item.Created_At)}</Text>
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
    console.log('Search button pressed!');
  };

  const handleCategorySelect = (category: string) => {
    setIsSeeAll(false);
    setSelectedCategory(category);
    fetchContent(category);
  };

  const handleSeeAll = () => {
    setIsSeeAll(true);
    if (selectedCategory) {
      fetchContent(selectedCategory);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'My News' && styles.activeTabButton]}
            onPress={() => setActiveTab('My News')}
          >
            <Text style={[styles.tabText, activeTab === 'My News' && styles.activeTabText]}>
              My News
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Trending' && styles.activeTabButton]}
            onPress={() => setActiveTab('Trending')}
          >
            <Text style={[styles.tabText, activeTab === 'Trending' && styles.activeTabText]}>
              Trending
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsIcon}>
          <Icon name="settings-outline" size={24} color="#888" />
        </TouchableOpacity>
      </View>

      {activeTab === 'Trending' ? (
        <TrendingScreen />
      ) : (
        <>
          <View style={styles.filterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              <View style={styles.categoryWrapper}>
                {preferences.map((category, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.filterButton,
                      selectedCategory === category && styles.filterButtonActive,
                    ]}
                    onPress={() => handleCategorySelect(category)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selectedCategory === category && styles.filterTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.filterButton, isSeeAll && styles.filterButtonActive]}
                  onPress={handleSeeAll}
                >
                  <Text style={[styles.filterText, isSeeAll && styles.filterTextActive]}>
                    See All →
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          <FlatList
            data={articlesAndTweets}
            renderItem={renderContentCard}
            keyExtractor={(item, index) => `${item.type}-${index}`}
            contentContainerStyle={styles.contentContainer}
            onScroll={handleScroll}
            scrollEventThrottle={16}
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
        </>
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
    top: 10,
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
    borderColor: '#FFFFFF',
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
    marginBottom: 5,
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
  tweetCard: {
    backgroundColor: '#2A2B2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 5,
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
    height: 200,
    width: 'auto',
    resizeMode: 'contain',
  },
});
