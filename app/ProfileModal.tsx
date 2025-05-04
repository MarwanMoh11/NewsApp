// PublicProfileModal.tsx (Corrected Again)
import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
  Suspense
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust path if needed
import MasterCard from '../components/MasterCard'; // Adjust path if needed
import InAppMessage from '../components/ui/InAppMessage'; // Adjust path if needed

// --- Lazy Imports ---
const ArticleModal = React.lazy(() => import('./articlepage')); // Adjust path
const TweetModal = React.lazy(() => import('./tweetpage'));   // Adjust path

// --- Configuration & Setup ---
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const { width } = Dimensions.get('window');
const REPOST_PAGE_LIMIT = 10;

// --- Interfaces ---
interface UserProfileData { username: string; fullName: string | null; profilePictureUrl: string | null; bio: string | null; }
interface RepostItem { reposted_at: string; content_type: 'tweet' | 'article'; original_content: any; }
type FriendStatus = 'friends' | 'request_sent' | 'request_received' | 'not_friends' | 'loading' | 'self' | 'error' | 'logged_out';

// --- Defaults & Sizing / Helpers ---
const defaultPFP = 'https://via.placeholder.com/90/cccccc/969696?text=User';
const getResponsiveSize = (baseSize: number): number => { if (width < 350) return baseSize * 0.9; if (width < 400) return baseSize; return baseSize * 1.1; };
const fontSizes = { xsmall:getResponsiveSize(10),small:getResponsiveSize(12),base:getResponsiveSize(14),medium:getResponsiveSize(16),large:getResponsiveSize(18),xlarge:getResponsiveSize(22),button:getResponsiveSize(14),};
const formatTimestamp = (timestamp: string): string => { try{if(!timestamp)return'';const d=new Date(timestamp);if(isNaN(d.getTime()))return'';const n=new Date();const s=Math.round((n.getTime()-d.getTime())/1000);if(s<60)return`${s}s ago`;const m=Math.round(s/60);if(m<60)return`${m}m ago`;const h=Math.round(m/60);if(h<24)return`${h}h ago`;const dy=Math.round(h/24);if(dy<7)return`${dy}d ago`;return d.toLocaleDateString();}catch(e){console.error("Error formatting timestamp:",timestamp,e);return'';} };


// ================== Public Profile Modal Component ==================
interface PublicProfileModalProps {
  visible: boolean;
  onClose: () => void;
  targetUsername: string | null;
}

const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  visible,
  onClose,
  targetUsername,
}) => {
  // --- Hooks & Context ---
  const { userToken, isDarkTheme } = useContext(UserContext);
  const flatListRef = useRef<FlatList>(null);
  const hasFetchedInitialReposts = useRef(false); // Ref to track initial repost fetch

  // --- State ---
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [targetUserReposts, setTargetUserReposts] = useState<RepostItem[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingReposts, setLoadingReposts] = useState(false);
  const [repostsPage, setRepostsPage] = useState(1);
  const [repostsHasMore, setRepostsHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null); // Profile/general error
  const [repostError, setRepostError] = useState<string|null>(null); // Repost specific error
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('loading');
  const [actionLoading, setActionLoading] = useState(false); // Friend action loading
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');
  const [articleModalVisible, setArticleModalVisible] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [tweetModalVisible, setTweetModalVisible] = useState(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);

  // --- Theming ---
   const themes = {
       light: { background: '#FFFFFF', cardBackground: '#F8F9FA', textPrimary: '#1C1C1E', textSecondary: '#6B7280', textTertiary: '#AEAEB2', accent: '#007AFF', accentContrast: '#FFFFFF', destructive: '#FF3B30', success: '#34C759', info: '#5AC8FA', borderColor: '#E5E7EB', placeholder: '#EFEFF4', segmentInactive: '#F2F2F7', buttonPrimaryBG: '#007AFF', buttonPrimaryText: '#FFFFFF', buttonSecondaryBG: '#E5E7EB', buttonSecondaryText: '#1C1C1E', buttonDestructiveBG: '#FFE5E5', buttonDestructiveText: '#FF3B30', buttonPendingBG: '#E5E7EB', buttonPendingText: '#6B7280', modalBackdrop: 'rgba(0, 0, 0, 0.4)', modalBackground: '#FFFFFF', inputBackground: '#F2F2F7', reposterText: '#6B7280', closeButton: '#6B7280',
       },
       dark: { background: '#000000', cardBackground: '#1C1C1E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', textTertiary: '#636366', accent: '#0A84FF', accentContrast: '#FFFFFF', destructive: '#FF453A', success: '#30D158', info: '#64D2FF', borderColor: '#38383A', placeholder: '#2C2C2E', segmentInactive: '#1C1C1E', buttonPrimaryBG: '#0A84FF', buttonPrimaryText: '#FFFFFF', buttonSecondaryBG: '#2C2C2E', buttonSecondaryText: '#FFFFFF', buttonDestructiveBG: '#5C1F1F', buttonDestructiveText: '#FF453A', buttonPendingBG: '#2C2C2E', buttonPendingText: '#8E8E93', modalBackdrop: 'rgba(0, 0, 0, 0.6)', modalBackground: '#1C1C1E', inputBackground: '#1C1C1E', reposterText: '#8E8E93', closeButton: '#8E8E93',
       },
   };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;
  const styles = getStyles(currentTheme);

  // --- Helper: Show Message ---
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
       setMessageText(text); setMessageType(type); setMessageVisible(true);
  }, []);

  // --- Data Fetching Callbacks (Stable dependencies) ---
  const fetchLoggedInUsername = useCallback(async (): Promise<string | null> => {
      if (!userToken) return null;
      try {
          const r = await fetch(`${domaindynamo}/get-username`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:userToken})});
          const d = await r.json();
          return(r.ok && d.status==='Success' && d.username) ? d.username : null;
        } catch (e) { console.error("[fetchLoggedInUsername] Error:", e); return null; }
  }, [userToken]);

  const checkFriendStatus = useCallback(async (loggedInUser: string | null, targetUser: string | undefined) => {
      const target = targetUser;
      if (!userToken || !loggedInUser || !target || loggedInUser === target) {
          setFriendStatus(loggedInUser === target ? 'self' : 'logged_out'); return;
      }
      console.log(`[checkFriendStatus] Checking: ${loggedInUser} vs ${target}`);
      setFriendStatus('loading');
      try {
          const r = await fetch(`${domaindynamo}/check_friend_status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:userToken,other_username:target})});
          const d = await r.json();
          if(r.ok && d.status){
              const validStatuses:FriendStatus[] = ['friends','request_sent','request_received','not_friends'];
              setFriendStatus(validStatuses.includes(d.status) ? d.status : 'error');
            } else { setFriendStatus('error'); }
        } catch (err) { console.error("[checkFriendStatus] Error:", err); setFriendStatus('error'); }
  }, [userToken]);

  const fetchProfileData = useCallback(async (usernameToFetch: string | undefined) => {
      const target = usernameToFetch;
      if (!target) { setError("User not specified."); setLoadingProfile(false); return; }
      console.log(`[fetchProfileData] Fetching profile for: ${target}.`);
      setLoadingProfile(true); setError(null);
      try {
          const [pfpRes, nameRes, bioRes] = await Promise.all([
              fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(target)}`),
              fetch(`${domaindynamo}/get-full-name?username=${encodeURIComponent(target)}`),
              fetch(`${domaindynamo}/get-user-bio?username=${encodeURIComponent(target)}`),
          ]);
          if (!pfpRes.ok && pfpRes.status === 404) throw new Error(`User '${target}' not found.`);
          const responses = [pfpRes, nameRes, bioRes];
          const errorsToThrow: string[] = []; for(let i=0;i<responses.length;i++){const r=responses[i];if(!r.ok&&!((i===1||i===2)&&r.status===404)){let msg=`HTTP ${r.status}`;try{const ed=await r.json();msg=ed.message||ed.error||msg;}catch(e){}errorsToThrow.push(`Profile Fetch ${i} fail: ${msg}`);}}if(errorsToThrow.length>0){throw new Error(errorsToThrow.join('; '));}
          const jsonDataPromises = responses.map(async(res, i)=>{if(!res.ok){if(i===1&&res.status===404)return{status:'Success',full_name:null};if(i===2&&res.status===404)return{status:'Success',bio:null};throw new Error(`HTTP ${res.status} for ${i}`);}try{return await res.json();}catch(e){if(res.status===200&&(i===0||i===1)){if(i===0)return{status:'Success',profile_picture:null};if(i===1)return{status:'Success',full_name:null};}return{status:'Error',message:`Invalid JSON ${i}`};}});
          const [pfpData, nameData, bioData] = await Promise.all(jsonDataPromises);
          const profileResult: UserProfileData = { username: target, profilePictureUrl: (pfpData?.status === 'Success' && pfpData.profile_picture) ? pfpData.profile_picture : null, fullName: (nameData?.status === 'Success' && nameData.full_name) ? nameData.full_name : null, bio: (bioData?.status === 'Success') ? bioData.bio : null };
          setProfileData(profileResult); // Set state upon successful fetch
      } catch (err: any) { setError(err.message || "Failed to load profile details."); setProfileData(null); setFriendStatus('error');
      } finally { setLoadingProfile(false); }
  }, []); // Stable: No dependencies needed

  const fetchTargetUserReposts = useCallback(async (usernameToFetch: string | undefined, pageToFetch: number, isRefreshing = false) => {
      const target = usernameToFetch;
      if (!target) return;
      if (loadingReposts || (!isRefreshing && !repostsHasMore)) {
          if(loadingReposts && !repostsHasMore) setLoadingReposts(false);
          return;
      }
      console.log(`[fetchTargetUserReposts] Fetching page ${pageToFetch} for ${target}. Refresh: ${isRefreshing}`);
      setLoadingReposts(true); setRepostError(null);
      try {
          const response = await fetch(`${domaindynamo}/get_reposts_by_user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: target, page: pageToFetch, limit: REPOST_PAGE_LIMIT }), });
          if (!response.ok && response.status !== 404) throw new Error(`HTTP error ${response.status}`);
          const data = await response.json();
          if (data.status === 'Success' && Array.isArray(data.data)) {
              const newReposts = data.data as RepostItem[];
              setTargetUserReposts(prev => {
                  const combined = isRefreshing ? newReposts : [...prev, ...newReposts];
                  const uniqueMap = new Map();
                  combined.forEach(item => { const id = item.original_content?.id || item.original_content?.Tweet_Link; if (id) uniqueMap.set(id, item); });
                  return Array.from(uniqueMap.values());
              });
              setRepostsPage(pageToFetch);
              setRepostsHasMore(newReposts.length >= REPOST_PAGE_LIMIT);
              // Mark initial fetch as done if it was a refresh/initial load
              if (isRefreshing || pageToFetch === 1) {
                   hasFetchedInitialReposts.current = true;
              }
          } else if (response.status === 404 || (data.status === 'Success' && data.data.length === 0)) {
              setRepostsHasMore(false);
              if (isRefreshing) setTargetUserReposts([]);
              if (isRefreshing || pageToFetch === 1) { // Also mark as done if first page returns none
                  hasFetchedInitialReposts.current = true;
              }
          } else { throw new Error(data.message || `Failed fetch reposts`); }
      } catch (e: any) {
          console.error(`[fetchTargetUserReposts] Error for ${target} page ${pageToFetch}:`, e);
          setRepostError(e.message || `Failed to load reposts.`);
          if (isRefreshing || pageToFetch === 1) { // Mark as done even on error for initial fetch
                hasFetchedInitialReposts.current = true;
            }
      } finally { setLoadingReposts(false); }
  }, [repostsHasMore, loadingReposts]); // Stable: Only depends on checks, not setters/data


  // --- UseEffect Hooks (Revised Structure) ---
  useEffect(() => {
      fetchLoggedInUsername().then(setLoggedInUsername);
  }, [fetchLoggedInUsername]);

  useEffect(() => {
    if (visible && targetUsername) {
        console.log("[Modal Effect 2] Fetching Profile Data for", targetUsername);
        // Reset all relevant states when username changes or modal becomes visible
        setProfileData(null);
        setTargetUserReposts([]);
        setRepostsPage(1);
        setRepostsHasMore(true);
        setFriendStatus('loading');
        setError(null);
        setRepostError(null);
        setLoadingProfile(true);
        setLoadingReposts(false); // Important: reset loading state
        hasFetchedInitialReposts.current = false; // Reset initial fetch tracker
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });

        fetchProfileData(targetUsername); // Initiate profile fetch
    } else if (!visible) {
        // Optional cleanup when modal hides
        // Could reset state here if desired, but Effect 2 handles reset on reopen
    }
  }, [visible, targetUsername, fetchProfileData]); // fetchProfileData is stable

  useEffect(() => {
    if (visible && profileData && profileData.username === targetUsername && loggedInUsername !== undefined) {
        console.log("[Modal Effect 3] Checking Friend Status");
        checkFriendStatus(loggedInUsername, targetUsername);
    }
  }, [visible, profileData, targetUsername, loggedInUsername, checkFriendStatus]); // checkFriendStatus is stable

  // Effect 4: Fetch Initial Reposts *once* after profile is successfully loaded for the target user
  useEffect(() => {
    if (visible &&
        profileData &&                            // Profile data exists
        profileData.username === targetUsername &&  // It's for the correct user
        !loadingProfile &&                        // Profile loading is finished
        !hasFetchedInitialReposts.current &&      // Initial reposts haven't been fetched yet
        !loadingReposts                           // Reposts aren't currently loading
    ) {
        console.log("[Modal Effect 4] Conditions met, fetching initial reposts.");
        fetchTargetUserReposts(targetUsername, 1, true); // isRefreshing = true also sets the ref
    }
  }, [
      visible,
      profileData, // Need to react to profileData becoming available
      targetUsername,
      loadingProfile, // Need to know when profile loading finishes
      loadingReposts, // Need to avoid fetching if already loading
      fetchTargetUserReposts // Stable callback
      // hasFetchedInitialReposts.current is checked internally, not needed as dep
  ]);


  // --- Action Handlers ---
  const onRefresh = useCallback(async () => {
      if (!targetUsername || refreshing) return;
      console.log(`[onRefresh] Refreshing profile for ${targetUsername}`);
      setRefreshing(true);
      setError(null); setRepostError(null); setFriendStatus('loading');
      hasFetchedInitialReposts.current = false; // Reset initial fetch tracker for refresh

      const currentLoggedInUser = await fetchLoggedInUsername();
      setLoggedInUsername(currentLoggedInUser);

      await fetchProfileData(targetUsername); // Fetch profile; Effects 3 & 4 will trigger after this

      setRefreshing(false);
  }, [targetUsername, refreshing, fetchLoggedInUsername, fetchProfileData]);

  const loadMoreReposts = useCallback(() => {
      if (!loadingReposts && repostsHasMore && targetUsername) {
          const nextPage = repostsPage + 1;
          console.log(`>>> Requesting loadMore Reposts for ${targetUsername}, page ${nextPage}`);
          fetchTargetUserReposts(targetUsername, nextPage, false);
      }
  }, [loadingReposts, repostsHasMore, targetUsername, repostsPage, fetchTargetUserReposts]);


 // --- Friend Action Handlers (Stable - No Changes) ---
   const handleSendRequest = useCallback(async () => {
       if (!userToken || !targetUsername || actionLoading || friendStatus !== 'not_friends') return;
       console.log(`[Friend Action] Sending request to ${targetUsername}`);
       setActionLoading(true); const previousStatus = friendStatus; setFriendStatus('request_sent');
       try { const r = await fetch(`${domaindynamo}/send_follow_request`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:userToken,username_to_request:targetUsername}) }); const d = await r.json(); if (r.ok && d.status === 'Success') { showInAppMessage(`Friend request sent`, 'success'); } else { showInAppMessage(d.message || 'Could not send request', 'error'); setFriendStatus(previousStatus); } }
       catch (err:any) { showInAppMessage(`Error: ${err.message||'Network Error'}`, 'error'); setFriendStatus(previousStatus); } finally { setActionLoading(false); }
   }, [userToken, targetUsername, actionLoading, friendStatus, showInAppMessage]);

   const handleCancelRequest = useCallback(async () => {
       if (!userToken || !targetUsername || actionLoading || friendStatus !== 'request_sent') return;
       Alert.alert("Cancel Request?", `Cancel friend request to ${targetUsername}?`, [ {text:"Keep Request", style:"cancel"}, {text:"Cancel Request", style:"destructive", onPress: async () => {
           console.log(`[Friend Action] Cancelling request to ${targetUsername}`);
           setActionLoading(true); const previousStatus = friendStatus; setFriendStatus('not_friends');
           try { const r = await fetch(`${domaindynamo}/cancel_sent_request`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:userToken,username_request_was_sent_to:targetUsername}) }); const d = await r.json(); if (r.ok && d.status === 'Success') { showInAppMessage(`Request cancelled`, 'info'); } else { showInAppMessage(d.message || 'Could not cancel request', 'error'); setFriendStatus(previousStatus); } }
           catch (err:any) { showInAppMessage(`Error: ${err.message||'Network Error'}`, 'error'); setFriendStatus(previousStatus); } finally { setActionLoading(false); }
       }}]);
   }, [userToken, targetUsername, actionLoading, friendStatus, showInAppMessage]);

   const handleRemoveFriend = useCallback(async () => {
        if (!userToken || !targetUsername || actionLoading || friendStatus !== 'friends') return;
        Alert.alert("Remove Friend?", `Remove ${targetUsername} as a friend?`, [ {text:"Cancel", style:"cancel"}, {text:"Remove", style:"destructive", onPress: async () => {
            console.log(`[Friend Action] Removing friend ${targetUsername}`);
            setActionLoading(true); const previousStatus = friendStatus; setFriendStatus('not_friends');
            try { const r = await fetch(`${domaindynamo}/remove_friend`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:userToken,username_to_remove:targetUsername}) }); const d = await r.json(); if (r.ok && d.status === 'Success') { showInAppMessage(`${targetUsername} removed`, 'info'); } else { showInAppMessage(d.message || 'Could not remove friend', 'error'); setFriendStatus(previousStatus); } }
            catch (err:any) { showInAppMessage(`Error: ${err.message||'Network Error'}`, 'error'); setFriendStatus(previousStatus); } finally { setActionLoading(false); }
        }}]);
   }, [userToken, targetUsername, actionLoading, friendStatus, showInAppMessage]);

    const handleRespondToRequest = useCallback(() => {
        if (!targetUsername) return;
        showInAppMessage("Respond to requests on your Connections page.", "info");
        onClose();
    }, [targetUsername, showInAppMessage, onClose]);


  // --- Card Press Handlers (Stable - No Changes) ---
  const handleArticlePress = useCallback((articleData: any) => {
      if(!userToken){showInAppMessage('Login required','info');return;}
      if(articleData?.id){setSelectedArticleId(String(articleData.id));setArticleModalVisible(true);}
      else{showInAppMessage('Error opening article: Missing ID.','error');console.warn("Article data missing ID:", articleData);}
  }, [userToken, showInAppMessage]);

  const handleTweetPress = useCallback((tweetData: any) => {
      if(!userToken){showInAppMessage('Login required','info');return;}
      if(tweetData?.Tweet_Link){setSelectedTweetLink(tweetData.Tweet_Link);setTweetModalVisible(true);}
      else{showInAppMessage('Error opening tweet: Missing link.','error');console.warn("Tweet data missing Link:", tweetData);}
  }, [userToken, showInAppMessage]);

  // --- Render Item for Repost List (Stable - No Changes) ---
  const renderRepostItem = useCallback(({ item }: { item: RepostItem }) => {
      if (!item || !item.original_content || !item.content_type) {
           return (<View style={styles.repostItemContainer}><Text style={[styles.placeholderText,{padding:20}]}>Content unavailable.</Text></View>);
       }
      const contentId = item.original_content.id || item.original_content.Tweet_Link;
      if (!contentId) {
           return (<View style={styles.repostItemContainer}><Text style={[styles.placeholderText,{padding:20}]}>Content identifier missing.</Text></View>);
      }
      const masterCardItem = { type: item.content_type, id: contentId, dateTime: item.original_content.Created_At || item.original_content.date || item.reposted_at, author: item.original_content.Username || item.original_content.authors || 'Unknown', text_content: item.original_content.Tweet || item.original_content.headline || '', media_url: item.original_content.Media_URL || item.original_content.image_url || null, Retweets: item.original_content.Retweets, Favorites: item.original_content.Favorites, };
      const handlePress = item.content_type === 'tweet' ? handleTweetPress : handleArticlePress;
      return (
          <View style={styles.repostItemContainer}>
              <MasterCard item={masterCardItem} onPress={() => handlePress(item.original_content)} />
          </View>
      );
   }, [handleTweetPress, handleArticlePress, styles, currentTheme]);


  // --- List Header Component (JSX Cleanup) ---
  const ListHeader = useCallback(() => {
    let buttonContent: React.ReactNode = null;
    if (profileData && friendStatus !== 'self' && friendStatus !== 'logged_out' && friendStatus !== 'error') {
        if (friendStatus === 'loading') {
            buttonContent = <ActivityIndicator size="small" color={currentTheme.textSecondary} style={styles.friendStatusLoader} />;
        } else {
            let buttonText = ''; let buttonAction = () => {}; let buttonStyle = {}; let textStyle = {}; let IconComponent: React.ReactNode | null = null;
            const isDisabled = actionLoading;
            switch (friendStatus) {
                case 'not_friends': buttonText = 'Add Friend'; buttonAction = handleSendRequest; buttonStyle = styles.buttonPrimary; textStyle = styles.buttonPrimaryText; IconComponent = <Icon name="person-add-outline" size={16} color={currentTheme.buttonPrimaryText} style={styles.buttonIcon} />; break;
                case 'request_sent': buttonText = 'Request Sent'; buttonAction = handleCancelRequest; buttonStyle = styles.buttonPending; textStyle = styles.buttonPendingText; IconComponent = <Icon name="time-outline" size={16} color={currentTheme.buttonPendingText} style={styles.buttonIcon} />; break;
                case 'request_received': buttonText = 'Respond'; buttonAction = handleRespondToRequest; buttonStyle = styles.buttonSecondary; textStyle = styles.buttonSecondaryText; IconComponent = <Icon name="mail-unread-outline" size={16} color={currentTheme.buttonSecondaryText} style={styles.buttonIcon} />; break;
                case 'friends': buttonText = 'Friends'; buttonAction = handleRemoveFriend; buttonStyle = styles.buttonSecondary; textStyle = styles.buttonSecondaryText; IconComponent = <Icon name="checkmark-outline" size={16} color={currentTheme.buttonSecondaryText} style={styles.buttonIcon} />; break;
            }
            buttonContent = (
                <TouchableOpacity style={[styles.profileActionButton, buttonStyle, isDisabled ? styles.buttonDisabled : {}]} onPress={buttonAction} disabled={isDisabled}>
                    {actionLoading
                        ? <ActivityIndicator size="small" color={(textStyle as any).color || currentTheme.textPrimary} />
                        : <>{IconComponent}<Text style={[styles.profileActionButtonText, textStyle]}>{buttonText}</Text></> // Ensure text is inside fragment or view
                    }
                </TouchableOpacity>
            );
        }
    }

    return (
        <View>
            <View style={styles.profileHeader}>
                {loadingProfile && !profileData ? (
                    <View style={styles.centeredLoadingContainer}>
                         <ActivityIndicator size="large" color={currentTheme.accent} />
                    </View>
                ) : error && !profileData && !loadingProfile ? (
                     <View style={styles.centeredErrorContainer}>
                          <Icon name="alert-circle-outline" size={50} color={currentTheme.destructive} />
                          <Text style={[styles.feedbackText, {color: currentTheme.destructive, marginTop: 15}]}>{error}</Text>
                          <TouchableOpacity style={[styles.retryButton]} onPress={() => fetchProfileData(targetUsername)}>
                                <Text style={styles.retryButtonText}>Retry Profile</Text>
                           </TouchableOpacity>
                    </View>
                ) : profileData ? (
                    <>
                        <Image source={{ uri: profileData.profilePictureUrl || defaultPFP }} style={styles.profileImageLarge} onError={(e) => console.log("PFP Error", e.nativeEvent.error)} />
                        <Text style={styles.profileFullName} numberOfLines={1}>{profileData.fullName || profileData.username}</Text>
                        {profileData.fullName && (<Text style={styles.profileUsername}>@{profileData.username}</Text>)}
                        {(profileData.bio && profileData.bio.trim() !== '') ? (
                            <Text style={styles.profileBio}>{profileData.bio}</Text>
                        ) : (
                            <Text style={[styles.profileBio, styles.profileBioPlaceholder]}>No bio yet.</Text>
                        )}
                        {/* Wrap conditional button in Fragment */}
                        {buttonContent ? <>{buttonContent}</> : null}
                    </>
                 ) : (
                     <View style={styles.centeredErrorContainer}>
                        <Text style={styles.feedbackText}>Profile unavailable.</Text>
                     </View>
                 )}
            </View>

             {profileData && (
                <View style={styles.repostsHeaderContainer}>
                    <Text style={styles.sectionTitle}>Reposts</Text>
                </View>
             )}

            {repostError && profileData && !loadingReposts && (
                <Text style={[styles.feedbackText, styles.repostErrorText]}>{repostError}</Text>
            )}
        </View>
    );
}, [
    profileData, friendStatus, actionLoading, loadingProfile, error, repostError, loadingReposts, targetUsername,
    handleSendRequest, handleCancelRequest, handleRemoveFriend, handleRespondToRequest, fetchProfileData,
    currentTheme, styles
]);


  // --- List Footer Component (Corrected Condition) ---
  const ListFooter = useCallback(() => {
    if (loadingReposts && !refreshing && repostsHasMore && targetUserReposts.length > 0) {
        return (<View style={styles.footerContainer}><ActivityIndicator style={{ marginVertical: 20 }} size="small" color={currentTheme.textSecondary} /></View>);
    }
    return <View style={styles.footerContainer} />;
   },[loadingReposts, refreshing, repostsHasMore, targetUserReposts.length, currentTheme, styles]);


  // --- List Empty Component (Stable - No Changes) ---
  const ListEmpty = useCallback(() => {
    if (profileData && !loadingProfile && !loadingReposts && targetUserReposts.length === 0 && !error && !repostError && !refreshing) {
        return (
            <View style={styles.emptyListContainer}>
                <Icon name={"newspaper-outline"} size={40} color={currentTheme.textTertiary} />
                <Text style={styles.emptyListText}>{profileData?.username || 'This user'} hasn't reposted anything yet.</Text>
            </View>
        );
    }
    return null;
   }, [loadingProfile, loadingReposts, refreshing, targetUserReposts.length, profileData, error, repostError, currentTheme, styles]);


  // --- Main Render (Corrected Close Button Position) ---
  return (
    <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
    >
        <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />

            <View style={styles.modalContent}>
                {/* Close Button - Positioned absolutely relative to modalContent */}
                <TouchableOpacity onPress={onClose} style={styles.closeButtonTouchable}>
                    <Icon name="close-circle" size={30} color={currentTheme.closeButton} />
                </TouchableOpacity>

                 {/* Safe Area for the main content (FlatList) */}
                 <SafeAreaView style={styles.safeAreaInsideModal}>
                    <FlatList
                        ref={flatListRef}
                        data={targetUserReposts}
                        renderItem={renderRepostItem}
                        keyExtractor={(item, index) => `repost-${item.content_type}-${item.original_content?.id || item.original_content?.Tweet_Link || `modal-prof-${index}`}-${item.reposted_at}`}
                        ListHeaderComponent={ListHeader}
                        ListFooterComponent={ListFooter}
                        ListEmptyComponent={ListEmpty}
                        onEndReached={loadMoreReposts}
                        onEndReachedThreshold={0.8}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={currentTheme.accent}
                                colors={[currentTheme.accent]}
                            />
                        }
                        contentContainerStyle={styles.listContentContainer}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        extraData={{ friendStatus, actionLoading, profileData, loadingReposts, error, repostError, loadingProfile, repostsHasMore }}
                        style={styles.flatListStyle} // Use style for flex: 1
                    />
                </SafeAreaView>
             </View>

             {/* Nested Modals */}
             <Suspense fallback={<View style={[StyleSheet.absoluteFill, styles.centerScreen, {backgroundColor: currentTheme.modalBackdrop}]}><ActivityIndicator color={currentTheme.accent} size="large" /></View>}>
                 <ArticleModal visible={articleModalVisible} onClose={() => setArticleModalVisible(false)} articleId={selectedArticleId} />
                 <TweetModal visible={tweetModalVisible} onClose={() => setTweetModalVisible(false)} tweetLink={selectedTweetLink} />
             </Suspense>

            {/* In-App Message */}
            <InAppMessage visible={messageVisible} message={messageText} type={messageType} onClose={() => setMessageVisible(false)} />

        </View>
    </Modal>
  );
};


// --- Styles ---
const getStyles = (currentTheme: any) => StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: currentTheme.modalBackdrop,
    },
    modalContent: {
        height: '100%',
        width: '100%',
        backgroundColor: currentTheme.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    closeButtonTouchable: {
        position: 'absolute',
        top: 5,
        right: 15,
        zIndex: 10,
        padding: 5,
    },
    safeAreaInsideModal: {
        flex: 1,
        backgroundColor: 'transparent',
        marginTop: 45, // Adjust as needed to clear the close button
    },
    flatListStyle: {
        flex: 1, // Ensure FlatList takes up available space in SafeAreaView
    },
    listContentContainer: {
        paddingBottom: 50,
        flexGrow: 1,
    },
    profileHeader: {
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 25,
        paddingHorizontal: 20,
        backgroundColor: currentTheme.background,
    },
    centeredLoadingContainer: { // Centering placeholder for profile header loading
        height: 200, // Match approximate header height
        justifyContent: 'center',
        alignItems: 'center',
    },
    centeredErrorContainer: { // Centering placeholder for profile header error
        height: 200, // Match approximate header height
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    profileImageLarge: { width: 100, height: 100, borderRadius: 50, marginBottom: 15, backgroundColor: currentTheme.placeholder, borderWidth: 1, borderColor: currentTheme.borderColor, },
    profileFullName: { fontSize: fontSizes.xlarge, fontWeight: '700', color: currentTheme.textPrimary, textAlign: 'center', marginBottom: 2, },
    profileUsername: { fontSize: fontSizes.medium, marginBottom: 15, color: currentTheme.textSecondary, textAlign: 'center', },
    profileBio: { fontSize: fontSizes.base, textAlign: 'center', lineHeight: fontSizes.base * 1.5, color: currentTheme.textSecondary, marginBottom: 25, paddingHorizontal: 15, },
    profileBioPlaceholder: { color: currentTheme.textTertiary, fontStyle: 'italic', },
    profileActionButton: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, justifyContent: 'center', alignItems: 'center', minHeight: 40, minWidth: 150, gap: 8, },
    buttonIcon: { marginRight: -4, },
    buttonPrimary: { backgroundColor: currentTheme.buttonPrimaryBG, },
    buttonSecondary: { backgroundColor: currentTheme.buttonSecondaryBG, borderWidth: StyleSheet.hairlineWidth, borderColor: currentTheme.borderColor, },
    buttonPending: { backgroundColor: currentTheme.buttonPendingBG, borderWidth: StyleSheet.hairlineWidth, borderColor: currentTheme.borderColor, },
    buttonDestructive: { backgroundColor: currentTheme.buttonDestructiveBG, },
    profileActionButtonText: { fontSize: fontSizes.button, fontWeight: '600', },
    buttonPrimaryText: { color: currentTheme.buttonPrimaryText, },
    buttonSecondaryText: { color: currentTheme.buttonSecondaryText, },
    buttonPendingText: { color: currentTheme.buttonPendingText, },
    buttonDestructiveText: { color: currentTheme.buttonDestructiveText, },
    buttonDisabled: { opacity: 0.6, },
    friendStatusLoader: { marginTop: 10, marginBottom: 15, height: 40 },
    retryButton: { marginTop: 15, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 15, borderWidth: 1, borderColor: currentTheme.accent },
    retryButtonText: { color: currentTheme.accent, fontWeight: '600' },
    repostsHeaderContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        backgroundColor: currentTheme.background,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: currentTheme.borderColor,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: currentTheme.borderColor,
     },
    sectionTitle: { fontSize: fontSizes.large, fontWeight: '600', color: currentTheme.textPrimary, },
    repostErrorText: { // Style for repost-specific error
        paddingBottom: 10,
        color: currentTheme.destructive,
        paddingHorizontal: 20, // Match feedbackText
        fontSize: fontSizes.medium, // Match feedbackText
        fontWeight: '600', // Match feedbackText
        textAlign: 'center', // Match feedbackText
    },
    repostItemContainer: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        backgroundColor: currentTheme.background,
        // Add border if needed between items
         borderBottomWidth: StyleSheet.hairlineWidth,
         borderBottomColor: currentTheme.borderColor,
    },
    footerContainer: {
        paddingVertical: 20,
        minHeight: 50, // Ensure space even when not loading
        justifyContent:'center',
        alignItems:'center'
    },
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginTop: 30,
        minHeight: 200,
    },
    emptyListText: { textAlign: 'center', fontSize: fontSizes.base, marginTop: 15, color: currentTheme.textSecondary, lineHeight: fontSizes.base * 1.4, },
    placeholderText: { fontSize: fontSizes.base, color: currentTheme.textTertiary, fontStyle: 'italic', textAlign: 'center', },
    feedbackText: {
        fontSize: fontSizes.medium,
        fontWeight: '600',
        textAlign: 'center',
        color: currentTheme.textSecondary,
        marginTop: 10,
        paddingHorizontal: 20,
    },
    centerScreen: { justifyContent:'center', alignItems:'center' }, // For Suspense fallback
});


export default PublicProfileModal;