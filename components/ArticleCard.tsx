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

interface ArticleCardProps {
  item: any;
  onPress: (item: any) => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ item, onPress }) => {
  const { isDarkTheme } = useContext(UserContext);

  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth * 0.8;
  const MAX_IMAGE_HEIGHT = 300;

  useEffect(() => {
    if (item.image_url) {
      Image.getSize(
        item.image_url,
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
  }, [item.image_url, cardWidth]);

  return (
    <TouchableOpacity
      style={isDarkTheme ? styles.articleCardDark : styles.articleCardLight}
      onPress={() => onPress(item)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Article card"
    >
      {item.image_url && !hasError && (
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
              source={{ uri: item.image_url }}
              style={[
                styles.articleImage,
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
              accessibilityLabel="Article image"
            />
          ) : (
            <View
              style={[
                styles.articleImage,
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
  // Dark Theme Styles (adjusted for strong contrast with #121212)
  articleCardDark: {
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
  articleImage: {
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
  articleContent: {},
  articleTitleLight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  articleTitleDark: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  articleAuthorLight: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  articleAuthorDark: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 4,
  },
  articleDateLight: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 8,
  },
  articleDateDark: {
    fontSize: 12,
    color: '#AAAAAA',
    marginBottom: 8,
  },
});

export default React.memo(ArticleCard);
