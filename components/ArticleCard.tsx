// components/ArticleCard.tsx
import React from 'react';
import { TouchableOpacity, Image, Text, StyleSheet, View } from 'react-native';

interface ArticleCardProps {
  item: any;
  onPress: (item: any) => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ item, onPress }) => {
  return (
    <TouchableOpacity style={styles.articleCard} onPress={() => onPress(item)}>
      <Image source={{ uri: item.Image_URL }} style={styles.articleImage} />
      <View style={styles.articleContent}>
        <Text style={styles.articleTitle}>{item.headline}</Text>
        <Text style={styles.articleAuthor}>{item.authors}</Text>
        <Text style={styles.articleDate}>{formatToUTCA(item.date)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Utility function to format UTC date
const formatToUTCA = (isoDate: string) => {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

const styles = StyleSheet.create({
  articleCard: {
    backgroundColor: '#EEFFEE', // Temporary background color for visibility
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
    width: '90%', // 90% width for better visibility
    alignSelf: 'center',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F0F0F0', // Fallback background color
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
  errorText: {
    color: '#AA0000',
    textAlign: 'center',
    fontSize: 16,
  },
  articleContent: {
    // Additional styling for content if needed
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  articleAuthor: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  articleDate: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 8,
  },
  articleDescription: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
});

export default React.memo(ArticleCard);
