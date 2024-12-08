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

const domaindynamo = 'https://keen-alfajores-31c262.netlify.app/.netlify/functions/index';

const ArticlePage: React.FC = () => {
  const [articleData, setArticleData] = useState<any>(null);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [allComments, setAllComments] = useState([]);
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
      const idResponse = await fetch(`${domaindynamo}/get-article-id`,{
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

    try {
      const response = await fetch(`${domaindynamo}/comment_article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // We still send username and article_id. Ideally, decode username from token on server.
        // If your backend now uses token, send { token: userToken, content: comment, parent_comment_id: null, article_id: articleData.id }
        body: JSON.stringify({ article_id: articleData.id, username, content: comment, parent_comment_id: null }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.status === 'Success') {
        if (Platform.OS === 'web') {
          alert('Success: Comment has been posted');
          router.push('/articlepage');
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
      // Use token-based endpoint for share_articles (assuming backend updated)
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
      // Update this endpoint similarly if it requires token decoding of username
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

  const renderCommentCard = ({ item }) => {
    const formatDate = (isoDate) => {
      const date = new Date(isoDate);
      return date.toLocaleString();
    };

    return (
      <View style={styles.commentCard}>
        <View style={styles.cardContent}>
          <Icon name="person" size={30} style={styles.userIcon} />
          <View>
            <Text style={styles.userName}>{item.username}</Text>
            <Text style={styles.commentDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
        <Icon name="arrow-back" size={30} color="black" />
      </TouchableOpacity>
      <Text style={styles.header}>Article Detail</Text>

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
              <Icon name="bookmark-outline" size={30} color="#A1A0FE" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleShare(articleData.id)}>
              <Icon name="share-outline" size={30} color="#A1A0FE" />
            </TouchableOpacity>
          </View>

          <View style={styles.commentContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Type your comment..."
              placeholderTextColor="#FFFF00"
              value={comment}
              onChangeText={(text) => setComment(text)}
            />
            <TouchableOpacity
              style={styles.postCommentButton}
              onPress={() => postComment(comment)}
            >
              <Text style={styles.postButtonText}>Post Comment</Text>
            </TouchableOpacity>
            <FlatList
              data={allComments}
              renderItem={renderCommentCard}
              keyExtractor={(item) => item.comment_id.toString()}
              contentContainerStyle={styles.commentCard}
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
      {relatedArticles.map((article) => (
        <TouchableOpacity
          key={article.id}
          style={styles.relatedCard}
          onPress={() => handleRelatedArticlePress(article.id)}
        >
          <Text style={styles.relatedHeadline}>{article.headline}</Text>
          <Text style={styles.relatedCategory}>Category: {article.category}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  backIcon: {
    marginBottom: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  headline: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  category: {
    fontSize: 14,
    color: '#777',
    marginBottom: 5,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  authors: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  shortDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  readMoreButton: {
    backgroundColor: '#A1A0FE',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  readMoreText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  actionIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  relatedHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 20,
  },
  relatedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  relatedHeadline: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  relatedCategory: {
    fontSize: 14,
    color: '#777',
  },
  loadingText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginTop: 20,
  },
  commentContainer: {
    flex: 1,
    backgroundColor: '#8a7fdc',
    paddingHorizontal: 20,
    paddingTop: 40,
    width: '95%',
    marginBottom: 40,
    paddingBottom: 40,
  },
  commentCard: {
    backgroundColor: '#F7B8D2',
    width: '98%',
    marginTop: 20,
    borderRadius: 15,
    paddingBottom: 20,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'left',
    marginTop: 5,
    paddingLeft: 25,
  },
  commentInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: '#F7B8D2',
    color: '#000',
  },
  postCommentButton: {
    marginLeft: 10,
    backgroundColor: '#A1A0FE',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 15,
  },
  postButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userIcon: {
    marginRight: 10,
    paddingLeft: 10,
  },
  userName: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 5,
  },
  noComments: {
    fontSize: 16,
    color: '#8a7fdc',
    fontWeight: 'bold',
    marginTop: 10,
    alignSelf: 'center',
    paddingBottom: 10,
  },
  commentDate: {
    fontSize: 12,
    color: '#555',
    marginLeft: 10,
    textAlign: 'right',
  },
});

export default ArticlePage;
