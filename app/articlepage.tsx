// components/ArticleModal.tsx
import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  // Alert, // Replaced by InAppMessage
  Linking,
  Platform,
  FlatList,
  TextInput,
  Image,
  Modal,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust path if necessary
import InAppMessage from '../components/ui/InAppMessage'; // Use InAppMessage

// --- Configuration ---
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const { width, height } = Dimensions.get('window');

// --- Responsive Sizing (Keep from Redesign) ---
const getResponsiveSize = (baseSize: number): number => {
  if (width < 350) return baseSize * 0.9;
  if (width < 400) return baseSize;
  return baseSize * 1.1;
};

const fontSizes = {
  small: getResponsiveSize(12),
  base: getResponsiveSize(14),
  medium: getResponsiveSize(16),
  large: getResponsiveSize(18),
  xlarge: getResponsiveSize(20), // For Headline
  header: getResponsiveSize(17),
};

// --- Helper Hooks (Keep from Redesign) ---
const useKeyboardVisible = () => {
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);
    return isKeyboardVisible;
};

// ----------------- CommentCard Component (Keep Redesigned) -----------------
interface CommentCardProps {
  comment: {
    username: string;
    created_at: string;
    content: string;
  };
  profilePictureUrl?: string | null;
  isDarkTheme: boolean;
  colors: any;
}

const CommentCard: React.FC<CommentCardProps> = React.memo(({ comment, profilePictureUrl, isDarkTheme, colors }) => {
   const formatRelativeTime = (isoDate?: string): string => {
    if (!isoDate) return '';
    try {
        const date = new Date(isoDate);
        const now = new Date();
        const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
        const diffMinutes = Math.round(diffSeconds / 60);
        const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffSeconds < 5) return 'now';
        if (diffSeconds < 60) return `${diffSeconds}s`;
        if (diffMinutes < 60) return `${diffMinutes}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return 'Invalid Date'; }
  };

  return (
    <View style={[styles.commentCard, { borderBottomColor: colors.borderColor }]}>
      <View style={styles.commentHeader}>
        {profilePictureUrl ? (
          <Image source={{ uri: profilePictureUrl }} style={styles.commentImage} />
        ) : (
          <View style={[styles.commentImagePlaceholder, { backgroundColor: colors.placeholder }]}>
            <Icon name="person" size={18} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.commentInfo}>
          <Text style={[styles.commentUsername, { color: colors.textPrimary }]}>
            {comment.username}
          </Text>
          <Text style={[styles.commentDate, { color: colors.textSecondary }]}>
            {formatRelativeTime(comment.created_at)}
          </Text>
        </View>
      </View>
      <Text style={[styles.commentText, { color: colors.textPrimary }]}>
        {comment.content}
      </Text>
    </View>
  );
});


// ----------------- ArticleModal Props -----------------
interface ArticleModalProps {
  visible: boolean;
  onClose: () => void;
  articleId: number | null;
}

// ----------------- ArticleModal Component (TweetModal Image Logic Applied) -----------------
const ArticleModal: React.FC<ArticleModalProps> = ({ visible, onClose, articleId }) => {
  const { userToken, isDarkTheme } = useContext(UserContext);

  // --- State (Original Logic State + Redesign Loading States + TweetModal Image State) ---
  const [articleData, setArticleData] = useState<any>(null);
  const [allComments, setAllComments] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [currentUserPfp, setCurrentUserPfp] = useState<string | null | undefined>(undefined);
  const [profilePictures, setProfilePictures] = useState<{ [key: string]: string | null }>({});
  const [comment, setComment] = useState('');
  const [explanation, setExplanation] = useState<string | null>(null);

  // --- NEW Image State (TweetModal Style) ---
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null); // Nullable aspect ratio
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false); // Specific image loading state
  const [imageError, setImageError] = useState<boolean>(false); // Specific image error state

  // --- Loading States (Keep from Redesign for UI Spinners/Feedback) ---
  const [isArticleLoading, setIsArticleLoading] = useState(false); // Overall article loading
  const [isCommentsLoading, setIsCommentsLoading] = useState(false); // Comments section
  const [isExplanationLoading, setIsExplanationLoading] = useState(false); // Explanation section
  const [isSaving, setIsSaving] = useState(false); // Save button
  const [isSharing, setIsSharing] = useState(false); // Share button
  const [isPostingComment, setIsPostingComment] = useState(false); // Post comment button

  // --- In-App Message State (Keep from Redesign) ---
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  const scrollViewRef = useRef<ScrollView>(null);
  const isKeyboardVisible = useKeyboardVisible();

  // --- Theming (Keep Synced Theme from Redesign) ---
   const themes = { // Using the themes from the redesign for visual consistency
    light: {
      background: '#F8F9FA', cardBackground: '#FFFFFF', textPrimary: '#1F2937',
      textSecondary: '#6B7280', textTertiary: '#9CA3AF', accent: '#6366F1',
      accentContrast: '#FFFFFF', destructive: '#EF4444', success: '#10B981',
      info: '#3B82F6', borderColor: '#E5E7EB', placeholder: '#D1D5DB',
      inputBackground: '#FFFFFF',
    },
    dark: {
      background: '#0A0A0A', cardBackground: '#1A1A1A', textPrimary: '#EAEAEA',
      textSecondary: '#A0A0A0', textTertiary: '#6B7280', accent: '#9067C6',
      accentContrast: '#FFFFFF', destructive: '#FF6B6B', success: '#34D399',
      info: '#60A5FA', borderColor: '#2C2C2E', placeholder: '#2C2C2E',
      inputBackground: '#1A1A1A',
    },
  };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;

  // --- Helper Functions (Keep from Redesign) ---
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
  }, []);

  // Original date formatter
  const formatDisplayDate = (isoDate?: string): string => {
    if (!isoDate) return 'N/A';
    try {
      const date = new Date(isoDate);
      // Keep original format: DD-MM-YYYY
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch { return 'Invalid Date'; }
  };

  // --- Effects (Restored Original Logic for Article/Comments/Explanation) ---
  useEffect(() => {
    // Original Reset logic + Fetch logic for Article/Explanation
    const fetchInitial = async () => {
        if (visible && userToken && articleId !== null) {
            if (articleData?.id !== articleId && !isArticleLoading) {
                console.log('[ArticleModal] articleId changed or initial load, fetching...');
                setIsArticleLoading(true); // Start overall loading
                await fetchUsername();
                const fetchedArticle = await fetchArticleDetails(articleId);
                if (fetchedArticle) {
                    await fetchExplanation(articleId);
                }
                // Comments are fetched in separate effect based on articleData.id
                setIsArticleLoading(false); // End overall loading
            } else if (articleData?.id === articleId) {
                 console.log('[ArticleModal] articleId matches existing data, skipping initial article fetch.');
                 // Still fetch comments/explanation if missing
                 if (!allComments.length && !isCommentsLoading) fetchComments();
                 if (!explanation && !isExplanationLoading) fetchExplanation(articleId);
            }
        }
    };

    if (visible) {
        fetchInitial();
    } else {
        // Original Reset logic when modal closes
        console.log('[ArticleModal] Resetting state on hide.');
        setArticleData(null);
        setAllComments([]);
        setExplanation(null);
        // Reset NEW image state
        setImageAspectRatio(null);
        setIsImageLoading(false);
        setImageError(false);
        // Reset other state
        setUsername('');
        setCurrentUserPfp(undefined);
        setProfilePictures({});
        setComment('');
        setIsArticleLoading(false);
        setIsCommentsLoading(false);
        setIsExplanationLoading(false);
        setIsSaving(false);
        setIsSharing(false);
        setIsPostingComment(false);
        setMessageVisible(false);
        setMessageText('');
    }
  }, [visible, articleId, userToken]);

  // Original Effect for fetching comments based on articleData
  useEffect(() => {
    if (articleData?.id) {
      // Fetch comments if article data is present and comments aren't already loading
      if (!isCommentsLoading) {
          fetchComments();
      }
      // Image handling is now in its own effect below
    }
  }, [articleData?.id]); // Depend only on article ID for comments

  // --- NEW Effect for Image Handling (TweetModal Style) ---
  useEffect(() => {
    if (articleData?.image_url) {
      let isMounted = true; // Prevent state update on unmounted component
      console.log('[ArticleModal] Image URL found, fetching image size:', articleData.image_url);

      // Set loading states before fetching
      setIsImageLoading(true);
      setImageError(false);
      setImageAspectRatio(null); // Reset aspect ratio

      Image.getSize(
        articleData.image_url,
        (width, height) => {
          // Check if component is still mounted and dimensions are valid
          if (isMounted) {
            if (width > 0 && height > 0) {
              console.log('[ArticleModal] Image size received:', width, height);
              // Calculate and set aspect ratio
              setImageAspectRatio(width / height);
            } else {
              console.warn('[ArticleModal] Invalid image dimensions received:', width, height);
              setImageError(true); // Treat invalid dimensions as an error
            }
            setIsImageLoading(false); // Loading finished (success or invalid dimensions)
          }
        },
        (error) => {
          // Handle fetching errors
          if (isMounted) {
            console.error('[ArticleModal] Failed to get image size:', error);
            setImageError(true);
            setIsImageLoading(false); // Loading finished (error)
          }
        }
      );

      // Cleanup function
      return () => {
        console.log('[ArticleModal] Image size effect cleanup.');
        isMounted = false;
      };
    } else {
      // If no image_url, ensure image states are reset
      setIsImageLoading(false);
      setImageError(false);
      setImageAspectRatio(null);
    }
    // This effect depends on the image_url changing
  }, [articleData?.image_url]);


  // --- Fetching Logic (Restored Original Functions for Article/Comments/Explanation) ---
   const fetchUsername = async () => {
    // Original fetchUsername logic
    if (!userToken) { setUsername('Guest'); setCurrentUserPfp(null); return; }
    let fetchedUsername = 'Guest';
    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success' && data.username) {
        fetchedUsername = data.username;
        setUsername(fetchedUsername);
        console.log(`[ArticleModal] Fetched username: ${fetchedUsername}. Now fetching PFP...`);
        await fetchProfilePicture(fetchedUsername, true);
        console.log(`[ArticleModal] Finished PFP fetch call for ${fetchedUsername}`);
      } else {
        console.warn('[ArticleModal] Failed to fetch username, setting to Guest.');
        setUsername('Guest');
        setCurrentUserPfp(null);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('Guest');
      setCurrentUserPfp(null);
    }
  };

  const fetchProfilePicture = async (uname: string, isCurrentUser: boolean = false) => {
     // Original fetchProfilePicture logic
    if (!uname) return;
    if (!isCurrentUser && profilePictures[uname] !== undefined) return;
    if (isCurrentUser && currentUserPfp !== undefined) return;

    console.log(`[ArticleModal] Fetching PFP for ${uname}, isCurrentUser=${isCurrentUser}`);
    try {
      const response = await fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`);
      const data = await response.json();
      const pfp = (response.ok && data.status === 'Success' && data.profile_picture) ? data.profile_picture : null;
      console.log(`[ArticleModal] PFP result for ${uname}: ${pfp ? 'Found' : 'Not Found or Error'}`);
      if (isCurrentUser) {
          console.log(`[ArticleModal] Setting currentUserPfp to: ${pfp}`);
          setCurrentUserPfp(pfp);
      } else {
        setProfilePictures((prev) => ({ ...prev, [uname]: pfp }));
      }
    } catch (error) {
      console.error(`Error fetching profile picture for ${uname}:`, error);
      if (isCurrentUser) setCurrentUserPfp(null);
      else setProfilePictures((prev) => ({ ...prev, [uname]: null }));
    }
  };

  const fetchArticleDetails = async (id: number): Promise<any | null> => {
    // Original fetchArticleDetails logic
    setArticleData(null);
    try {
      const response = await fetch(`${domaindynamo}/get-article-by-id`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Article found' && data.data) {
        setArticleData(data.data);
        return data.data;
      } else {
        showInAppMessage(data.message || 'Article not found.', 'error');
        setArticleData(null);
        return null;
      }
    } catch (error: any) {
      console.error('Error fetching article details:', error);
      showInAppMessage(`Error fetching article: ${error.message || 'Network error'}`, 'error');
      setArticleData(null);
      return null;
    }
  };

  const fetchExplanation = async (id: number | null = null) => {
    // Original fetchExplanation logic
    const targetId = id ?? articleData?.id;
    if (!targetId) return;

    setIsExplanationLoading(true);
    setExplanation(null);
    console.log(`[ArticleModal] Fetching explanation for article ID: ${targetId}`);
    try {
      const response = await fetch(`${domaindynamo}/explain_article`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: targetId }),
      });

      const responseBody = await response.text();
      console.log(`[ArticleModal] fetchExplanation status: ${response.status}`);
      console.log(`[ArticleModal] fetchExplanation response text: ${responseBody}`);

       let responseData: { status: string; explanation?: string; message?: string } | null = null;
        try {
            if (responseBody.trim().startsWith('{')) {
                 responseData = JSON.parse(responseBody);
                 console.log('[ArticleModal] fetchExplanation parsed JSON:', responseData);
            } else {
                 console.warn('[ArticleModal] fetchExplanation response is not JSON:', responseBody);
            }
        } catch (parseError) {
            console.error('Failed to parse explanation JSON response:', parseError, responseBody);
            setExplanation(null);
            showInAppMessage('Received invalid explanation format.', 'error');
            setIsExplanationLoading(false);
            return;
        }

      if (response.ok && responseData?.status === 'Success' && responseData.explanation) {
        console.log("[ArticleModal] Explanation fetch SUCCESS");
        setExplanation(responseData.explanation.trim());
      } else {
         const failureReason = responseData?.message || `Status: ${response.status}`;
         console.warn("[ArticleModal] Explanation fetch FAILED:", failureReason);
        setExplanation(null);
      }
    } catch (error: any) {
      console.error('Error fetching explanation:', error);
      showInAppMessage(`Could not get explanation: ${error.message || 'Network error'}`, 'error');
      setExplanation(null);
    } finally {
      setIsExplanationLoading(false);
    }
  };

  const fetchComments = async () => {
    // Original fetchComments logic
    if (!articleData?.id) return;
    setIsCommentsLoading(true);
    setAllComments([]);
    try {
      const response = await fetch(`${domaindynamo}/get_comments_article`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleData.id }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success' && Array.isArray(data.data)) {
        setAllComments(data.data);
        if (data.data.length > 0) {
            const usernames = data.data.map((c: any) => c.username).filter(Boolean);
            fetchCommentersProfilePictures(usernames);
        }
      } else {
         if (data.status !== 'No comments found') {
             console.warn('Error fetching comments:', data.message || `Status: ${response.status}`);
         }
        setAllComments([]);
      }
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      setAllComments([]);
    } finally {
        setIsCommentsLoading(false);
    }
  };

 const fetchCommentersProfilePictures = async (usernames: string[]) => {
    // Original fetchCommentersProfilePictures logic
    const uniqueUsernames = [...new Set(usernames)].filter(Boolean);
    const newProfilePictures: { [key: string]: string | null } = {};
    const usernamesToFetch = uniqueUsernames.filter(uname =>
        profilePictures[uname] === undefined && !(uname === username && currentUserPfp !== undefined)
    );

     uniqueUsernames.forEach(uname => {
         if (uname === username && currentUserPfp !== undefined) { newProfilePictures[uname] = currentUserPfp; }
         else if (profilePictures[uname] !== undefined) { newProfilePictures[uname] = profilePictures[uname]; }
     });

    if (usernamesToFetch.length === 0) {
        const currentKeys = Object.keys(profilePictures);
        const newKeys = Object.keys(newProfilePictures);
        if (newKeys.some(key => !currentKeys.includes(key) || profilePictures[key] !== newProfilePictures[key])) {
             setProfilePictures((prev) => ({ ...prev, ...newProfilePictures }));
        }
        return;
    }
    console.log('[ArticleModal] Fetching PFPs for commenters:', usernamesToFetch);
    const fetchPromises = usernamesToFetch.map(async (uname) => {
        try {
            const response = await fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`);
            const data = await response.json();
            return { [uname]: (response.ok && data.status === 'Success' && data.profile_picture) ? data.profile_picture : null };
        } catch (error) { console.error(`Error fetching PFP for ${uname}:`, error); return { [uname]: null }; }
    });
    const results = await Promise.all(fetchPromises);
    const fetchedProfilePics = results.reduce((acc, current) => ({ ...acc, ...current }), {});
    const finalProfilePics = { ...newProfilePictures, ...fetchedProfilePics };

    setProfilePictures((prev) => {
        const updated = { ...prev, ...finalProfilePics };
        console.log('[ArticleModal] Updated profilePictures state:', updated);
        return updated;
    });
  };


  // --- REMOVED Original Image Handling Logic ---
  // const calculateAspectRatio = ... (REMOVED)

  // --- REMOVED Original Image Load Handlers ---
  // const handleImageLoadStart = ... (REMOVED)
  // const handleImageLoadEnd = ... (REMOVED)
  // const handleImageError = ... (REMOVED)

  // --- NEW Simple Image Error Handler (TweetModal Style) ---
  const handleImageComponentError = useCallback(() => {
      console.log("[ArticleModal] Image component onError triggered:", articleData?.image_url);
      // Ensure error state is set if getSize somehow succeeded but Image failed
      if (!imageError) {
          setImageError(true);
      }
      // Ensure loading is false
      if (isImageLoading) {
          setIsImageLoading(false);
      }
  }, [articleData?.image_url, imageError, isImageLoading]);


  // --- Action Handlers (Restored Original Logic, using InAppMessage) ---
  const handleLinkPress = (link: string | undefined) => {
      // Original handleLinkPress logic
      if (link) {
        Linking.openURL(link).catch(() =>
            showInAppMessage('Failed to open article link.', 'error')
        );
      } else {
           showInAppMessage('No article link available.', 'info');
      }
  };

  const handleSave = async () => {
    // Original handleSave logic
    if (!userToken || !articleData?.id) {
      showInAppMessage('Login required to save articles.', 'info');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`${domaindynamo}/save-articles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, article_id: articleData.id }),
      });
      const responseData = await response.json();
      if (response.ok && responseData.status === 'Success') {
         showInAppMessage('Article saved successfully!', 'success');
      } else {
         showInAppMessage(responseData.message || 'Could not save article.', 'error');
      }
    } catch (error: any) {
      console.error('Error saving Article', error);
      showInAppMessage(`Error saving article: ${error.message || 'Network error'}`, 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleShare = async (articleId: number | undefined) => {
    // Original handleShare logic
     if (articleId === undefined) return;
    if (!userToken) {
      showInAppMessage('Login required to share articles.', 'info');
      return;
    }
    setIsSharing(true);
    try {
      const response = await fetch(`${domaindynamo}/share_articles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, article_id: articleId }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success') {
        showInAppMessage('Article shared successfully!', 'success');
      } else {
        showInAppMessage(data.message || 'Unable to share article.', 'error');
      }
    } catch (error: any) {
      console.error('Error sharing article', error);
      showInAppMessage(`Error sharing article: ${error.message || 'Network error'}`, 'error');
    } finally {
        setIsSharing(false);
    }
  };

 const postComment = async (commentContent: string) => {
    // Original postComment logic
    if (!userToken || !articleData?.id) {
      showInAppMessage('Login required to comment.', 'info');
      return;
    }
    const trimmedContent = commentContent.trim();
    if (trimmedContent === '') {
      showInAppMessage('Comment cannot be empty.', 'error');
      return;
    }
    setIsPostingComment(true);
    Keyboard.dismiss();
    try {
      const response = await fetch(`${domaindynamo}/comment_article`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleData.id, username, content: trimmedContent, parent_comment_id: null }),
      });
      const responseData = await response.json();
      if (response.ok && responseData.status === 'Success') {
        showInAppMessage('Comment posted!', 'success');
        setComment('');
        fetchComments(); // Refresh comments (original call without ID)
      } else {
        showInAppMessage(responseData.message || 'Could not post comment.', 'error');
      }
    } catch (error: any) {
      console.error('Error posting comment:', error);
       showInAppMessage(`Error posting comment: ${error.message || 'Network error'}`, 'error');
    } finally {
        setIsPostingComment(false);
    }
  };


  // --- Render Logic ---
  const renderCommentCard = ({ item }: { item: any }) => {
    // Use redesigned CommentCard render
    const pfpUrl = profilePictures[item.username];
    return <CommentCard comment={item} profilePictureUrl={pfpUrl} isDarkTheme={isDarkTheme} colors={currentTheme} />;
  };

  // Log current user PFP state before render (as in original)
  // console.log(`[ArticleModal Render] currentUserPfp state: ${currentUserPfp}`);

  // --- Main Render (Using Redesign Structure, TweetModal Image Logic/UI) ---
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      transparent={false}
    >
        <View style={[styles.modalContainer, { backgroundColor: currentTheme.background }]}>
            {/* Custom Header (Keep from Redesign) */}
            <View style={[styles.modalHeader, { borderBottomColor: currentTheme.borderColor }]}>
                <View style={styles.headerSpacer} />
                <Text style={[styles.modalTitle, { color: currentTheme.textPrimary }]}>Article Details</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                   <Icon name="close-outline" size={28} color={currentTheme.accent} />
                </TouchableOpacity>
            </View>

            {/* Content Area (Keep from Redesign) */}
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Use isArticleLoading for the main loading state */}
                {isArticleLoading ? (
                    <View style={styles.fullScreenLoader}>
                        <ActivityIndicator size="large" color={currentTheme.accent} />
                    </View>
                ) : articleData ? ( // Render content only if articleData exists
                    <ScrollView
                        ref={scrollViewRef}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Article Display Area (Keep Redesign Structure) */}
                        <View style={styles.articleContentContainer}>
                             {/* Headline */}
                             <Text style={[styles.headline, { color: currentTheme.textPrimary }]}>
                                {articleData.headline}
                             </Text>

                             {/* Sub Info Row (Authors & Date) */}
                            <View style={styles.subInfoRow}>
                                {articleData.authors && (
                                    <Text style={[styles.subInfoText, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                                        By {articleData.authors}
                                    </Text>
                                )}
                                {(articleData.authors && articleData.date) && <Text style={[styles.subInfoSeparator, { color: currentTheme.textTertiary }]}>·</Text>}
                                {articleData.date && (
                                    <Text style={[styles.subInfoText, { color: currentTheme.textSecondary }]}>
                                        {formatDisplayDate(articleData.date)}
                                    </Text>
                                )}
                            </View>

                             {/* Article Image - Use NEW TweetModal logic/state/UI */}
                             {articleData.image_url && (
                                <View style={styles.imageWrapper}>
                                    {/* A. Show Loading Indicator */}
                                    {isImageLoading && (
                                        <View style={[styles.imagePlaceholder, { aspectRatio: 16/9, backgroundColor: currentTheme.placeholder }]}>
                                            <ActivityIndicator style={styles.imageLoadingIndicator} size="small" color={currentTheme.accent} />
                                        </View>
                                    )}

                                    {/* B. Show Error state */}
                                    {!isImageLoading && imageError && (
                                        <View style={[styles.imagePlaceholder, { aspectRatio: 16/9, backgroundColor: currentTheme.placeholder }]}>
                                            {/* Using cloud-offline icon like TweetModal example */}
                                            <Icon name="cloud-offline-outline" size={40} color={currentTheme.destructive} />
                                            <Text style={[styles.imageErrorText, { color: currentTheme.textSecondary }]}>Image failed</Text>
                                        </View>
                                    )}

                                    {/* C. Render Image */}
                                    {!isImageLoading && !imageError && imageAspectRatio && (
                                        <Image
                                            source={{ uri: articleData.image_url }}
                                            // Apply dynamic aspect ratio from NEW state
                                            style={[styles.articleImage, { aspectRatio: imageAspectRatio }]}
                                            // Use cover resizeMode like TweetModal
                                            resizeMode="cover"
                                            // Use NEW simple error handler
                                            onError={handleImageComponentError}
                                            accessible={true}
                                            accessibilityLabel="Article image"
                                        />
                                    )}
                                </View>
                             )}
                             {/* --- End Article Image --- */}


                            {/* Article Description */}
                            {articleData.short_description && (
                                <Text style={[styles.descriptionText, { color: currentTheme.textPrimary }]}>
                                    {articleData.short_description}
                                </Text>
                            )}

                            {/* Read Full Article Link */}
                            {articleData.link && (
                                <TouchableOpacity
                                    style={styles.viewFullArticleButton}
                                    onPress={() => handleLinkPress(articleData.link)} // Original handler
                                >
                                    <Icon name="open-outline" size={16} color={currentTheme.accent} style={{marginRight: 5}}/>
                                    <Text style={[styles.viewFullArticleButtonText, { color: currentTheme.accent }]}>
                                        Read Full Article
                                    </Text>
                                </TouchableOpacity>
                            )}

                             {/* Action Buttons (Keep Redesign Structure/Style) */}
                            <View style={[styles.actionsContainer, { borderTopColor: currentTheme.borderColor }]}>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={handleSave} // Original handler
                                    disabled={isSaving || isSharing} // Use redesign states for disabling
                                >
                                    {isSaving ? ( // Use redesign state for spinner
                                        <ActivityIndicator size="small" color={currentTheme.accent} />
                                    ) : (
                                        <Icon name="bookmark-outline" size={24} color={currentTheme.accent} />
                                    )}
                                    <Text style={[styles.actionButtonText, { color: currentTheme.accent }]}>Save</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleShare(articleData.id)} // Original handler
                                    disabled={isSaving || isSharing} // Use redesign states
                                >
                                     {isSharing ? ( // Use redesign state
                                        <ActivityIndicator size="small" color={currentTheme.accent} />
                                    ) : (
                                        <Icon name="share-outline" size={24} color={currentTheme.accent} />
                                    )}
                                    <Text style={[styles.actionButtonText, { color: currentTheme.accent }]}>Share</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* AI Depth Explanation (Keep Redesign Structure/Style) */}
                        <View style={[styles.aiContainer, { borderTopColor: currentTheme.borderColor }]}>
                             <Text style={[styles.sectionHeader, { color: currentTheme.textPrimary }]}>
                                AI Explanation
                            </Text>
                            {/* Use redesign state for spinner */}
                            {isExplanationLoading ? (
                                <ActivityIndicator size="small" color={currentTheme.accent} style={{marginTop: 10}} />
                            ) : explanation ? ( // Use original state name
                                <Text style={[styles.aiExplanationText, { color: currentTheme.textSecondary }]}>
                                    {explanation}
                                </Text>
                            ) : (
                                <Text style={[styles.noDataText, { color: currentTheme.textTertiary }]}>
                                    No explanation available.
                                </Text>
                            )}
                        </View>

                        {/* Comment Section (Keep Redesign Structure/Style) */}
                        <View style={[styles.commentsContainer, { borderTopColor: currentTheme.borderColor }]}>
                            <Text style={[styles.sectionHeader, { color: currentTheme.textPrimary }]}>
                                Comments ({allComments.length})
                            </Text>

                            {/* Comment Input (Keep Redesign Structure/Style) */}
                            <View style={[styles.commentInputRow, { borderBottomColor: currentTheme.borderColor }]}>
                                {/* Current User PFP */}
                                {currentUserPfp ? ( // Use original state name
                                    <Image source={{ uri: currentUserPfp }} style={styles.inputAvatarImage} />
                                ) : (
                                     <View style={[styles.inputAvatarPlaceholder, { backgroundColor: currentTheme.placeholder }]}>
                                        <Icon name="person" size={18} color={currentTheme.textSecondary} />
                                    </View>
                                )}
                                <TextInput
                                    style={[
                                    styles.commentInput,
                                    {
                                        backgroundColor: currentTheme.inputBackground,
                                        color: currentTheme.textPrimary,
                                        borderColor: currentTheme.borderColor,
                                    },
                                    ]}
                                    placeholder="Add a comment..."
                                    placeholderTextColor={currentTheme.textSecondary}
                                    value={comment} // Original state name
                                    onChangeText={setComment} // Original state setter
                                    multiline
                                    editable={!isPostingComment} // Use redesign state for disabling
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.postButton,
                                        // Use redesign state for disabling/styling
                                        { backgroundColor: (isPostingComment || comment.trim().length === 0) ? currentTheme.textTertiary : currentTheme.accent }
                                    ]}
                                    onPress={() => postComment(comment)} // Original handler
                                    disabled={isPostingComment || comment.trim().length === 0} // Use redesign state
                                >
                                    {/* Use redesign state for spinner */}
                                    {isPostingComment ? (
                                        <ActivityIndicator size="small" color={currentTheme.accentContrast} />
                                    ) : (
                                        <Icon name="arrow-up-outline" size={20} color={currentTheme.accentContrast} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Comments List (Keep Redesign Structure/Style) */}
                             {/* Use redesign state for spinner */}
                            {isCommentsLoading ? (
                                 <ActivityIndicator size="small" color={currentTheme.accent} style={{marginTop: 20}}/>
                            ) : (
                                <FlatList
                                    data={allComments} // Original state name
                                    renderItem={renderCommentCard} // Use redesigned card render
                                    keyExtractor={(item, index) => item.comment_id?.toString() || `comment-${index}`}
                                    scrollEnabled={false}
                                    ListEmptyComponent={
                                        <Text style={[styles.noDataText, { color: currentTheme.textTertiary }]}>
                                        Be the first to comment!
                                        </Text>
                                    }
                                />
                            )}
                        </View>
                    </ScrollView>
                ) : (
                     // Show message if articleData is null and not loading (e.g., fetch failed)
                     !isArticleLoading && (
                        <View style={styles.fullScreenLoader}>
                             <Icon name="alert-circle-outline" size={50} color={currentTheme.destructive}/>
                             <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
                                Could not load article details.
                            </Text>
                        </View>
                     )
                )}
            </KeyboardAvoidingView>

             {/* In-App Message Display (Keep from Redesign) */}
             <InAppMessage
                visible={messageVisible}
                message={messageText}
                type={messageType}
                onClose={() => setMessageVisible(false)}
            />
        </View>
    </Modal>
  );
};

export default ArticleModal;

// ------------------------------------------------------
// STYLES (Keep Redesigned Styles - Ensure Image Styles Match TweetModal Intent)
// ------------------------------------------------------
const styles = StyleSheet.create({
  modalContainer: {
      flex: 1,
      // backgroundColor set inline
  },
  modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 15,
      paddingTop: Platform.OS === 'ios' ? 10 : 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      // borderBottomColor set inline
  },
  headerSpacer: {
      width: 40,
  },
  modalTitle: {
      fontSize: fontSizes.header,
      fontWeight: '600',
      textAlign: 'center',
      flex: 1,
  },
  closeButton: {
      padding: 5,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  fullScreenLoader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 0,
    paddingBottom: 60,
  },
  loadingText: {
    fontSize: fontSizes.medium,
    textAlign: 'center',
    marginTop: 15,
    // color set inline
  },
  // --- Article Content ---
  articleContentContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      marginBottom: 12,
  },
  headline: {
      fontSize: fontSizes.xlarge,
      fontWeight: 'bold',
      marginBottom: 8,
  },
  subInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      flexWrap: 'wrap',
  },
  subInfoText: {
      fontSize: fontSizes.base,
      // color set inline
  },
  subInfoSeparator: {
      marginHorizontal: 4,
      fontSize: fontSizes.base,
      // color set inline
  },
  // --- Image Styles (TweetModal Style) ---
  imageWrapper: { // Wrapper for margin, background, rounding
      width: '100%',
      marginVertical: 12,
      overflow: 'hidden',
      borderRadius: 8, // Consistent rounding
      // backgroundColor applied inline for placeholder state
  },
  imagePlaceholder: { // Used for Loading and Error states within the wrapper
      width: '100%',
      // aspectRatio is set inline (default 16/9 for placeholders)
      justifyContent: 'center',
      alignItems: 'center',
      // backgroundColor applied inline
  },
  imageLoadingIndicator: {
      // Centered by imagePlaceholder styles
  },
  imageErrorText: {
      marginTop: 8,
      fontSize: fontSizes.small,
      // color set inline
  },
  articleImage: { // Style for the actual Image component
      width: '100%',
      height: undefined, // Height controlled by aspectRatio state
      // aspectRatio set inline from NEW state
      // resizeMode: 'cover' is set inline now
  },
  // --- End Image Styles ---
  descriptionText: {
      fontSize: fontSizes.medium,
      lineHeight: fontSizes.medium * 1.5,
      marginVertical: 8,
  },
  viewFullArticleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingVertical: 6,
  },
  viewFullArticleButtonText: {
      fontSize: fontSizes.base,
      fontWeight: '500',
      // color set inline
  },
  actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 12,
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      // borderTopColor set inline
  },
  actionButton: {
      flexDirection: 'column',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      gap: 4,
  },
  actionButtonText: {
      fontSize: fontSizes.small,
      fontWeight: '500',
       // color set inline
  },
  // --- AI Explanation ---
  aiContainer: {
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      // borderTopColor set inline
  },
  sectionHeader: {
      fontSize: fontSizes.large,
      fontWeight: '600',
      marginBottom: 12,
      // color set inline
  },
  aiExplanationText: {
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.5,
     // color set inline
  },
  // --- Comments ---
  commentsContainer: {
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      // borderTopColor set inline
  },
  commentInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      marginVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingBottom: 12,
      gap: 10,
      // borderBottomColor set inline
  },
   inputAvatarImage: {
      width: 36,
      height: 36,
      borderRadius: 18,
  },
  inputAvatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
       // backgroundColor set inline
  },
  commentInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: fontSizes.base,
    maxHeight: 100,
     // backgroundColor, color, borderColor set inline
  },
  postButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
     // backgroundColor set inline
  },
  noDataText: {
      fontSize: fontSizes.base,
      textAlign: 'center',
      marginTop: 20,
      marginBottom: 10,
       // color set inline
  },
  // --- Comment Card (Keep Redesigned Style) ---
  commentCard: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor set inline
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
     // backgroundColor set inline
  },
  commentInfo: {
    marginLeft: 10,
    flex: 1,
  },
  commentUsername: {
    fontSize: fontSizes.base,
    fontWeight: '600',
     // color set inline
  },
  commentDate: {
    fontSize: fontSizes.small,
    marginTop: 1,
     // color set inline
  },
  commentText: {
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.4,
    marginLeft: 42,
     // color set inline
  },
});
