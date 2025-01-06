// components/ArticleCard.tsx
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
import { UserContext } from '../app/UserContext'; // Adjust the path if necessary

interface ArticleCardProps {
  item: any;
  onPress: (item: any) => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ item, onPress }) => {
  const { isDarkTheme } = useContext(UserContext); // Consume theme from context

  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9); // Default aspect ratio
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth * 0.8; // 80% of screen width
  const MAX_IMAGE_HEIGHT = 300; // Maximum height for the image

  // If there's an image URL, attempt to get its dimensions to compute aspect ratio
  useEffect(() => {
    if (item.image_url) {
      Image.getSize(
        item.image_url,
        (width, height) => {
          // Avoid divide by zero
          if (height !== 0) {
            const ratio = width / height;
            const calculatedHeight = cardWidth / ratio;
            // If the calculated height is bigger than our max, adjust the ratio
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
          setAspectRatio(16 / 9); // Fallback aspect ratio
          setHasError(true);
          setIsLoading(false);
        }
      );
    } else {
      setIsLoading(false);
    }
  }, [item.image_url, cardWidth]);

  return (
    <TouchableOpacity
      style={isDarkTheme ? styles.articleCardDark : styles.articleCardLight}
      onPress={() => onPress(item)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Article card"
    >
      {/* Display image only if image_url exists and there's no error */}
      {item.image_url && !hasError && (
        <View style={isDarkTheme ? styles.imageContainerDark : styles.imageContainerLight}>
          {/* Show loading spinner until image size is determined or an error occurs */}
          {isLoading && (
            <ActivityIndicator
              style={styles.loadingIndicator}
              size="small"
              color={isDarkTheme ? '#BB9CED' : '#6C63FF'}
            />
          )}
          {!hasError ? (
            <Image
              source={{ uri: item.image_url }}
              style={[
                styles.articleImage,
                {
                  aspectRatio: aspectRatio,
                  maxHeight: MAX_IMAGE_HEIGHT,
                },
              ]}
              resizeMode="contain" // Ensure the entire image is visible without cropping
              onError={(e) => {
                console.error('Failed to load image:', e.nativeEvent.error);
                setHasError(true);
                setIsLoading(false);
              }}
              accessibilityLabel="Article image"
            />
          ) : (
            // Display placeholder or error message on error
            <View
              style={[
                styles.articleImage,
                {
                  aspectRatio: aspectRatio,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: isDarkTheme ? '#374151' : '#F0F0F0',
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

      <View style={styles.articleContent}>
        <Text style={isDarkTheme ? styles.articleTitleDark : styles.articleTitleLight}>
          {item.headline}
        </Text>
        <Text style={isDarkTheme ? styles.articleAuthorDark : styles.articleAuthorLight}>
          {item.authors}
        </Text>
        <Text style={isDarkTheme ? styles.articleDateDark : styles.articleDateLight}>
          {formatToUTCA(item.date)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Utility function to format UTC date (DD-MM-YYYY)
const formatToUTCA = (isoDate: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

const styles = StyleSheet.create({
  // Light Theme Styles
  articleCardLight: {
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
  // Dark Theme Styles
  articleCardDark: {
    backgroundColor: '#1F2937', // Dark background
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
  // Light Theme Image Container
  imageContainerLight: {
    position: 'relative',
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F0F0F0', // Light background
  },
  // Dark Theme Image Container
  imageContainerDark: {
    position: 'relative',
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#374151', // Dark background (darker than TweetCard)
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    zIndex: 1,
  },
  articleImage: {
    width: '100%',
    // height is determined by aspectRatio and maxHeight
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
  articleContent: {
    // Additional styling for content if needed
  },
  articleTitleLight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  articleTitleDark: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F3F4F6',
    marginBottom: 4,
  },
  articleAuthorLight: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  articleAuthorDark: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 4,
  },
  articleDateLight: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 8,
  },
  articleDateDark: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  articleDescription: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
});

export default React.memo(ArticleCard);
