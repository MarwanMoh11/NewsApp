// components/TweetModal.tsx
import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  // Alert, // Replaced by InAppMessage
  ScrollView,
  Linking,
  Platform,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
  Modal,
  Keyboard, // Import Keyboard
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext';
import PublicProfileModal from '../app/ProfileModal';
import { useRouter } from 'expo-router';
import InAppMessage from '../components/ui/InAppMessage'; // Assuming path

// --- Configuration ---
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const { width, height } = Dimensions.get('window');

// --- Responsive Sizing ---
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
  xlarge: getResponsiveSize(20),
  header: getResponsiveSize(17),
};

// --- Helper Hooks ---
// Simple hook to know if keyboard is open
const useKeyboardVisible = () => {
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    return isKeyboardVisible;
};


// ----------------- CommentCard Component (Improved Styling) -----------------
interface CommentCardProps {
  comment: {
    username: string;
    created_at: string; // Keep original format for potential parsing
    content: string;
  };
  profilePictureUrl?: string | null;
  isDarkTheme: boolean; // Pass theme explicitly
  colors: any; // Pass color theme object
  onUserPress: (username: string) => void; // <--- Add this prop
}

const CommentCard: React.FC<CommentCardProps> = React.memo(({ comment, profilePictureUrl, isDarkTheme, colors, onUserPress  }) => {

  // Use relative time formatting for comments too
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
    } catch {
        return 'Invalid Date';
    }
  };



  return (
      <View style={[styles.commentCard, { borderBottomColor: colors.borderColor }]}>
        {/* --- Wrap header in TouchableOpacity --- */}
        <TouchableOpacity
          style={styles.commentHeaderTouchable} // Use a style if needed, or just use View directly
          onPress={() => onUserPress(comment.username)} // Call the handler on press
          // Optionally disable if it's the current user - check happens in handler
          // disabled={comment.username === loggedInUsername} // Cannot do this check here easily
        >
          <View style={styles.commentHeaderContent}> {/* Added inner View for layout */}
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
        </TouchableOpacity>
        {/* --- End Touchable Header --- */}

        <Text style={[styles.commentText, { color: colors.textPrimary }]}>
          {comment.content}
        </Text>
      </View>
    );
  });


// ----------------- TweetModal Props -----------------
interface TweetModalProps {
  visible: boolean;
  onClose: () => void;
  tweetLink: string | null;
}

// ----------------- TweetModal Component -----------------
const TweetModal: React.FC<TweetModalProps> = ({ visible, onClose, tweetLink }) => {
  const { userToken, isDarkTheme } = useContext(UserContext);
  const router = useRouter();

  // --- State ---
  const [tweetData, setTweetData] = useState<any>(null);
  const [allComments, setAllComments] = useState<any[]>([]);
  const [username, setUsername] = useState(''); // Current user's username
  const [currentUserPfp, setCurrentUserPfp] = useState<string | null>(null); // *** State for current user PFP ***
  const [profilePictures, setProfilePictures] = useState<{ [key: string]: string | null }>({}); // Commenter PFPs
  const [tweetAuthorPfp, setTweetAuthorPfp] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null); // State for aspect ratio

   // *** ADD STATE FOR PROFILE MODAL ***
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
    const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);
    // *** END ADD STATE ***


  // Loading States
  const [isTweetLoading, setIsTweetLoading] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false); // For the main tweet image
  const [imageError, setImageError] = useState(false);

  // In-App Message State
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');
  const [isSaved, setIsSaved] = useState(false);
  const [isCheckingSaveStatus, setIsCheckingSaveStatus] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const isKeyboardVisible = useKeyboardVisible();

  // --- Theming ---
   const themes = {
    light: {
      background: '#F8F9FA',
      cardBackground: '#FFFFFF', // Will be used less, maybe for input bg
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
      textTertiary: '#9CA3AF',
      accent: '#6366F1',
      accentContrast: '#FFFFFF',
      destructive: '#EF4444',
      success: '#10B981',
      info: '#3B82F6',
      borderColor: '#E5E7EB', // Use for separators
      placeholder: '#D1D5DB',
      inputBackground: '#FFFFFF', // Input background distinct from main bg
    },
        dark: {
              background: '#0A0A0A',         // Matched Index dark background
              cardBackground: '#1A1A1A',     // Matched Index dark card background
              textPrimary: '#EAEAEA',       // Matched Index dark text
              textSecondary: '#A0A0A0',     // Matched Index dark textSecondary
              textTertiary: '#6B7280',     // Kept distinct tertiary text color
              accent: '#9067C6',           // Matched Index dark accent
              accentContrast: '#FFFFFF',     // Matched Index buttonText
              destructive: '#FF6B6B',       // Matched Index error color
              success: '#34D399',           // Kept distinct success color
              info: '#60A5FA',             // Kept distinct info color
              borderColor: '#2C2C2E',       // Matched Index dark border
              placeholder: '#2C2C2E',       // Adjusted placeholder background
              inputBackground: '#1A1A1A',   // Use card background for input consistency
            },
  };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;

  // --- Helper Functions ---
    const handleInitiateClose = () => {
        console.log("[TweetModal] Close initiated by user. Hiding in-app message first.");
        setMessageVisible(false); // Immediately hide the in-app message
        setMessageText('');
        setMessageType('info');

        onClose(); // Call the original onClose prop to tell the parent to close the modal
    };

  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
  }, []);

  // --- Navigation Handler ---
    // --- Navigation Handler (MODIFIED) ---
        const handleNavigateToProfile = useCallback((tappedUsername: string) => {
            // Optional: Check if it's the current user's own profile
            if (tappedUsername === username) {
                 console.log("[TweetModal] Tapped on own username. Opening profile modal.");
                 // Decide if you want to allow viewing own profile this way
                 // If not, you could show a message or do nothing:
                 // showInAppMessage("This is you!", "info");
                 // return;
            }

            if (tappedUsername) {
                console.log(`[TweetModal] Opening profile modal for: ${tappedUsername}`);
                setSelectedProfileUsername(tappedUsername); // Set the username to view
                setIsProfileModalVisible(true);           // Set the profile modal to visible
                // --- REMOVE NAVIGATION LOGIC ---
                // onClose(); // Don't close the TweetModal
                // setTimeout(() => {
                //     router.push(`/profile/${tappedUsername}`);
                // }, 100);
            } else {
                 console.log("[TweetModal] Invalid username tapped.");
            }
        // Update dependencies: remove router, onClose. Keep username if using the self-check.
        }, [username, /* showInAppMessage (if used for self-tap) */]);

  // --- Interaction Tracking ---
    const trackInteraction = useCallback((itemId: string | number, itemType: 'tweet' | 'article' | 'bluesky' | 'unknown', interactionType: string) => {
      // Don't track if not logged in (username state might be 'Guest' or empty initially)
      if (!username || username === 'Guest' || !userToken) {
          // console.log("Interaction tracking skipped: User not logged in or username not set.");
          return;
      }

      const finalItemId = String(itemId); // Ensure itemId is a string

      console.log(`Tracking Interaction (TweetModal): User=<span class="math-inline">\{username\}, Type\=</span>{interactionType}, ItemType=<span class="math-inline">\{itemType\}, ItemID\=</span>{finalItemId}`);

      const payload = {
        username: username, // Use username state from this component
        itemId: finalItemId,
        itemType: itemType,
        interactionType: interactionType,
        // region: currentUserRegion // If you fetch/have region state in this modal, add it here
      };

      // Fire-and-forget
      fetch(`${domaindynamo}/track-interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(response => {
          if (!response.ok) {
              response.text().then(text => console.warn(`Interaction tracking failed: ${response.status}`, text));
          }
      })
      .catch(error => {
        console.warn("Network error tracking interaction:", error);
      });

    // Dependencies: username (to know who), userToken (check login), domaindynamo
    }, [username, userToken, domaindynamo]); // Add other state vars if used in payload (like region)

  const formatStat = (num?: number): string => {
      num = num || 0;
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
  };

  // --- Effects ---
  useEffect(() => {
    // Reset states when modal becomes hidden or tweetLink changes
    if (!visible || (tweetLink && tweetData?.Tweet_Link !== tweetLink)) {
      console.log('[TweetModal] Resetting state.');
      setImageError(false);
      setIsImageLoading(false); // Reset image loading
      setImageAspectRatio(null); // Reset aspect ratio
      setTweetData(null);
      setAllComments([]);
      setExplanation(null);
      setIsTweetLoading(false);
      setIsCommentsLoading(false);
      setIsExplanationLoading(false);
      setIsSaving(false);
      setIsSharing(false);
      setIsPostingComment(false);
      setImageError(false);
      setIsImageLoading(false);
      setTweetAuthorPfp(null);
      setCurrentUserPfp(null); // Reset current user PFP
      setProfilePictures({});
      setComment('');
      setMessageVisible(false);
      setMessageText('');
      setMessageType('info');
      setIsSaved(false);
      setIsCheckingSaveStatus(false);
    }

    // Fetch data when modal becomes visible with a valid link and token
    if (visible && userToken && tweetLink && !tweetData) {
       console.log('[TweetModal] Visible with link, fetching data...');
      fetchUsername(); // Fetch current user's details (will also fetch their PFP)
      getTweetByLink(tweetLink); // Fetch the main tweet
    }
  }, [visible, userToken, tweetLink, tweetData]); // Added tweetData to dependencies for reset condition

      // *** NEW Effect to get image dimensions ***
      useEffect(() => {
        // Only run if there's a Media_URL in the tweetData
        if (tweetData?.Media_URL) {
          let isMounted = true; // Flag to prevent state updates on unmounted component
          console.log('[TweetModal] Media URL found, fetching image size:', tweetData.Media_URL);

          // Set loading states before fetching
          setIsImageLoading(true);
          setImageError(false);
          setImageAspectRatio(null);

          // Fetch image dimensions
          Image.getSize(
            tweetData.Media_URL,
            (width, height) => {
              // Check if component is still mounted and dimensions are valid
              if (isMounted) {
                if (width > 0 && height > 0) {
                  console.log('[TweetModal] Image size received:', width, height);
                  // Calculate and set aspect ratio
                  setImageAspectRatio(width / height);
                } else {
                  console.warn('[TweetModal] Invalid image dimensions received:', width, height);
                  setImageError(true); // Treat invalid dimensions as an error
                }
                setIsImageLoading(false); // Loading finished (success or invalid dimensions)
              }
            },
            (error) => {
              // Handle fetching errors
              if (isMounted) {
                console.error('[TweetModal] Failed to get image size:', error);
                setImageError(true);
                setIsImageLoading(false); // Loading finished (error)
              }
            }
          );

          // Cleanup function to run when component unmounts or dependency changes
          return () => {
            console.log('[TweetModal] Image size effect cleanup.');
            isMounted = false;
          };
        } else {
          // If no Media_URL, ensure image states are reset
          setIsImageLoading(false);
          setImageError(false);
          setImageAspectRatio(null);
        }
        // This effect depends on the Media_URL changing
      }, [tweetData?.Media_URL]);

  // Fetch comments, explanation, and author PFP after tweetData is loaded
    // Fetch comments, explanation, author PFP, and SAVE STATUS after tweetData is loaded
    useEffect(() => {
        if (tweetData?.Tweet_Link) {
            console.log('[TweetModal] tweetData loaded, fetching comments, explanation, author PFP, and save status.');
            fetchComments(tweetData.Tweet_Link);
            generateExplanation(tweetData.Tweet_Link);
            checkIfTweetIsSaved(tweetData.Tweet_Link); // <--- ADD THIS LINE
            if (tweetData.Username) {
                fetchProfilePicture(tweetData.Username, true); // Fetch tweet author PFP
            }
        }
        if (tweetData?.Media_URL) {
            setIsImageLoading(true); // Start image loading state
            setImageError(false); // Reset image error state
        }
    }, [tweetData]); // Run when tweetData changes

  // --- Fetching Logic (Preserved Backend Interaction) ---
  const fetchUsername = async () => {
    // Keep original logic
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
        // *** Fetch current user's PFP after getting username ***
        await fetchProfilePicture(data.username, false, true); // Fetch for current user
      } else {
        setUsername('Guest');
        setCurrentUserPfp(null); // Ensure null if guest
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('Guest');
      setCurrentUserPfp(null); // Ensure null on error
    }
  };

  // Modified fetchProfilePicture to handle current user PFP state
  const fetchProfilePicture = async (uname: string, isTweetAuthor: boolean = false, isCurrentUser: boolean = false) => {
    if (!uname) return;
     // Avoid refetching if already exists (optional optimization)
    if (!isTweetAuthor && !isCurrentUser && profilePictures[uname] !== undefined) return;
    if (isTweetAuthor && tweetAuthorPfp !== null) return;
    if (isCurrentUser && currentUserPfp !== null) return;

    try {
      const response = await fetch(
        `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`
      );
      const data = await response.json();
      const pfp = (response.ok && data.status === 'Success' && data.profile_picture) ? data.profile_picture : null;

      if (isCurrentUser) {
          setCurrentUserPfp(pfp); // *** Set current user PFP state ***
      } else if (isTweetAuthor) {
        setTweetAuthorPfp(pfp);
      } else {
        setProfilePictures((prev) => ({ ...prev, [uname]: pfp }));
      }
    } catch (error) {
      console.error(`Error fetching profile picture for ${uname}:`, error);
       if (isCurrentUser) setCurrentUserPfp(null);
       else if (isTweetAuthor) setTweetAuthorPfp(null);
       else setProfilePictures((prev) => ({ ...prev, [uname]: null }));
    }
  };

  const getTweetByLink = async (link: string) => {
     // Keep original logic, wrap with loading state
    setIsTweetLoading(true);
    try {
      const response = await fetch(`${domaindynamo}/get-tweet-by-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link }),
      });
      const data = await response.json();

      if (response.ok && data.status === 'Tweet found') {
        setTweetData(data.data);
      } else {
        showInAppMessage(data.message || 'Tweet not found.', 'error');
        setTweetData(null); // Ensure data is cleared on error
        // onClose(); // Optionally close modal if tweet isn't found
      }
    } catch (err: any) {
      console.error('Error fetching tweet by link:', err);
      showInAppMessage(`Error fetching tweet: ${err.message || 'Network error'}`, 'error');
       setTweetData(null);
       // onClose(); // Optionally close modal on error
    } finally {
        setIsTweetLoading(false);
    }
  };

    const checkIfTweetIsSaved = async (link: string) => {
        if (!userToken || !link) return;
        setIsCheckingSaveStatus(true);
        try {
            // NOTE: This assumes you have a backend endpoint at `/is-tweet-saved`
            // that accepts a token and tweet_link and returns { status: 'Success', isSaved: boolean }
            const response = await fetch(`${domaindynamo}/is-tweet-saved`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: userToken, tweet_link: link }),
            });
            const data = await response.json();
            if (response.ok && data.status === 'Success') {
                setIsSaved(data.isSaved);
            } else {
                setIsSaved(false); // Default to not saved if check fails
                console.warn('Could not check save status:', data.message || 'Request failed');
            }
        } catch (error) {
            setIsSaved(false);
            console.error('Error checking save status:', error);
        } finally {
            setIsCheckingSaveStatus(false);
        }
    };

  const fetchComments = async (link: string) => {
    // Keep original logic, wrap with loading state
    if (!userToken || !link) return;
    setIsCommentsLoading(true);
    setAllComments([]); // Clear previous comments
    try {
      const response = await fetch(`${domaindynamo}/get_comments_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: userToken, // Assuming token is needed to view comments
          tweet_link: link,
        }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success' && Array.isArray(data.data)) {
        setAllComments(data.data);
        // Fetch PFPs for commenters (only if there are comments)
        if (data.data.length > 0) {
            const usernames = data.data.map((c: any) => c.username);
            fetchCommentersProfilePictures(usernames);
        }
      } else {
        // Don't show error if simply no comments found
        if (data.status !== 'No comments found') {
             showInAppMessage(data.message || 'Could not load comments.', 'error');
        }
        setAllComments([]);
      }
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      showInAppMessage(`Error loading comments: ${error.message || 'Network error'}`, 'error');
      setAllComments([]);
    } finally {
        setIsCommentsLoading(false);
    }
  };

  const fetchCommentersProfilePictures = async (usernames: string[]) => {
     // Keep original logic (maybe optimize slightly)
    const uniqueUsernames = [...new Set(usernames)].filter(uname => uname && profilePictures[uname] === undefined); // Only fetch new ones
    if (uniqueUsernames.length === 0) return;

    const fetchPromises = uniqueUsernames.map(async (uname) => {
        // Don't refetch current user or tweet author if already known
        if (uname === username && currentUserPfp !== null) return { [uname]: currentUserPfp };
        if (uname === tweetData?.Username && tweetAuthorPfp !== null) return { [uname]: tweetAuthorPfp };

        try {
            const resp = await fetch(
                `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`
            );
            const userData = await resp.json();
            const pfp = (resp.ok && userData.status === 'Success' && userData.profile_picture) ? userData.profile_picture : null;
            return { [uname]: pfp };
        } catch (error) {
            console.error(`Error fetching profile picture for ${uname}:`, error);
            return { [uname]: null };
        }
    });

    const results = await Promise.all(fetchPromises);
    const newProfilePics = results.reduce((acc, current) => ({ ...acc, ...current }), {});
    setProfilePictures((prev) => ({ ...prev, ...newProfilePics }));
  };

  // --- Image Handling (Simplified) ---
    const handleImageComponentError = useCallback(() => {
        console.log("[TweetModal] Image component onError triggered:", tweetData?.Media_URL);
        // Ensure error state is set if getSize somehow succeeded but Image failed
        if (!imageError) {
            setImageError(true);
        }
        // Ensure loading is false
        if (isImageLoading) {
            setIsImageLoading(false);
        }
    }, [tweetData?.Media_URL, imageError, isImageLoading]);



  // --- Explanation Logic (Preserved Backend Interaction) ---
  interface ExplainTweetResponse {
    status: string;
    explanation?: string;
    message?: string;
  }
  const generateExplanation = async (link: string) => {
    // Keep original logic, wrap with loading state
    setIsExplanationLoading(true);
    setExplanation(null); // Clear previous
    try {
      const requestBody = JSON.stringify({ tweetlink: link });
      const response = await fetch(`${domaindynamo}/explain_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      const responseBody = await response.text(); // Get text first

      let responseData: ExplainTweetResponse | null = null;
      try {
        responseData = JSON.parse(responseBody);
      } catch (parseError) {
        console.error('Failed to parse explanation JSON response:', parseError, responseBody);
         setExplanation(null);
        return;
      }

      if (response.ok && responseData?.status === 'Success') {
        setExplanation(responseData.explanation?.trim() || null);
      } else {
        console.warn("Failed to get explanation:", responseData?.message || response.statusText);
        setExplanation(null);
      }
    } catch (networkError: any) {
      console.error('Network error fetching explanation:', networkError);
      showInAppMessage(`Could not get explanation: ${networkError.message || 'Network error'}`, 'error');
      setExplanation(null);
    } finally {
      setIsExplanationLoading(false);
    }
  };

  // --- Action Handlers (Preserved Backend Interaction, Added Loading/Feedback) ---
  const handleShare = async (tweetLink: string | undefined) => {
    if (!tweetLink) return;
    if (!userToken) {
      showInAppMessage('Login required to share.', 'info');
      return;
    }
    setIsSharing(true);
    try {
      // Keep original fetch logic
      const response = await fetch(`${domaindynamo}/share_tweets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, tweet_link: tweetLink }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success') {
        showInAppMessage('Tweet shared successfully!', 'success');
        trackInteraction(tweetLink, 'tweet', 'share'); // Track the 'share' interaction
      } else {
         showInAppMessage(data.message || 'Unable to share tweet.', 'error');
      }
    } catch (error: any) {
      console.error('Error sharing tweet', error);
      showInAppMessage(`Error sharing tweet: ${error.message || 'Network error'}`, 'error');
    } finally {
        setIsSharing(false);
    }
  };

    const handleToggleSave = async (tweetLink: string | undefined) => {
        if (!tweetLink) return;
        if (!userToken) {
            showInAppMessage('Login required to save.', 'info');
            return;
        }
        setIsSaving(true);

        // Determine endpoint and messages based on current save state
        const endpoint = isSaved ? `${domaindynamo}/unsave-tweet` : `${domaindynamo}/save-tweets`;
        const successMessage = isSaved ? 'Tweet unsaved' : 'Tweet saved!';
        const interaction = isSaved ? 'unsave' : 'save';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: userToken, tweet_link: tweetLink }),
            });
            const data = await response.json();

            if (response.ok && data.status === 'Success') {
                showInAppMessage(successMessage, 'success');
                setIsSaved(!isSaved); // Toggle the saved state
                trackInteraction(tweetLink, 'tweet', interaction); // Track the interaction
            } else {
                const errorMessage = isSaved ? 'Could not unsave tweet.' : 'Could not save tweet.';
                showInAppMessage(data.message || errorMessage, 'error');
            }
        } catch (error: any) {
            const errorMessage = isSaved ? 'Error unsaving tweet' : 'Error saving tweet';
            console.error(errorMessage, error);
            showInAppMessage(`${errorMessage}: ${error.message || 'Network error'}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

  const postComment = async (content: string) => {
     // Keep original logic, wrap with loading/feedback
    if (!userToken || !tweetData?.Tweet_Link) {
      showInAppMessage('Login required to comment.', 'info');
      return;
    }
    const trimmedContent = content.trim();
    if (trimmedContent === '') {
      showInAppMessage('Comment cannot be empty.', 'error');
      return;
    }
    setIsPostingComment(true);
    Keyboard.dismiss(); // Dismiss keyboard on post attempt
    try {
      const response = await fetch(`${domaindynamo}/comment_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username, // Use fetched username
          tweet_link: tweetData.Tweet_Link,
          content: trimmedContent,
          parent_comment_id: null, // Assuming top-level comments for now
        }),
      });
      const responseData = await response.json();

      if (response.ok && responseData.status === 'Success') {
        showInAppMessage('Comment posted!', 'success');
        setComment(''); // Clear input
        fetchComments(tweetData.Tweet_Link); // Refresh comments
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
      const pfpUrl = profilePictures[item.username];
      return (
        <CommentCard
          comment={item}
          profilePictureUrl={pfpUrl}
          isDarkTheme={isDarkTheme}
          colors={currentTheme}
          onUserPress={handleNavigateToProfile} // <--- Pass the navigation handler
        />
      );
    };

  // --- Main Render ---
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleInitiateClose}
      transparent={false}
    >
        {/* Add a container with theme background */}
        <View style={[styles.modalContainer, { backgroundColor: currentTheme.background }]}>
            {/* Custom Header */}
            <View style={[styles.modalHeader, { borderBottomColor: currentTheme.borderColor }]}>
                <View style={styles.headerSpacer} />{/* Left Spacer */}
                <Text style={[styles.modalTitle, { color: currentTheme.textPrimary }]}>Tweet/BlueSky Details</Text>
                  <TouchableOpacity onPress={handleInitiateClose} style={styles.closeButton}>
                                    <Icon name="close-outline" size={28} color={currentTheme.accent} />
                  </TouchableOpacity>
            </View>

            {/* Content Area */}
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} // Padding behavior for iOS
                keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0} // Adjust offset if header is translucent or overlaps
            >
                {isTweetLoading ? (
                    <View style={styles.fullScreenLoader}>
                        <ActivityIndicator size="large" color={currentTheme.accent} />
                    </View>
                ) : tweetData ? (
                    <ScrollView
                        ref={scrollViewRef}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* --- Redesigned Tweet Display (Not a card anymore) --- */}
                        <View style={styles.tweetContentContainer}>
                             {/* User Info Row */}
                                             {/* User Info Row (Avatar Removed) */}
                                             <View style={styles.userInfoRow}>
                                                {/* Removed Image/Placeholder for tweetAuthorPfp */}
                                                {/* Username and Timestamp Column now takes full width */}
                                                <View style={styles.usernameTimeColumn}>
                                                    <Text style={[styles.username, { color: currentTheme.textPrimary }]} numberOfLines={1}>
                                                        {tweetData.Username || 'Unknown User'}
                                                    </Text>
                                                    <Text style={[styles.timestamp, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                                                        {/* Using toLocaleString for more detail, adjust if needed */}
                                                        {tweetData.Created_At ? new Date(tweetData.Created_At).toLocaleString() : ''}
                                                    </Text>
                                                </View>
                                             </View>



                                          {/* --- Tweet Media (UPDATED LOGIC) --- */}
                                          {/* Only attempt to render if there's a Media_URL */}
                                          {tweetData?.Media_URL && (
                                            // Use the wrapper style for margin and potential rounding
                                            <View style={styles.imageWrapper}>
                                                {/* A. Show Loading Indicator (while getSize runs) */}
                                                {isImageLoading && (
                                                    <View style={[styles.imagePlaceholder, { aspectRatio: 16/9, backgroundColor: currentTheme.placeholder }]}>
                                                        <ActivityIndicator style={styles.imageLoadingIndicator} size="small" color={currentTheme.accent} />
                                                    </View>
                                                )}

                                                {/* B. Show Error state (if getSize failed or Image onError) */}
                                                {/* Render only if not loading AND there is an error */}
                                                {!isImageLoading && imageError && (
                                                    <View style={[styles.imagePlaceholder, { aspectRatio: 16/9, backgroundColor: currentTheme.placeholder }]}>
                                                        <Icon name="cloud-offline-outline" size={40} color={currentTheme.destructive} />
                                                        <Text style={[styles.imageErrorText, { color: currentTheme.textSecondary }]}>Image failed</Text>
                                                    </View>
                                                )}

                                                {/* C. Render Image (if getSize succeeded and no error) */}
                                                {/* Render only if not loading AND no error AND aspect ratio is calculated */}
                                                {!isImageLoading && !imageError && imageAspectRatio && (
                                                    <Image
                                                        source={{ uri: tweetData.Media_URL }}
                                                        // Apply dynamic aspect ratio using the state variable
                                                        style={[styles.tweetImage, { aspectRatio: imageAspectRatio }]}
                                                        // Use cover like TweetCard for better filling
                                                        resizeMode="cover"
                                                        // Still use onError as a fallback for the Image component itself
                                                        onError={handleImageComponentError}
                                                        accessible={true}
                                                        accessibilityLabel="Tweet image"
                                                    />
                                                )}
                                            </View>
                                          )}
                                          {/* --- End Tweet Media --- */}
                                           {/* Tweet Text */}
                                       <Text style={[styles.tweetText, { color: currentTheme.textPrimary }]}>
                                          {tweetData.Tweet}
                                               </Text>

                            {/* Full Tweet Link */}
                            {tweetData.Tweet_Link && (
                                <TouchableOpacity
                                    style={styles.viewFullTweetButton}
                                    onPress={() => Linking.openURL(tweetData.Tweet_Link)}
                                >
                                    <Icon name="open-outline" size={16} color={currentTheme.accent} style={{marginRight: 5}}/>
                                    <Text style={[styles.viewFullTweetButtonText, { color: currentTheme.accent }]}>
                                        View on X / BlueSky
                                    </Text>
                                </TouchableOpacity>
                            )}

                             {/* Tweet Stats */}
                            <View style={[styles.statsContainer, { borderTopColor: currentTheme.borderColor }]}>
                                <View style={styles.statItem}>
                                    <Text style={[styles.statNumber, { color: currentTheme.textPrimary }]}>{formatStat(tweetData.Retweets)}</Text>
                                    <Text style={[styles.statLabel, { color: currentTheme.textSecondary }]}>Retweets</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={[styles.statNumber, { color: currentTheme.textPrimary }]}>{formatStat(tweetData.Favorites)}</Text>
                                    <Text style={[styles.statLabel, { color: currentTheme.textSecondary }]}>Likes</Text>
                                </View>
                                {/* Add other stats if available */}
                            </View>

                             {/* Action Buttons */}
                            <View style={[styles.actionsContainer, { borderTopColor: currentTheme.borderColor }]}>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleToggleSave(tweetData.Tweet_Link)}
                                    disabled={isSaving || isSharing || isCheckingSaveStatus}
                                >
                                    {isSaving || isCheckingSaveStatus ? (
                                        <ActivityIndicator size="small" color={currentTheme.accent} />
                                    ) : (
                                        <Icon name={isSaved ? "bookmark" : "bookmark-outline"} size={24} color={currentTheme.accent} />
                                    )}
                                    <Text style={[styles.actionButtonText, { color: currentTheme.accent }]}>
                                        {isSaved ? "Saved" : "Save"}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleShare(tweetData.Tweet_Link)}
                                    disabled={isSaving || isSharing}
                                >
                                     {isSharing ? (
                                        <ActivityIndicator size="small" color={currentTheme.accent} />
                                    ) : (
                                        <Icon name="share-outline" size={24} color={currentTheme.accent} />
                                    )}
                                    <Text style={[styles.actionButtonText, { color: currentTheme.accent }]}>Share</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* AI Depth Explanation */}
                        <View style={[styles.aiContainer, { borderTopColor: currentTheme.borderColor }]}>
                             <Text style={[styles.sectionHeader, { color: currentTheme.textPrimary }]}>
                                AI Explanation
                            </Text>
                            {isExplanationLoading ? (
                                <ActivityIndicator size="small" color={currentTheme.accent} style={{marginTop: 10}} />
                            ) : explanation ? (
                                <Text style={[styles.aiExplanationText, { color: currentTheme.textSecondary }]}>
                                    {explanation}
                                </Text>
                            ) : (
                                <Text style={[styles.noDataText, { color: currentTheme.textTertiary }]}>
                                    No explanation available for this tweet.
                                </Text>
                            )}
                        </View>

                        {/* Comment Section */}
                        <View style={[styles.commentsContainer, { borderTopColor: currentTheme.borderColor }]}>
                            <Text style={[styles.sectionHeader, { color: currentTheme.textPrimary }]}>
                                Comments ({allComments.length})
                            </Text>

                            {/* Comment Input */}
                            <View style={[styles.commentInputRow, { borderBottomColor: currentTheme.borderColor }]}>
                                {/* Current User PFP */}
                                {currentUserPfp ? (
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
                                    value={comment}
                                    onChangeText={setComment}
                                    multiline
                                    editable={!isPostingComment} // Disable while posting
                                />
                                <TouchableOpacity
                                    style={[styles.postButton,
                                        { backgroundColor: (isPostingComment || comment.trim().length === 0) ? currentTheme.textTertiary : currentTheme.accent } // Dim if disabled
                                    ]}
                                    onPress={() => postComment(comment)}
                                    disabled={isPostingComment || comment.trim().length === 0} // Disable if posting or empty
                                >
                                    {isPostingComment ? (
                                        <ActivityIndicator size="small" color={currentTheme.accentContrast} />
                                    ) : (
                                        <Icon name="arrow-up-outline" size={20} color={currentTheme.accentContrast} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Comments List */}
                            {isCommentsLoading ? (
                                 <ActivityIndicator size="small" color={currentTheme.accent} style={{marginTop: 20}}/>
                            ) : (
                                <FlatList
                                    data={allComments}
                                    renderItem={renderCommentCard}
                                    keyExtractor={(item, index) => item.comment_id?.toString() || `comment-${index}`} // Use comment_id if available
                                    scrollEnabled={false} // Disable scrolling as it's inside ScrollView
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
                     // Show message if tweetData is null and not loading (e.g., fetch failed)
                     !isTweetLoading && (
                        <View style={styles.fullScreenLoader}>
                             <Icon name="alert-circle-outline" size={50} color={currentTheme.destructive}/>
                             <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
                                Could not load tweet details.
                            </Text>
                        </View>
                     )
                )}
            </KeyboardAvoidingView>

             {/* In-App Message Display */}
             <InAppMessage
                visible={messageVisible}
                message={messageText}
                type={messageType}
                onClose={() => setMessageVisible(false)}
            />

            <PublicProfileModal
                            visible={isProfileModalVisible}
                            onClose={() => {
                                setIsProfileModalVisible(false); // Function to hide the profile modal
                                setSelectedProfileUsername(null); // Clear the selected username
                            }}
                            targetUsername={selectedProfileUsername} // Pass the username from state
                        />
        </View>
    </Modal>
  );
};

export default TweetModal;

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  modalContainer: {
      flex: 1,
      // backgroundColor set inline
  },
  modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between', // Keep space-between
      paddingHorizontal: 15,
      paddingTop: Platform.OS === 'ios' ? 10 : 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      // borderBottomColor set inline
  },
  headerSpacer: { // Keep spacer for centering title
      width: 40, // Adjust width to match button size if needed
  },
  modalTitle: {
      fontSize: fontSizes.header,
      fontWeight: '600',
      textAlign: 'center',
      flex: 1, // Allow title to take remaining space
  },
  closeButton: { // Replaces doneButton styles
      padding: 5, // Add padding for easier touch target
      width: 40, // Fixed width for the button area
      height: 40, // Fixed height
      justifyContent: 'center',
      alignItems: 'center',
  },
  // Removed doneButtonText style
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
  tweetContentContainer: {
      // Keep paddingHorizontal: 16,
      paddingHorizontal: 16,
      paddingBottom: 16,
      marginBottom: 12,
  },
   userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
   avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor set inline
  },
  usernameTimeColumn: {
      flex: 1,
      justifyContent: 'center',
  },
  username: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    // color set inline
  },
  timestamp: {
    fontSize: fontSizes.base,
    marginTop: 2,
    // color set inline
  },
  tweetText: {
    fontSize: fontSizes.medium,
    lineHeight: fontSizes.medium * 1.5,
    marginBottom: 16, // Keep margin below text
     // color set inline
  },
  // --- Image Styles (No Container) ---
  tweetImage: {
      width: '100%', // Take full width of the wrapper
      height: undefined, // Height is determined by aspectRatio applied inline
      // aspectRatio is set dynamically inline
      // Removed maxHeight and alignSelf from previous attempts
    },
  imageLoadingIndicator: { // Style for the loading indicator shown before image loads
      marginVertical: 20, // Add some space
      alignSelf: 'center',
  },
  imageErrorPlaceholder: { // Style for the error view if image fails
      width: '100%',
      // height: 200, // You might want a fixed height or aspect ratio for the error placeholder
      aspectRatio: 16/9, // Or match the default image aspect ratio
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 12, // Match image margin
      // backgroundColor: currentTheme.placeholder, // Optional background
      borderRadius: 8, // Optional rounding
  },
  imageErrorText: {
      marginTop: 8,
      fontSize: fontSizes.small,
      // color set inline
  },
  imageWrapper: { // Optional wrapper if needed for margin/background
        width: '100%',
        marginVertical: 12, // Apply margin here
        // backgroundColor: currentTheme.placeholder, // Optional subtle background
        overflow: 'hidden', // Clip image if you add borderRadius
        borderRadius: 8, // Optional: Add rounding to the image/placeholder area
    },
  // --- End Image Styles ---
  viewFullTweetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingVertical: 6,
  },
  viewFullTweetButtonText: {
      fontSize: fontSizes.base,
      fontWeight: '500',
      // color set inline
  },
  statsContainer: {
      flexDirection: 'row',
      paddingVertical: 12,
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 24,
      // borderTopColor set inline
  },
  statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
  },
  statNumber: {
      fontSize: fontSizes.base,
      fontWeight: '600',
      // color set inline
  },
  statLabel: {
      fontSize: fontSizes.base,
      // color set inline
  },
  actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 12,
      marginTop: 12,
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
    paddingVertical: 10,
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
  imagePlaceholder: { // Used for both Loading and Error states
        width: '100%',
        // aspectRatio is set inline (default 16/9 for placeholders)
        justifyContent: 'center',
        alignItems: 'center',
        // backgroundColor set inline via currentTheme
        // Removed marginVertical (handled by imageWrapper)
        // borderRadius applied to imageWrapper
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
  commentHeaderContent: { // Inner view to hold the actual content layout
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6, // Keep existing margin from original commentHeader
      },
  commentText: {
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.4,
    marginLeft: 42,
     // color set inline
  },
    commentHeaderTouchable: {
        alignSelf: 'flex-start',
    },

});
