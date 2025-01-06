    // ------------------------------------------------------
    // ArticleModal.tsx
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
      Modal, // <-- Important
    } from 'react-native';
    import Icon from 'react-native-vector-icons/Ionicons';
    import { UserContext } from '../app/UserContext';
    import BackButton from '../components/ui/BackButton';

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
      const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
      const [username, setUsername] = useState('');
      const [profilePictures, setProfilePictures] = useState<{ [key: string]: string | null }>({});
      const [currentUserPfp, setCurrentUserPfp] = useState<string | null>(null);
      const [allComments, setAllComments] = useState<any[]>([]);
      const [comment, setComment] = useState('');

      const { userToken, isDarkTheme } = useContext(UserContext);

      // Fetch article details whenever `articleId` changes
      useEffect(() => {
        if (userToken) {
          fetchUsername();
          if (articleId !== null) {
            fetchArticleDetails(articleId);
            fetchRelatedArticles(articleId);
          }
        }
      }, [userToken, articleId]);

      // Once we get articleData, fetch comments
      useEffect(() => {
        if (articleData) {
          fetchComments();
        }
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

      const fetchRelatedArticles = async (id: number) => {
        try {
          const response = await fetch(`${domaindynamo}/get-related`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
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
              // Already fetched the current user's pfp
              newProfilePictures[uname] = currentUserPfp;
              return;
            }
            if (profilePictures[uname] !== undefined) {
              // We already have pfp for this user
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
          animationType="slide"    // 'slide' or 'fade' or 'none'
          onRequestClose={onClose} // Android back button closes the modal
          presentationStyle="pageSheet"
          // ^ On iOS, 'pageSheet' can make it slide up from the bottom.
          //   If you want a different style, experiment with 'fullScreen' or 'formSheet'.
          transparent={false}      // If true, you'll see a transparent backdrop
        >
          <ScrollView
            style={[
              styles.container,
              { backgroundColor: isDarkTheme ? '#1F2937' : '#F5F5F5' },
            ]}
            contentContainerStyle={styles.contentContainer}
          >
            {/* A custom "Back" button or close button for the modal */}
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close Modal">
              <Icon name="chevron-back-outline" size={30} color="#6C63FF" />
            </TouchableOpacity>

            {articleData ? (
              <View
                style={[
                  styles.articleCard,
                  { backgroundColor: isDarkTheme ? '#374151' : '#FFFFFF' },
                ]}
              >
                {/* HEADLINE */}
                <Text
                  style={[
                    styles.headline,
                    { color: isDarkTheme ? '#F3F4F6' : '#333333' },
                  ]}
                >
                  {articleData.headline}
                </Text>
                {/* CATEGORY & DATE */}
                <Text
                  style={[
                    styles.category,
                    { color: isDarkTheme ? '#D1D5DB' : '#777777' },
                  ]}
                >
                  Category: {articleData.category}
                </Text>
                <Text
                  style={[
                    styles.date,
                    { color: isDarkTheme ? '#D1D5DB' : '#999999' },
                  ]}
                >
                  Date: {formatToUTCA(articleData.date)}
                </Text>
                <Text
                  style={[
                    styles.authors,
                    { color: isDarkTheme ? '#D1D5DB' : '#555555' },
                  ]}
                >
                  Authors: {articleData.authors || 'Unknown'}
                </Text>
                {/* DESCRIPTION */}
                <Text
                  style={[
                    styles.shortDescription,
                    { color: isDarkTheme ? '#D1D5DB' : '#444444' },
                  ]}
                >
                  {articleData.short_description}
                </Text>

                {/* READ MORE */}
                <TouchableOpacity
                  style={[
                    styles.readMoreButton,
                    { backgroundColor: '#6C63FF' },
                  ]}
                  onPress={() => handleLinkPress(articleData.link)}
                  accessibilityLabel="Read Full Article"
                >
                  <Text style={styles.readMoreText}>Read Full Article</Text>
                </TouchableOpacity>

                {/* ACTION ICONS */}
                <View style={styles.actionIcons}>
                  <TouchableOpacity
                    onPress={handleSave}
                    accessibilityRole="button"
                    accessibilityLabel="Save Article"
                  >
                    <Icon name="bookmark-outline" size={30} color="#6C63FF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShare(articleData.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Share Article"
                  >
                    <Icon name="share-outline" size={30} color="#6C63FF" />
                  </TouchableOpacity>
                </View>

                {/* COMMENTS SECTION */}
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
                  {/* INPUT ROW */}
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
                      style={[
                        styles.postCommentButton,
                        { backgroundColor: '#6C63FF' },
                      ]}
                      onPress={() => postComment(comment)}
                      accessibilityLabel="Post Comment"
                    >
                      <Icon name="send-outline" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>

                  {/* FLATLIST COMMENTS */}
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
              </View>
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

            {/* RELATED ARTICLES */}
            <Text
              style={[
                styles.relatedHeader,
                { color: isDarkTheme ? '#F3F4F6' : '#6C63FF' },
              ]}
            >
              Related Articles
            </Text>
            {relatedArticles.length > 0 ? (
              relatedArticles.map((article) => (
                <TouchableOpacity
                  key={article.id}
                  style={[
                    styles.relatedCard,
                    { backgroundColor: isDarkTheme ? '#374151' : '#FFFFFF' },
                  ]}
                  onPress={() => {
                    // If you want to load a new article in the same modal:
                    fetchArticleDetails(article.id);
                    fetchRelatedArticles(article.id);
                  }}
                  accessibilityLabel={`View related article: ${article.headline}`}
                >
                  <Text
                    style={[
                      styles.relatedHeadline,
                      { color: isDarkTheme ? '#F3F4F6' : '#333333' },
                    ]}
                  >
                    {article.headline}
                  </Text>
                  <Text
                    style={[
                      styles.relatedCategory,
                      { color: isDarkTheme ? '#D1D5DB' : '#777777' },
                    ]}
                  >
                    Category: {article.category}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text
                style={[
                  styles.noRelated,
                  { color: isDarkTheme ? '#D1D5DB' : '#777777' },
                ]}
              >
                No related articles found.
              </Text>
            )}
          </ScrollView>
        </Modal>
      );
    };

    export default ArticleModal;

    // ------------------------------------------------------
    // STYLES
    // ------------------------------------------------------
    const styles = StyleSheet.create({
      container: {
        flex: 1,
      },
      contentContainer: {
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
      headline: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
      },
      category: {
        fontSize: 14,
        marginBottom: 5,
      },
      date: {
        fontSize: 14,
        marginBottom: 5,
      },
      authors: {
        fontSize: 14,
        marginBottom: 15,
      },
      shortDescription: {
        fontSize: 16,
        lineHeight: 22,
        marginBottom: 20,
      },
      readMoreButton: {
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
        marginBottom: 15,
      },
      commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 20,
      },
      currentUserImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
      },
      currentUserIcon: {
        marginRight: 10,
      },
      commentInput: {
        flex: 1,
        height: 50,
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
        flexDirection: 'column',
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
      relatedHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        marginVertical: 20,
      },
      relatedCard: {
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
        marginBottom: 5,
      },
      relatedCategory: {
        fontSize: 14,
      },
      noRelated: {
        fontSize: 16,
        textAlign: 'center',
      },
      loadingText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 20,
      },
    });
