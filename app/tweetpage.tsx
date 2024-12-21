// components/TweetPage.tsx

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Linking,
  Platform,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust the path as needed

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const TweetPage: React.FC = () => {
  const [tweetData, setTweetData] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [comment, setComment] = useState('');
  const [allComments, setAllComments] = useState<any[]>([]);

  // States for image handling similar to TweetCard
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9); // Default aspect ratio
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const router = useRouter();
  const { userToken } = useContext(UserContext);

  useEffect(() => {
    if (userToken) {
      getTweet();
      fetchUsername();
    }
  }, [userToken]);

  useEffect(() => {
    if (tweetData) {
      fetchComments();
      if (tweetData.Media_URL) {
        // Start loading the image
        setIsLoading(true);
        calculateAspectRatio(tweetData.Media_URL);
      }
    }
  }, [tweetData]);

  const fetchUsername = async () => {
    if (!userToken) return;
    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken }),
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

  const getTweet = async () => {
    if (!userToken) return;
    try {
      const response = await fetch(`${domaindynamo}/get-tweettodisp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken }),
      });
      const data = await response.json();
      if (data.status === 'Success') {
        setTweetData(data.data);
      } else {
        Alert.alert('Error', 'No tweet data found');
      }
    } catch (error) {
      console.error('Error fetching tweet data:', error);
      Alert.alert('Error', 'Unable to fetch tweet data');
    }
  };

  const fetchComments = async () => {
    if (!userToken || !tweetData) return;
    try {
      const response = await fetch(`${domaindynamo}/get_comments_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, tweet_link: tweetData.Tweet_Link }),
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

  // Mimic the TweetCard image handling approach
  const calculateAspectRatio = (uri: string) => {
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = screenWidth * 0.95; // 95% of screen width
    const MAX_IMAGE_HEIGHT = 300; // Maximum height for the image

    Image.getSize(
      uri,
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
        setAspectRatio(16 / 9); // Fallback aspect ratio
        setHasError(true);
        setIsLoading(false);
      }
    );
  };

  const handleShare = async (tweetLink: string) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to share tweets.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/share_tweets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, tweet_link: tweetLink }),
      });

      const data = await response.json();
      if (data.status === 'Success') {
        Platform.OS === 'web'
          ? alert('Tweet shared successfully!')
          : Alert.alert('Success', 'Tweet shared successfully!');
      } else {
        Platform.OS === 'web'
          ? alert('Unable to share tweet')
          : Alert.alert('Error', 'Unable to share tweet');
      }
    } catch (error) {
      console.error('Error sharing tweet', error);
      Alert.alert('Error', 'Unable to share tweet');
    }
  };

  const handleMediaPress = (tweetLink: string) => {
    Linking.openURL(tweetLink).catch((err) =>
      Alert.alert('Error', 'Failed to open tweet.')
    );
  };

  const handleSave = async (tweetLink: string) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to save tweets.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/save-tweets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, tweet_link: tweetLink }),
      });

      const data = await response.json();
      if (response.ok && data.status === 'Success') {
        Platform.OS === 'web'
          ? alert('Tweet saved successfully!')
          : Alert.alert('Success', 'Tweet saved successfully!');
      } else {
        Platform.OS === 'web'
          ? alert('Error: Tweet could not be saved')
          : Alert.alert('Error', 'Tweet could not be saved');
      }
    } catch (error) {
      console.error('Error saving tweet', error);
      Alert.alert('Error', 'Unable to save tweet');
    }
  };

  const postComment = async (content: string) => {
    if (!userToken || !tweetData) {
      Alert.alert('Error', 'You must be logged in and have a tweet loaded to comment.');
      return;
    }

    if (content.trim() === '') {
      Alert.alert('Error', 'Comment cannot be empty.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/comment_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          tweet_link: tweetData.Tweet_Link,
          content: content,
          parent_comment_id: null,
        }),
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

  const renderCommentCard = ({ item }: { item: any }) => {
    return <CommentCard comment={item} />;
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backIcon} onPress={() => router.push('/')}>
          <Icon name="arrow-back" size={30} color="#6C63FF" />
        </TouchableOpacity>

        {tweetData ? (
          <>
            {/* Tweet Card */}
            <View style={styles.tweetCard}>
              {/* Tweet Header */}
              <View style={styles.tweetHeader}>
                <Image
                  source={{ uri: 'https://via.placeholder.com/50' }}
                  style={styles.avatar}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.username}>{tweetData.Username}</Text>
                  <Text style={styles.timestamp}>{new Date(tweetData.Created_At).toLocaleString()}</Text>
                </View>
              </View>

              {/* Tweet Text */}
              <Text style={styles.tweetText}>{tweetData.Tweet}</Text>

              {/* Tweet Media (Mimic TweetCard) */}
              {tweetData.Media_URL && (
                <TouchableOpacity onPress={() => handleMediaPress(tweetData.Tweet_Link)}>
                  <View style={styles.imageContainer}>
                    {isLoading && (
                      <ActivityIndicator
                        style={styles.loadingIndicator}
                        size="small"
                        color="#6C63FF"
                      />
                    )}
                    {!hasError ? (
                      <Image
                        source={{ uri: tweetData.Media_URL }}
                        style={[
                          styles.tweetImage,
                          {
                            aspectRatio: aspectRatio,
                            maxHeight: 300,
                          },
                        ]}
                        resizeMode="contain"
                        onLoadStart={() => {
                          setIsLoading(true);
                          setHasError(false);
                        }}
                        onLoad={() => setIsLoading(false)}
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
                          { aspectRatio: aspectRatio, justifyContent: 'center', alignItems: 'center' },
                        ]}
                      >
                        <Text style={styles.errorText}>Image Failed to Load</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}

              {/* Tweet Stats */}
              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Icon name="repeat-outline" size={20} color="#555" />
                  <Text style={styles.statText}>Retweets: {tweetData.Retweets || 0}</Text>
                </View>
                <View style={styles.statItem}>
                  <Icon name="heart-outline" size={20} color="#555" />
                  <Text style={styles.statText}>Likes: {tweetData.Favorites || 0}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => handleSave(tweetData.Tweet_Link)}>
                  <Icon name="bookmark-outline" size={30} color="#6C63FF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleShare(tweetData.Tweet_Link)}>
                  <Icon name="share-outline" size={30} color="#6C63FF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* AI Depth Explanation */}
            {tweetData.Explanation && (
              <View style={styles.aiExplanationContainer}>
                <Text style={styles.aiExplanationHeader}>AI Depth Explanation</Text>
                <Text style={styles.aiExplanationText}>{tweetData.Explanation}</Text>
              </View>
            )}

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
          </>
        ) : (
          <Text style={styles.loadingText}>Loading tweet details...</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Extracted CommentCard Component for Better Code Organization
interface CommentCardProps {
  comment: {
    username: string;
    created_at: string;
    content: string;
  };
}

const CommentCard: React.FC<CommentCardProps> = ({ comment }) => {
  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleString();
  };

  return (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <Icon name="person-circle-outline" size={40} color="#6C63FF" />
        <View style={styles.commentInfo}>
          <Text style={styles.commentUsername}>{comment.username}</Text>
          <Text style={styles.commentDate}>{formatDate(comment.created_at)}</Text>
        </View>
      </View>
      <Text style={styles.commentText}>{comment.content}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
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
  tweetCard: {
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
  tweetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userInfo: {
    flexDirection: 'column',
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  timestamp: {
    fontSize: 14,
    color: '#777777',
    marginTop: 4,
  },
  tweetText: {
    fontSize: 16,
    color: '#444444',
    marginBottom: 15,
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
  tweetImage: {
    width: '100%',
  },
  errorText: {
    color: '#AA0000',
    textAlign: 'center',
    fontSize: 16,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#555555',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  aiExplanationContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  aiExplanationHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 10,
  },
  aiExplanationText: {
    fontSize: 16,
    color: '#555555',
    lineHeight: 22,
  },
  commentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 20,
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
  loadingText: {
    fontSize: 16,
    color: '#777777',
    textAlign: 'center',
    marginTop: 50,
  },
});

export default TweetPage;
