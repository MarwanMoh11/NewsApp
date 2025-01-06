// TweetModal.tsx
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
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext';

// Base URL for API calls
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

// ----------------- CommentCard Component -----------------
interface CommentCardProps {
  comment: {
    username: string;
    created_at: string;
    content: string;
  };
  profilePictureUrl?: string | null;
}

const CommentCard: React.FC<CommentCardProps> = ({ comment, profilePictureUrl }) => {
  const { isDarkTheme } = useContext(UserContext);

  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleString();
  };

  return (
    <View
      style={[
        styles.commentCard,
        { backgroundColor: isDarkTheme ? '#374151' : '#F0F0F0' },
      ]}
    >
      <View style={styles.commentHeader}>
        {profilePictureUrl ? (
          <Image source={{ uri: profilePictureUrl }} style={styles.commentImage} />
        ) : (
          <Icon
            name="person-circle-outline"
            size={40}
            color={isDarkTheme ? '#D1D5DB' : '#6C63FF'}
          />
        )}
        <View style={styles.commentInfo}>
          <Text
            style={[
              styles.commentUsername,
              { color: isDarkTheme ? '#F3F4F6' : '#333333' },
            ]}
          >
            {comment.username}
          </Text>
          <Text
            style={[
              styles.commentDate,
              { color: isDarkTheme ? '#D1D5DB' : '#777777' },
            ]}
          >
            {formatDate(comment.created_at)}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.commentText,
          { color: isDarkTheme ? '#D1D5DB' : '#444444' },
        ]}
      >
        {comment.content}
      </Text>
    </View>
  );
};

// ----------------- TweetModal Props -----------------
interface TweetModalProps {
  visible: boolean;          // Whether the modal is visible
  onClose: () => void;       // Callback to close the modal
  tweetLink: string | null;  // The link (URL) or ID for the tweet
}

/**
 * TweetModal is a modal-based replacement for your old "TweetPage"
 * so you can slide it in from the right (on Android) or bottom (on iOS).
 */
const TweetModal: React.FC<TweetModalProps> = ({ visible, onClose, tweetLink }) => {
  const [tweetData, setTweetData] = useState<any>(null);
  const [allComments, setAllComments] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [profilePictures, setProfilePictures] = useState<{ [key: string]: string | null }>({});
  const [tweetAuthorPfp, setTweetAuthorPfp] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplanationLoading, setIsExplanationLoading] = useState<boolean>(false);

  const { userToken, isDarkTheme } = useContext(UserContext);

  // ----------------- EFFECTS -----------------
  useEffect(() => {
    // Reset states if the modal closes
    if (!visible) {
      setTweetData(null);
      setAllComments([]);
      setExplanation(null);
      return;
    }
    // If visible and we have userToken + tweetLink, fetch data
    if (visible && userToken && tweetLink) {
      fetchUsername();
      getTweetByLink(tweetLink);
    }
  }, [visible, userToken, tweetLink]);

  useEffect(() => {
    if (tweetData) {
      fetchComments();
      // If there's media
      if (tweetData.Media_URL) {
        setIsLoading(true);
        calculateAspectRatio(tweetData.Media_URL);
      }
      // If there's a link
      if (tweetData.Tweet_Link) {
        generateExplanation(tweetData.Tweet_Link);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tweetData]);

  // ----------------- FETCHING -----------------
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
        await fetchProfilePicture(data.username, true);
      } else {
        setUsername('Guest');
        setTweetAuthorPfp(null);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('Guest');
      setTweetAuthorPfp(null);
    }
  };

  const fetchProfilePicture = async (uname: string, isTweetAuthor: boolean = false) => {
    try {
      const response = await fetch(
        `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`
      );
      const data = await response.json();
      if (data.status === 'Success' && data.profile_picture) {
        if (isTweetAuthor) {
          setTweetAuthorPfp(data.profile_picture);
        } else {
          setProfilePictures((prev) => ({ ...prev, [uname]: data.profile_picture }));
        }
      } else {
        if (isTweetAuthor) setTweetAuthorPfp(null);
        setProfilePictures((prev) => ({ ...prev, [uname]: null }));
      }
    } catch (error) {
      console.error(`Error fetching profile picture for ${uname}:`, error);
      if (isTweetAuthor) setTweetAuthorPfp(null);
      setProfilePictures((prev) => ({ ...prev, [uname]: null }));
    }
  };

  /**
   * Fetch a tweet from /get-tweet-by-link
   */
  const getTweetByLink = async (link: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get-tweet-by-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link }),
      });
      const data = await response.json();

      if (data.status === 'Tweet found') {
        setTweetData(data.data);
      } else if (data.status === 'No tweet found with the given link') {
        Alert.alert('Error', 'No tweet data found for that link.');
      } else {
        Alert.alert('Error', 'Unknown error occurred while fetching tweet.');
      }
    } catch (err) {
      console.error('Error fetching tweet by link:', err);
      Alert.alert('Error', 'Unable to fetch tweet data by link');
    }
  };

  const fetchComments = async () => {
    if (!userToken || !tweetData) return;
    try {
      const response = await fetch(`${domaindynamo}/get_comments_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: userToken,
          tweet_link: tweetData.Tweet_Link,
        }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success') {
        setAllComments(data.data);
        const usernames = data.data.map((c: any) => c.username);
        fetchCommentersProfilePictures(usernames);
      } else {
        setAllComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setAllComments([]);
    }
  };

  const fetchCommentersProfilePictures = async (usernames: string[]) => {
    const uniqueUsernames = [...new Set(usernames)];
    const newProfilePics: { [key: string]: string | null } = {};

    await Promise.all(
      uniqueUsernames.map(async (uname) => {
        if (uname === username) {
          newProfilePics[uname] = tweetAuthorPfp;
          return;
        }
        if (profilePictures[uname] !== undefined) {
          newProfilePics[uname] = profilePictures[uname];
          return;
        }
        try {
          const resp = await fetch(
            `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`
          );
          const userData = await resp.json();
          if (userData.status === 'Success' && userData.profile_picture) {
            newProfilePics[uname] = userData.profile_picture;
          } else {
            newProfilePics[uname] = null;
          }
        } catch (error) {
          console.error(`Error fetching profile picture for ${uname}:`, error);
          newProfilePics[uname] = null;
        }
      })
    );

    setProfilePictures((prev) => ({ ...prev, ...newProfilePics }));
  };

  // ----------------- IMAGE -----------------
  const calculateAspectRatio = (uri: string) => {
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = screenWidth * 0.95;
    const MAX_IMAGE_HEIGHT = 300;

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
        setHasError(false);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to get image size:', error);
        setAspectRatio(16 / 9);
        setHasError(true);
        setIsLoading(false);
      }
    );
  };

  // ----------------- EXPLANATION -----------------
  interface ExplainTweetResponse {
    status: string;
    explanation?: string;
    message?: string;
  }

  const generateExplanation = async (link: string) => {
    try {
      setIsExplanationLoading(true);
      const requestBody = JSON.stringify({ tweetlink: link });
      const response = await fetch(`${domaindynamo}/explain_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      const responseBody = await response.text();

      let responseData: ExplainTweetResponse | null = null;
      try {
        responseData = JSON.parse(responseBody);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        setExplanation(null);
        return null;
      }

      if (response.ok && responseData.status === 'Success') {
        setExplanation(responseData.explanation || null);
        return responseData.explanation || null;
      } else {
        setExplanation(null);
        return null;
      }
    } catch (networkError) {
      console.error('Network error:', networkError);
      setExplanation(null);
      return null;
    } finally {
      setIsExplanationLoading(false);
    }
  };

  // ----------------- ACTIONS -----------------
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
          username,
          tweet_link: tweetData.Tweet_Link,
          content,
          parent_comment_id: null,
        }),
      });
      const responseData = await response.json();

      if (response.ok && responseData.status === 'Success') {
        Platform.OS === 'web'
          ? alert('Success: Comment has been posted')
          : Alert.alert('Success', 'Comment has been posted');
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

  // ----------------- RENDER -----------------
  const renderCommentCard = ({ item }: { item: any }) => {
    const pfpUrl = profilePictures[item.username];
    return <CommentCard comment={item} profilePictureUrl={pfpUrl} />;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      transparent={false}
    >
      <KeyboardAvoidingView
        style={[styles.keyboardAvoidingView, { backgroundColor: isDarkTheme ? '#1F2937' : '#F5F5F5' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Close Modal Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="chevron-back-outline" size={30} color="#6C63FF" />
          </TouchableOpacity>

          {/* Tweet Data */}
          {tweetData ? (
            <>
              {/* Tweet Card */}
              <View
                style={[
                  styles.tweetCard,
                  { backgroundColor: isDarkTheme ? '#374151' : '#FFFFFF' },
                ]}
              >
                {/* Tweet Header */}
                <View style={styles.tweetHeader}>
                  {tweetAuthorPfp ? (
                    <Image source={{ uri: tweetAuthorPfp }} style={styles.avatar} />
                  ) : (
                    <Icon
                      name="person-circle-outline"
                      size={50}
                      color={isDarkTheme ? '#D1D5DB' : '#6C63FF'}
                    />
                  )}
                  <View style={styles.userInfo}>
                    <Text
                      style={[
                        styles.username,
                        { color: isDarkTheme ? '#F3F4F6' : '#333333' },
                      ]}
                    >
                      {tweetData.Username}
                    </Text>
                    <Text
                      style={[
                        styles.timestamp,
                        { color: isDarkTheme ? '#D1D5DB' : '#777777' },
                      ]}
                    >
                      {new Date(tweetData.Created_At).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Tweet Text */}
                <Text
                  style={[
                    styles.tweetText,
                    { color: isDarkTheme ? '#F3F4F6' : '#444444' },
                  ]}
                >
                  {tweetData.Tweet}
                </Text>

                {/* Tweet Media */}
                {tweetData.Media_URL && (
                  <View style={styles.imageContainer}>
                    {isLoading && (
                      <ActivityIndicator
                        style={styles.loadingIndicator}
                        size="small"
                        color="#6C63FF"
                      />
                    )}
                    {!isLoading && !hasError && (
                      <Image
                        source={{ uri: tweetData.Media_URL }}
                        style={[
                          styles.tweetImage,
                          { aspectRatio, maxHeight: 300 },
                        ]}
                        resizeMode="contain"
                        accessibilityLabel="Tweet image"
                      />
                    )}
                    {!isLoading && hasError && (
                      <View
                        style={[
                          styles.tweetImage,
                          {
                            aspectRatio,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: isDarkTheme ? '#374151' : '#F0F0F0',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.errorText,
                            { color: isDarkTheme ? '#F87171' : '#AA0000' },
                          ]}
                        >
                          Image Failed to Load
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Full Tweet Link */}
                {tweetData.Tweet_Link && (
                  <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
                    <TouchableOpacity
                      style={[styles.viewFullTweetButton, { backgroundColor: '#6C63FF' }]}
                      onPress={() => Linking.openURL(tweetData.Tweet_Link)}
                    >
                      <Text style={styles.viewFullTweetButtonText}>View Full Tweet</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Tweet Stats */}
                <View style={styles.stats}>
                  <View style={styles.statItem}>
                    <Icon
                      name="repeat-outline"
                      size={20}
                      color={isDarkTheme ? '#D1D5DB' : '#555555'}
                    />
                    <Text
                      style={[
                        styles.statText,
                        { color: isDarkTheme ? '#D1D5DB' : '#555555' },
                      ]}
                    >
                      Retweets: {tweetData.Retweets || 0}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Icon
                      name="heart-outline"
                      size={20}
                      color={isDarkTheme ? '#D1D5DB' : '#555555'}
                    />
                    <Text
                      style={[
                        styles.statText,
                        { color: isDarkTheme ? '#D1D5DB' : '#555555' },
                      ]}
                    >
                      Likes: {tweetData.Favorites || 0}
                    </Text>
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
              <View
                style={[
                  styles.aiExplanationContainer,
                  { backgroundColor: isDarkTheme ? '#374151' : '#FFFFFF' },
                ]}
              >
                <Text
                  style={[
                    styles.aiExplanationHeader,
                    { color: isDarkTheme ? '#F3F4F6' : '#6C63FF' },
                  ]}
                >
                  AI Depth Explanation
                </Text>
                {isExplanationLoading ? (
                  <ActivityIndicator size="large" color="#6C63FF" />
                ) : explanation ? (
                  <Text
                    style={[
                      styles.aiExplanationText,
                      { color: isDarkTheme ? '#D1D5DB' : '#555555' },
                    ]}
                  >
                    {explanation}
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.aiExplanationText,
                      { color: isDarkTheme ? '#D1D5DB' : '#555555' },
                    ]}
                  >
                    No explanation available.
                  </Text>
                )}
              </View>

              {/* Comment Section */}
              <View
                style={[
                  styles.commentSection,
                  { backgroundColor: isDarkTheme ? '#374151' : '#FFFFFF' },
                ]}
              >
                <Text
                  style={[
                    styles.commentsHeader,
                    { color: isDarkTheme ? '#F3F4F6' : '#6C63FF' },
                  ]}
                >
                  Comments
                </Text>

                {/* Comment Input */}
                <View style={styles.commentInputContainer}>
                  {tweetAuthorPfp ? (
                    <Image source={{ uri: tweetAuthorPfp }} style={styles.currentUserImage} />
                  ) : (
                    <Icon
                      name="person-circle-outline"
                      size={40}
                      color={isDarkTheme ? '#D1D5DB' : '#6C63FF'}
                      style={styles.currentUserIcon}
                    />
                  )}
                  <TextInput
                    style={[
                      styles.commentInput,
                      {
                        backgroundColor: isDarkTheme ? '#4B5563' : '#F9F9F9',
                        color: isDarkTheme ? '#F3F4F6' : '#333333',
                      },
                    ]}
                    placeholder="Type your comment..."
                    placeholderTextColor={isDarkTheme ? '#9CA3AF' : '#999999'}
                    value={comment}
                    onChangeText={(text) => setComment(text)}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.postCommentButton, { backgroundColor: '#6C63FF' }]}
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
                    <Text
                      style={[
                        styles.noComments,
                        { color: isDarkTheme ? '#D1D5DB' : '#777777' },
                      ]}
                    >
                      No comments yet. Be the first to comment!
                    </Text>
                  }
                />
              </View>
            </>
          ) : (
            <Text
              style={[
                styles.loadingText,
                { color: isDarkTheme ? '#D1D5DB' : '#777777' },
              ]}
            >
              Loading tweet details...
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default TweetModal;

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  closeButton: {
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  tweetCard: {
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
  },
  timestamp: {
    fontSize: 14,
    marginTop: 4,
  },
  tweetText: {
    fontSize: 16,
    marginBottom: 15,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#4B5563',
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
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  aiExplanationContainer: {
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
    marginBottom: 10,
  },
  aiExplanationText: {
    fontSize: 16,
    lineHeight: 22,
  },
  commentSection: {
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
    marginBottom: 15,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  currentUserIcon: {
    marginRight: 10,
  },
  currentUserImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  commentInput: {
    flex: 1,
    minHeight: 50,
    borderColor: '#CCCCCC',
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  postCommentButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  commentsList: {
    paddingBottom: 10,
  },
  commentCard: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentInfo: {
    marginLeft: 10,
  },
  commentUsername: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentDate: {
    fontSize: 12,
    marginTop: 2,
  },
  commentText: {
    fontSize: 16,
  },
  noComments: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  viewFullTweetButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewFullTweetButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
});
