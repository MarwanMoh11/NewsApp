import React, { useState, useEffect, useContext } from 'react';
import {
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  View,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { UserContext } from '../app/UserContext';

interface TweetCardProps {
  item: any;
  onPress: (item: any) => void;
}

const TweetCard: React.FC<TweetCardProps> = ({ item, onPress }) => {
  const { isDarkTheme } = useContext(UserContext);

  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth * 0.8;
  const MAX_IMAGE_HEIGHT = 300;

  useEffect(() => {
    if (item.Media_URL) {
      Image.getSize(
        item.Media_URL,
        (width, height) => {
          if (height !== 0) {
            const ratio = width / height;
            const calculatedHeight = cardWidth / ratio;
            if (calculatedHeight > MAX_IMAGE_HEIGHT) {
              setAspectRatio(cardWidth / MAX_IMAGE_HEIGHT);
            } else {
              setAspectRatio(ratio);
            }
          }
          setIsLoading(false);
        },
        (error) => {
          console.error('Failed to get image size:', error);
          setAspectRatio(16 / 9);
          setHasError(true);
          setIsLoading(false);
        }
      );
    } else {
      setIsLoading(false);
    }
  }, [item.Media_URL, cardWidth]);

  return (
    <TouchableOpacity
      style={isDarkTheme ? styles.tweetCardDark : styles.tweetCardLight}
      onPress={() => onPress(item)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Tweet card"
    >
      {item.Media_URL && (
        <View style={isDarkTheme ? styles.imageContainerDark : styles.imageContainerLight}>
          {isLoading && (
            <ActivityIndicator
              style={styles.loadingIndicator}
              size="small"
              color={isDarkTheme ? '#BB9CED' : '#6C63FF'}
            />
          )}
          {!hasError ? (
            <Image
              source={{ uri: item.Media_URL }}
              style={[
                styles.tweetImage,
                {
                  aspectRatio: aspectRatio,
                  maxHeight: MAX_IMAGE_HEIGHT,
                },
              ]}
              resizeMode="contain"
              onError={(e) => {
                console.error('Failed to load image:', e.nativeEvent.error);
                setHasError(true);
                setIsLoading(false);
              }}
              accessibilityLabel="Tweet image"
            />
          ) : (
            <View
              style={[
                styles.tweetImage,
                {
                  aspectRatio: aspectRatio,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: isDarkTheme ? '#2A2A2A' : '#F0F0F0',
                },
              ]}
            >
              <Text style={isDarkTheme ? styles.errorTextDark : styles.errorTextLight}>
                Image Failed to Load
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.tweetContent}>
        <Text style={isDarkTheme ? styles.tweetUsernameDark : styles.tweetUsernameLight}>
          {item.Username}
        </Text>
        <Text style={isDarkTheme ? styles.tweetDateDark : styles.tweetDateLight}>
          {formatToUTCT(item.Created_At)}
        </Text>
        <Text
          style={isDarkTheme ? styles.tweetTextDark : styles.tweetTextLight}
          numberOfLines={3}
          ellipsizeMode="tail"
        >
          {item.Tweet}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const formatToUTCT = (isoDate: string): string => {
  const date = new Date(isoDate);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${hours}:${minutes} ${day}-${month}-${year}`;
};

const styles = StyleSheet.create({
  // Light Theme Styles
  tweetCardLight: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
    width: '90%',
    alignSelf: 'center',
  },
  // Dark Theme Styles (updated for contrast)
  tweetCardDark: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
    width: '90%',
    alignSelf: 'center',
  },
  imageContainerLight: {
    position: 'relative',
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F0F0F0',
  },
  imageContainerDark: {
    position: 'relative',
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#2A2A2A',
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    zIndex: 1,
  },
  tweetImage: {
    width: '100%',
  },
  errorTextLight: {
    color: '#AA0000',
    textAlign: 'center',
    fontSize: 16,
  },
  errorTextDark: {
    color: '#FF6B6B',
    textAlign: 'center',
    fontSize: 16,
  },
  tweetContent: {},
  tweetUsernameLight: {
    color: '#6C63FF',
    fontSize: 18,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  tweetUsernameDark: {
    // Retained accent color for the username, but can be adjusted if desired
    color: '#BB9CED',
    fontSize: 18,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  tweetDateLight: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  tweetDateDark: {
    fontSize: 14,
    color: '#AAAAAA',
    marginBottom: 8,
  },
  tweetTextLight: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  tweetTextDark: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
});

export default React.memo(TweetCard);
