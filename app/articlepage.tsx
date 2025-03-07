// ------------------------------------------------------
// ArticleModal.tsx (Redesigned, Using "explain_article" Endpoint)
// ------------------------------------------------------
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
  Image,
  Modal,
  Dimensions,
  ActivityIndicator, // For loading spinner
  KeyboardAvoidingView,
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

// ----------------- ArticleModal Props -----------------
interface ArticleModalProps {
  visible: boolean;
  onClose: () => void;
  articleId: number | null;
}

const ArticleModal: React.FC<ArticleModalProps> = ({ visible, onClose, articleId }) => {
  const [articleData, setArticleData] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [profilePictures, setProfilePictures] = useState<{ [key: string]: string | null }>({});
  const [currentUserPfp, setCurrentUserPfp] = useState<string | null>(null);
  const [allComments, setAllComments] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [explanation, setExplanation] = useState<string>('');

  // Image handling states
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [hasImageError, setHasImageError] = useState<boolean>(false);

  const { userToken, isDarkTheme } = useContext(UserContext);

  // ----------------- EFFECTS -----------------
  useEffect(() => {
    if (userToken && articleId !== null) {
      fetchUsername();
      fetchArticleDetails(articleId);
      // Attempt to fetch an AI explanation from /explain_article
      fetchExplanation(articleId);
    }

    // Reset states if the modal is hidden
    if (!visible) {
      setArticleData(null);
      setAllComments([]);
      setExplanation('');
      setAspectRatio(16 / 9);
      setIsLoadingImage(false);
      setHasImageError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, articleId, userToken]);

  useEffect(() => {
    if (articleData) {
      fetchComments();
      if (articleData.image_url) {
        setIsLoadingImage(true);
        calculateAspectRatio(articleData.image_url);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleData]);

  // ---------- Data fetching and helpers ----------
  const fetchUsername = async () => {
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
        setUsername('');
        setCurrentUserPfp(null);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('Guest');
      setCurrentUserPfp(null);
    }
  };

  const fetchProfilePicture = async (uname: string, isCurrentUser: boolean = false) => {
    try {
      const response = await fetch(
        `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`
      );
      const data = await response.json();
      if (data.status === 'Success' && data.profile_picture) {
        if (isCurrentUser) {
          setCurrentUserPfp(data.profile_picture);
        } else {
          setProfilePictures((prev) => ({ ...prev, [uname]: data.profile_picture }));
        }
      } else {
        if (isCurrentUser) setCurrentUserPfp(null);
        setProfilePictures((prev) => ({ ...prev, [uname]: null }));
      }
    } catch (error) {
      console.error(`Error fetching profile picture for ${uname}:`, error);
      if (isCurrentUser) setCurrentUserPfp(null);
      setProfilePictures((prev) => ({ ...prev, [uname]: null }));
    }
  };

  const fetchArticleDetails = async (id: number) => {
    try {
      const response = await fetch(`${domaindynamo}/get-article-by-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
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

  // ---------- KEY CHANGE HERE: Use /explain_article -----------
  const fetchExplanation = async (id: number) => {
    try {
      // Now calling the new /explain_article endpoint
      const response = await fetch(`${domaindynamo}/explain_article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: id }),
      });
      const data = await response.json();
      if (data.status === 'Success' && data.explanation) {
        setExplanation(data.explanation);
      } else {
        setExplanation('');
      }
    } catch (error) {
      console.error('Error fetching explanation:', error);
      setExplanation('');
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
    const newProfilePictures: { [key: string]: string | null } = {};

    await Promise.all(
      uniqueUsernames.map(async (uname) => {
        if (uname === username) {
          newProfilePictures[uname] = currentUserPfp;
          return;
        }
        if (profilePictures[uname] !== undefined) {
          newProfilePictures[uname] = profilePictures[uname];
          return;
        }
        try {
          const response = await fetch(
            `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`
          );
          const data = await response.json();
          if (data.status === 'Success' && data.profile_picture) {
            newProfilePictures[uname] = data.profile_picture;
          } else {
            newProfilePictures[uname] = null;
          }
        } catch (error) {
          console.error(`Error fetching profile picture for ${uname}:`, error);
          newProfilePictures[uname] = null;
        }
      })
    );

    setProfilePictures((prev) => ({ ...prev, ...newProfilePictures }));
  };

  // ---------- IMAGE DISPLAY (same approach as TweetModal) ----------
  const calculateAspectRatio = (uri: string) => {
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = screenWidth * 0.95; // ~some margin
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
        setHasImageError(false);
        setIsLoadingImage(false);
      },
      (error) => {
        console.error('Failed to get image size:', error);
        setAspectRatio(16 / 9);
        setHasImageError(true);
        setIsLoadingImage(false);
      }
    );
  };

  // ---------- Utility ----------
  const formatToUTCA = (isoDate: string) => {
    const date = new Date(isoDate);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };

  // ---------- Actions ----------
  const handleLinkPress = (link: string) => {
    Linking.openURL(link).catch(() =>
      Alert.alert('Error', 'Failed to open article link.')
    );
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
          ? alert(`Error: ${responseData.message || 'Could not save article'}`)
          : Alert.alert('Error', responseData.message || 'Could not save article');
      }
    } catch (error) {
      console.error('Error saving Article', error);
      Platform.OS === 'web'
        ? alert('Error: Unable to save Article')
        : Alert.alert('Error', 'Unable to save Article');
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
        body: JSON.stringify({
          article_id: articleData.id,
          username,
          content: comment,
          parent_comment_id: null,
        }),
      });
      const responseData = await response.json();
      if (response.ok && responseData.status === 'Success') {
        Platform.OS === 'web'
          ? alert('Success: Comment has been posted')
          : Alert.alert('Success', 'Comment has been posted');
        setComment('');
        fetchComments(); // Refresh comments
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

  // ---------- Render ----------
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
        style={[
          styles.keyboardAvoidingView,
          { backgroundColor: isDarkTheme ? '#1F2937' : '#F5F5F5' },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Close Modal Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="chevron-back-outline" size={30} color="#6C63FF" />
          </TouchableOpacity>

          {articleData ? (
            <>
              {/* Article Card */}
              <View
                style={[
                  styles.articleCard,
                  { backgroundColor: isDarkTheme ? '#374151' : '#FFFFFF' },
                ]}
              >
                {/* Article Header */}
                <View style={styles.articleHeader}>
                  <Text
                    style={[
                      styles.headline,
                      { color: isDarkTheme ? '#F3F4F6' : '#333333' },
                    ]}
                  >
                    {articleData.headline}
                  </Text>
                  <View style={styles.headerSubInfo}>
                    <Text
                      style={[
                        styles.categoryText,
                        { color: isDarkTheme ? '#D1D5DB' : '#777777' },
                      ]}
                    >
                      Category: {articleData.category}
                    </Text>
                    <Text
                      style={[
                        styles.authorsText,
                        { color: isDarkTheme ? '#D1D5DB' : '#777777' },
                      ]}
                    >
                      Authors: {articleData.authors || 'Unknown'}
                    </Text>
                    <Text
                      style={[
                        styles.dateText,
                        { color: isDarkTheme ? '#D1D5DB' : '#777777' },
                      ]}
                    >
                      Date: {formatToUTCA(articleData.date)}
                    </Text>
                  </View>
                </View>

                {/* Article Image (same approach as TweetModal) */}
                {articleData.image_url && (
                  <View style={styles.imageContainer}>
                    {isLoadingImage && (
                      <ActivityIndicator
                        style={styles.loadingIndicator}
                        size="small"
                        color="#6C63FF"
                      />
                    )}
                    {/* Successfully loaded image */}
                    {!isLoadingImage && !hasImageError && (
                      <Image
                        source={{ uri: articleData.image_url }}
                        style={[
                          styles.articleImage,
                          {
                            aspectRatio,
                            maxHeight: 300,
                            backgroundColor: isDarkTheme ? '#374151' : '#F0F0F0',
                          },
                        ]}
                        resizeMode="contain"
                      />
                    )}
                    {/* Error loading image */}
                    {!isLoadingImage && hasImageError && (
                      <View
                        style={[
                          styles.articleImage,
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

                {/* Article Description */}
                <Text
                  style={[
                    styles.shortDescription,
                    { color: isDarkTheme ? '#D1D5DB' : '#444444' },
                  ]}
                >
                  {articleData.short_description}
                </Text>

                {/* Buttons: Read, Save, Share */}
                <View style={styles.articleActions}>
                  {/* Read Full Article */}
                  <TouchableOpacity
                    style={[styles.buttonPrimary]}
                    onPress={() => handleLinkPress(articleData.link)}
                  >
                    <Text style={styles.buttonPrimaryText}>Read Full Article</Text>
                  </TouchableOpacity>

                  {/* Save */}
                  <TouchableOpacity
                    style={styles.buttonIcon}
                    onPress={handleSave}
                  >
                    <Icon name="bookmark-outline" size={24} color="#6C63FF" />
                  </TouchableOpacity>

                  {/* Share */}
                  <TouchableOpacity
                    style={styles.buttonIcon}
                    onPress={() => handleShare(articleData.id)}
                  >
                    <Icon name="share-outline" size={24} color="#6C63FF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* AI Explanation Card */}
              <View
                style={[
                  styles.explanationContainer,
                  { backgroundColor: isDarkTheme ? '#374151' : '#FFFFFF' },
                ]}
              >
                <Text
                  style={[
                    styles.explanationHeader,
                    { color: isDarkTheme ? '#F3F4F6' : '#6C63FF' },
                  ]}
                >
                  AI Explanation
                </Text>
                <View style={styles.explanationBody}>
                  {explanation ? (
                    <Text
                      style={[
                        styles.explanationText,
                        { color: isDarkTheme ? '#D1D5DB' : '#555555' },
                      ]}
                    >
                      {explanation}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.explanationText,
                        { color: isDarkTheme ? '#D1D5DB' : '#555555' },
                      ]}
                    >
                      No AI explanation found or still generating...
                    </Text>
                  )}
                </View>
              </View>

              {/* Comments Section */}
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
                  {currentUserPfp ? (
                    <Image source={{ uri: currentUserPfp }} style={styles.currentUserImage} />
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
                    onChangeText={setComment}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.postCommentButton, { backgroundColor: '#6C63FF' }]}
                    onPress={() => postComment(comment)}
                  >
                    <Icon name="send-outline" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {/* List of Comments */}
                <FlatList
                  data={allComments}
                  renderItem={renderCommentCard}
                  keyExtractor={(item) => item.comment_id.toString()}
                  contentContainerStyle={{ paddingBottom: 10 }}
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
              Loading article details...
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ArticleModal;

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
  articleCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  articleHeader: {
    marginBottom: 10,
  },
  headline: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubInfo: {
    flexDirection: 'column',
  },
  categoryText: {
    fontSize: 14,
    marginBottom: 4,
  },
  authorsText: {
    fontSize: 14,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
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
  articleImage: {
    width: '100%',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
  },
  shortDescription: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 15,
  },
  articleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  buttonPrimary: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonPrimaryText: {
    color: '#FFF',
    fontSize: 16,
  },
  buttonIcon: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  explanationContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  explanationHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  explanationBody: {
    marginTop: 5,
  },
  explanationText: {
    fontSize: 16,
    lineHeight: 22,
  },
  commentSection: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
});
