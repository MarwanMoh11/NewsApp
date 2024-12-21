// components/ArticlePage.tsx

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
  FlatList,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // adjust path if needed

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const ArticlePage: React.FC = () => {
  const [articleData, setArticleData] = useState<any>(null);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [allComments, setAllComments] = useState<any[]>([]);
  const [comment, setComment] = useState('');

  const router = useRouter();
  const { userToken } = useContext(UserContext);

  useEffect(() => {
    if (userToken) {
      fetchUsername();
      fetchArticleIdAndDetails();
    }
  }, [userToken]);

  useEffect(() => {
    if (articleData) {
      fetchComments();
    }
  }, [articleData]);

  const formatToUTCA = (isoDate: string) => {
    const date = new Date(isoDate);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchUsername = async () => {
    if (!userToken) return;
    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken })
      });
      const data = await response.json();
      if (data.status === 'Success' && data.username) {
        setUsername(data.username);
      } else {
        setUsername('');
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('Guest');
    }
  };

  const fetchArticleIdAndDetails = async () => {
    try {
      const idResponse = await fetch(`${domaindynamo}/get-article-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken })
      });
      if (!idResponse.ok) {
        throw new Error('Failed to fetch article ID');
      }
      const idData = await idResponse.json();
      if (!idData.articleId) {
        Alert.alert('Error', 'No article ID set');
        return;
      }
      await fetchArticleDetails(idData.articleId);
      fetchRelatedArticles(idData.articleId);
    } catch (error) {
      console.error('Error fetching article ID:', error);
      Alert.alert('Error', 'Unable to fetch article ID');
    }
  };

  const fetchArticleDetails = async (id: number) => {
    try {
      const response = await fetch(`${domaindynamo}/get-article-by-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch article details');
      }

      const data = await response.json();
      if (data.status === 'Article found') {
        setArticleData(data.data);
      } else {
        Alert.alert('Error', 'No article found with the given ID');
      }
    } catch (error) {
      console.error('Error fetching article details:', error);
      Alert.alert('Error', 'Unable to fetch article details');
    }
  };

  const fetchRelatedArticles = async (id: number) => {
    try {
      const response = await fetch(`${domaindynamo}/get-related`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch related articles');
      }

      const data = await response.json();
      if (data.status === 'Success') {
        setRelatedArticles(data.data);
      } else {
        Alert.alert('Error', 'No related articles found');
      }
    } catch (error) {
      console.error('Error fetching related articles:', error);
      Alert.alert('Error', 'Unable to fetch related articles');
    }
  };

  const fetchComments = async () => {
    if (!articleData) return;
    try {
      const response = await fetch(`${domaindynamo}/get_comments_article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleData.id }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'Success') {
        setAllComments(data.data);
      } else {
        setAllComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setAllComments([]);
    }
  };

  const postComment = async (comment: string) => {
    if (!userToken || !articleData) {
      Alert.alert('Error', 'You must be logged in and have an article loaded to comment.');
      return;
    }

    if (comment.trim() === '') {
      Alert.alert('Error', 'Comment cannot be empty.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/comment_article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleData.id, username, content: comment, parent_comment_id: null }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.status === 'Success') {
        if (Platform.OS === 'web') {
          alert('Success: Comment has been posted');
        } else {
          Alert.alert('Success', 'Comment has been posted');
        }
        // Refresh comments
        setComment('');
        fetchComments();
      } else {
        Platform.OS === 'web'
          ? alert('Error: could not post comment')
          : Alert.alert('Error', 'Could not post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      Platform.OS === 'web'
        ? alert('Error: could not post comment')
        : Alert.alert('Error', 'Could not post comment');
    }
  };

  const handleShare = async (articleId: number) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to share articles.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/share_articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, article_id: articleId }),
      });
      const data = await response.json();

      if (response.ok && data.status === 'Success') {
        Platform.OS === 'web'
          ? alert('Article shared successfully!')
          : Alert.alert('Success', 'Article shared successfully!');
      } else {
        Platform.OS === 'web'
          ? alert('Unable to share article')
          : Alert.alert('Error', 'Unable to share article');
      }
    } catch (error) {
      console.error('Error sharing article', error);
      Alert.alert('Error', 'Unable to share article');
    }
  };

  const handleLinkPress = (link: string) => {
    Linking.openURL(link).catch(() =>
      Alert.alert('Error', 'Failed to open article link.')
    );
  };

  const handleRelatedArticlePress = async (id: number) => {
    try {
      const response = await fetch(`${domaindynamo}/set-article-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error('Failed to set article ID');
      }

      const data = await response.json();
      if (data.status === 'Success') {
        router.push('/articlepage'); // Navigate to the article page
      } else {
        Alert.alert('Error', 'Failed to set the new article ID');
      }
    } catch (error) {
      console.error('Error setting article ID:', error);
      Alert.alert('Error', 'Unable to set article ID');
    }
  };

  const handleSave = async () => {
    if (!userToken || !articleData) {
      Alert.alert('Error', 'You must be logged in and have an article loaded to save.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/save-articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, article_id: articleData.id }),
      });

      const responseData = await response.json();
      if (response.ok && responseData.status === 'Success') {
        Platform.OS === 'web'
          ? alert('Article saved successfully!')
          : Alert.alert('Success', 'Article saved successfully!');
      } else {
        Platform.OS === 'web'
          ? alert(`Error: ${responseData.message || 'Article could not be saved'}`)
          : Alert.alert('Error', responseData.message || 'Article could not be saved');
      }
    } catch (error) {
      console.error('Error saving Article', error);
      Platform.OS === 'web'
        ? alert('Error: Unable to save Article')
        : Alert.alert('Error', 'Unable to save Article');
    }
  };

  const renderCommentCard = ({ item }: { item: any }) => {
    const formatDate = (isoDate: string) => {
      const date = new Date(isoDate);
      return date.toLocaleString();
    };

    return (
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          <Icon name="person-circle-outline" size={40} color="#6C63FF" />
          <View style={styles.commentInfo}>
            <Text style={styles.commentUsername}>{item.username}</Text>
            <Text style={styles.commentDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backIcon} onPress={() => router.push('/')}>
        <Icon name="arrow-back" size={30} color="#6C63FF" />
      </TouchableOpacity>

      {articleData ? (
        <View style={styles.articleCard}>
          <Text style={styles.headline}>{articleData.headline}</Text>
          <Text style={styles.category}>Category: {articleData.category}</Text>
          <Text style={styles.date}>Date: {formatToUTCA(articleData.date)}</Text>
          <Text style={styles.authors}>
            Authors: {articleData.authors || 'Unknown'}
          </Text>
          <Text style={styles.shortDescription}>
            {articleData.short_description}
          </Text>
          <TouchableOpacity
            style={styles.readMoreButton}
            onPress={() => handleLinkPress(articleData.link)}
          >
            <Text style={styles.readMoreText}>Read Full Article</Text>
          </TouchableOpacity>

          <View style={styles.actionIcons}>
            <TouchableOpacity onPress={handleSave}>
              <Icon name="bookmark-outline" size={30} color="#6C63FF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleShare(articleData.id)}>
              <Icon name="share-outline" size={30} color="#6C63FF" />
            </TouchableOpacity>
          </View>

          {/* Comment Section */}
          <View style={styles.commentSection}>
            <Text style={styles.commentsHeader}>Comments</Text>
            {/* Comment Input */}
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Type your comment..."
                placeholderTextColor="#999"
                value={comment}
                onChangeText={(text) => setComment(text)}
                multiline
              />
              <TouchableOpacity
                style={styles.postCommentButton}
                onPress={() => postComment(comment)}
              >
                <Icon name="send-outline" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            <FlatList
              data={allComments}
              renderItem={renderCommentCard}
              keyExtractor={(item) => item.comment_id.toString()}
              contentContainerStyle={styles.commentsList}
              ListEmptyComponent={
                <Text style={styles.noComments}>
                  No comments yet. Be the first to comment!
                </Text>
              }
            />
          </View>
        </View>
      ) : (
        <Text style={styles.loadingText}>Loading article details...</Text>
      )}

      <Text style={styles.relatedHeader}>Related Articles</Text>
      {relatedArticles.length > 0 ? (
        relatedArticles.map((article) => (
          <TouchableOpacity
            key={article.id}
            style={styles.relatedCard}
            onPress={() => handleRelatedArticlePress(article.id)}
          >
            <Text style={styles.relatedHeadline}>{article.headline}</Text>
            <Text style={styles.relatedCategory}>Category: {article.category}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.noRelated}>No related articles found.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  backIcon: {
    marginBottom: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 20,
    alignSelf: 'center',
  },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  headline: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  category: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 5,
  },
  date: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 5,
  },
  authors: {
    fontSize: 14,
    color: '#555555',
    marginBottom: 15,
  },
  shortDescription: {
    fontSize: 16,
    color: '#444444',
    lineHeight: 22,
    marginBottom: 20,
  },
  readMoreButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  readMoreText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  commentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  commentsHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 15,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  commentInput: {
    flex: 1,
    height: 50,
    borderColor: '#CCCCCC',
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#F9F9F9',
    textAlignVertical: 'top',
  },
  postCommentButton: {
    width: 50,
    height: 50,
    backgroundColor: '#6C63FF',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  commentsList: {
    paddingBottom: 10,
  },
  commentCard: {
    backgroundColor: '#F0F0F0',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentInfo: {
    flexDirection: 'column',
    marginLeft: 10,
  },
  commentUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  commentDate: {
    fontSize: 12,
    color: '#777777',
    marginTop: 2,
  },
  commentText: {
    fontSize: 16,
    color: '#444444',
  },
  noComments: {
    fontSize: 16,
    color: '#777777',
    textAlign: 'center',
    marginTop: 20,
  },
  relatedHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginVertical: 20,
  },
  relatedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  relatedHeadline: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  relatedCategory: {
    fontSize: 14,
    color: '#777777',
  },
  noRelated: {
    fontSize: 16,
    color: '#777777',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#777777',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default ArticlePage;
