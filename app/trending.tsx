// pages/TrendingScreen.tsx

import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import CustomButton from '../components/ui/ChronicallyButton';
import { UserContext } from '../app/UserContext';
import TweetCard from '../components/TweetCard'; // Import the updated TweetCard

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const TrendingScreen: React.FC = () => {
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const lastOffset = useRef(0);
  const [showButton, setShowButton] = useState(true); // Controls button visibility
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const { userToken, setUserToken } = useContext(UserContext); // Access the token

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
      setContent([]);
      setErrorMessage('Error fetching trending content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingContent();
  }, []);

  const formatToUTCT = (isoDate: string): string => {
    const date = new Date(isoDate);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${hours}:${minutes} ${day}-${month}-${year}`;
  };

  const handleContentPress = async (item: any) => {
      if (!userToken) {
            Platform.OS === 'web'
              ? alert('Login to Access More Features!')
              : Alert.alert('Error', 'Login to Access More Features!');
          } else {
    if (item.Tweet_Link) {
      try {
        const response = await fetch(`${domaindynamo}/set-tweettodisp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken, tweet: item }),
        });

        const data = await response.json();
        if (data.status === 'Success') {
          setUserToken(data.token);
          router.push('/tweetpage');
        } else {
          Alert.alert('Error', 'Failed to set tweet link');
        }
      } catch (error) {
        console.error('Error setting tweet link:', error);
        Alert.alert('Error', 'Unable to set tweet link');
      }
    } else {
      Alert.alert('Error', 'Invalid content type');
    }
}
  };

  const renderContentCard = ({ item }: { item: any }) => (
    <TweetCard item={item} onPress={handleContentPress} />
  );

  // Handle scroll to show/hide the button
  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    if (currentOffset > lastOffset.current && currentOffset > 50) {
      // Scrolling Down
      if (showButton) setShowButton(false);
    } else if (currentOffset < lastOffset.current) {
      // Scrolling Up
      if (!showButton) setShowButton(true);
    }
    lastOffset.current = currentOffset;
  };

  const handleHomePress = () => {
    router.push('/');
  };

  const handleBookmarkPress = () => {
      if (!userToken) {
            Platform.OS === 'web'
              ? alert('Login to Access More Features!')
              : Alert.alert('Error', 'Login to Access More Features!');
          } else {
    router.push('/savedarticles');
    }
  };

  const handleAddressBookPress = () => {
      if (!userToken) {
            Platform.OS === 'web'
              ? alert('Login to Access More Features!')
              : Alert.alert('Error', 'Login to Access More Features!');
          } else {
    router.push('/followingpage');
    }
  };

  const handleSearchPress = () => {
      if (!userToken) {
            Platform.OS === 'web'
              ? alert('Login to Access More Features!')
              : Alert.alert('Error', 'Login to Access More Features!');
          } else {
    router.push('/searchpage');
    console.log('Search button pressed!');
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
          <View style={styles.activityIndicatorContainer}>
            <ActivityIndicator size="large" color="#6C63FF" />
          </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={content}
          renderItem={renderContentCard}
          keyExtractor={(item, index) => `${item.Tweet_Link || item.link}-${index}`}
          contentContainerStyle={styles.listContainer}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No trending content available.</Text>
            </View>
          }
        />
      )}

      {/* Custom Floating Button */}
      <CustomButton
        isVisible={showButton}
        barButtons={[
          { iconName: 'home', onPress: handleHomePress },
          { iconName: 'bookmark', onPress: handleBookmarkPress },
          { iconName: 'address-book', onPress: handleAddressBookPress },
          { iconName: 'search', onPress: handleSearchPress },
        ]}
        onMainButtonPress={() => {
          // Optional: handle main button press if needed
          console.log('Main button pressed!');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 100,
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
  errorText: {
    color: '#FF0000',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#555555',
    fontSize: 16,
  },
  activityIndicatorContainer: {
    flex: 1,
    justifyContent: 'flex-end', // Adjust vertical position to the lowest level
    alignItems: 'center', // Adjust horizontal position
  },
});

export default TrendingScreen;
