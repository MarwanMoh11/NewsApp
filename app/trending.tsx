// ------------------------------------------------------
// app/trending.tsx
// ------------------------------------------------------
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';

import { UserContext } from '../app/UserContext';
import HeaderTabs from '../components/HeaderTabs';
import ChronicallyButton from '../components/ui/ChronicallyButton';
import TweetCard from '../components/TweetCard'; // Reusable tweet display

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const TrendingScreen: React.FC = () => {
  // ------------------ States ------------------
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext);
  const router = useRouter();

  // For arrow-up button
  const [scrolledFarDown, setScrolledFarDown] = useState(false);

  // Create Animated.Value for scroll position
  const scrollY = useRef(new Animated.Value(0)).current;

  // Interpolate scrollY to get header translateY and opacity
  const translateY = scrollY.interpolate({
    inputRange: [0, 100], // Adjust based on header height
    outputRange: [0, -100], // Slides header up by 100 pixels
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0], // Fades out the header
    extrapolate: 'clamp',
  });

  // Reference to FlatList
  const flatListRef = useRef<FlatList<any> | null>(null);

  // ------------------ User Information ------------------
  const [username, setUsername] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // ------------------ Fetch Trending Content ------------------
  const fetchTrendingContent = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${domaindynamo}/get_trending_tweets`);
      const data = await response.json();
      if (data.status === 'Success') {
        setContent(data.data);
      } else {
        setContent([]);
        setErrorMessage('No trending content found.');
      }
    } catch (error) {
      console.error('Error fetching trending content:', error);
      setContent([]);
      setErrorMessage('Error fetching trending content. Please try again.');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  // ------------------ Fetch User Information ------------------
  const fetchUserInfo = async () => {
    if (!userToken) {
      setUsername(null);
      setProfilePictureUrl(null);
      return;
    }
    try {
      // Fetch Username
      const usernameResponse = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken }),
      });
      const usernameData = await usernameResponse.json();
      if (usernameData.status === 'Success' && usernameData.username) {
        setUsername(usernameData.username);
        // Fetch Profile Picture
        const pfpResponse = await fetch(`${domaindynamo}/get-profile-picture?username=${usernameData.username}`);
        const pfpData = await pfpResponse.json();
        if (pfpData.status === 'Success' && pfpData.profile_picture) {
          setProfilePictureUrl(pfpData.profile_picture);
        } else {
          setProfilePictureUrl(null);
        }
      } else {
        setUsername(null);
        setProfilePictureUrl(null);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      setUsername(null);
      setProfilePictureUrl(null);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    fetchTrendingContent();
  }, [userToken]);

  // ------------------ Handle Content Press ------------------
  const handleContentPress = async (item: any) => {
    if (!userToken) {
      alertNotLoggedIn();
      return;
    }
    // If it's a tweet
    if (item.Tweet_Link) {
      try {
        const response = await fetch(`${domaindynamo}/set-tweettodisp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken, tweet: item }),
        });
        const data = await response.json();
        if (data.status === 'Success' && data.token) {
          setUserToken(data.token);
          router.push('/tweetpage');
        } else {
          Alert.alert('Error', 'Failed to set tweet data');
        }
      } catch (error) {
        console.error('Error setting tweet data:', error);
        Alert.alert('Error', 'Unable to set tweet data');
      }
    } else {
      Alert.alert('Error', 'Invalid content type');
    }
  };

  const renderContentCard = ({ item }: { item: any }) => (
    <TweetCard item={item} onPress={() => handleContentPress(item)} />
  );

  // ------------------ Scroll Handling ------------------
  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    // Show "arrow up" if user scrolls beyond 300px
    if (currentOffset > 300 && !scrolledFarDown) {
      setScrolledFarDown(true);
    } else if (currentOffset < 300 && scrolledFarDown) {
      setScrolledFarDown(false);
    }
  };

  // ------------------ Helper: Not Logged In ------------------
  const alertNotLoggedIn = () => {
    if (Platform.OS === 'web') {
      alert('Login to Access More Features!');
    } else {
      Alert.alert('Error', 'Login to Access More Features!');
    }
  };

  // ------------------ Scroll to Top Handler ------------------
  const handleScrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // ------------------ Header Rendering ------------------
  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { transform: [{ translateY }], opacity: headerOpacity }]}>
      <HeaderTabs
        activeTab="Trending"
        onTabPress={(tab) => {
          if (tab === 'Trending') {
            // Already on Trending, do nothing
          } else {
            router.push('/'); // Navigate back to HomePage
          }
        }}
        username={username}
        profilePictureUrl={profilePictureUrl || undefined}
        onSettingsPress={() => router.push('/settings')}
        onLoginPress={() => {
          if (userToken) {
            // Implement logout functionality if needed
            Alert.alert('Logout', 'Logout functionality not implemented.');
          } else {
            router.push('/login');
          }
        }}
      />
    </Animated.View>
  );

  // ------------------ Bottom Bar ------------------
  const renderBottomBar = () => (
    <ChronicallyButton
      onHomePress={() => router.push('/')}
      onBookmarkPress={() => {
        if (!userToken) {
          alertNotLoggedIn();
        } else {
          router.push('/savedarticles');
        }
      }}
      onArrowPress={handleScrollToTop}
      arrowDisabled={!scrolledFarDown}
      onFollowingPress={() => {
        if (!userToken) {
          alertNotLoggedIn();
        } else {
          router.push('/followingpage');
        }
      }}
      onSearchPress={() => {
        if (!userToken) {
          alertNotLoggedIn();
        } else {
          router.push('/searchpage');
        }
      }}
      scrolledFarDown={scrolledFarDown}
    />
  );

  // ------------------ Main Render ------------------
  if (pageLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkTheme ? '#1F2937' : '#F4F7FA' }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkTheme ? '#111827' : '#F4F7FA' }]}>
      {/* Header */}
      {renderHeader()}

      {/* Content Area */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorMessage, { color: isDarkTheme ? '#F87171' : '#FF0000' }]}>
            {errorMessage}
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          ref={flatListRef}
          data={content}
          renderItem={renderContentCard}
          keyExtractor={(item, index) => `${item.Tweet_Link || item.link}-${index}`}
          style={styles.list} // Ensure FlatList takes up available space
          contentContainerStyle={styles.listContainer}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: true,
              listener: handleScroll,
            }
          )}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: isDarkTheme ? '#D1D5DB' : '#555555' }]}>
                No trending content available.
              </Text>
            </View>
          }
        />
      )}

      {/* Bottom Bar - Always Rendered */}
      {renderBottomBar()}
    </View>
  );
};

export default TrendingScreen;

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative', // Ensure that absolutely positioned children are relative to this container
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10, // Ensure header is above the list
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1, // Allow FlatList to take up remaining space
  },
  listContainer: {
    paddingTop: 100, // Space for the header (adjust based on header height)
    paddingBottom: 80, // Ensure content isn't hidden behind the bottom bar
    paddingHorizontal: 15,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorMessage: {
    fontSize: 16,
  },
  emptyContainer: {
    padding: 10,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
