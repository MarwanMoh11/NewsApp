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
    Platform,
    Image,
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    SafeAreaView,
    LayoutAnimation,
    UIManager,
    TextInput,
    Keyboard,
    Modal,
    TouchableWithoutFeedback,
    ScrollView // Import ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { UserContext } from './UserContext'; // Adjust path
import MasterCard from '../components/MasterCard'; // Adjust path
import InAppMessage from '../components/ui/InAppMessage'; // Adjust path
import ConnectionsPage from './followingpage'; // Ensure path is correct
import BackButton from '../components/ui/BackButton'; // Adjust path (If needed)

// Modals (Ensure paths are correct)
const ArticleModal = React.lazy(() => import('./articlepage'));
const TweetModal = React.lazy(() => import('./tweetpage'));

// --- Setup ---
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Constants & Interfaces ---
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const { width, height: screenHeight } = Dimensions.get('window');
const REPOST_PAGE_LIMIT = 10;

interface UserProfileData {
  username: string;
  fullName: string | null;
  profilePictureUrl: string | null;
  bio: string | null;
}
interface RepostItem {
    reposted_by_username?: string;
    reposted_at: string;
    content_type: 'tweet' | 'article';
    original_content: any;
}
type RepostViewMode = 'my' | 'friends';

// --- Defaults & Sizing ---
const defaultPFP = 'https://via.placeholder.com/90/cccccc/969696?text=User';
const getResponsiveSize = (baseSize: number): number => { if (width < 350) return baseSize * 0.9; if (width < 400) return baseSize; return baseSize * 1.1; };
const fontSizes = {
    xsmall: getResponsiveSize(10),
    small: getResponsiveSize(12),
    base: getResponsiveSize(14),
    medium: getResponsiveSize(16),
    large: getResponsiveSize(18),
    xlarge: getResponsiveSize(22),
    button: getResponsiveSize(14),
};

// --- Helper: Format Timestamp ---
const formatTimestamp = (timestamp: string): string => {
    try {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return ''; // Invalid date
        const now = new Date();
        const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (Math.round(diffSeconds / 60) < 60) return `${Math.round(diffSeconds / 60)}m ago`;
        if (Math.round(diffSeconds / 3600) < 24) return `${Math.round(diffSeconds / 3600)}h ago`;
        if (Math.round(diffSeconds / 86400) < 7) return `${Math.round(diffSeconds / 86400)}d ago`;
        return date.toLocaleDateString();
    } catch (e) {
        console.error("Error formatting timestamp:", timestamp, e);
        return '';
    }
};

// --- Themes ---
const themes = {
    light: { background: '#FFFFFF', cardBackground: '#F8F9FA', textPrimary: '#1C1C1E', textSecondary: '#6B7280', textTertiary: '#AEAEB2', accent: '#007AFF', accentContrast: '#FFFFFF', destructive: '#FF3B30', success: '#34C759', info: '#5AC8FA', borderColor: '#E5E7EB', placeholder: '#EFEFF4', segmentInactive: '#F2F2F7', segmentActive: '#FFFFFF', segmentTextInactive: '#6B7280', segmentTextActive: '#007AFF', reposterText: '#6B7280', modalBackdrop: 'rgba(0, 0, 0, 0.4)', modalBackground: '#FFFFFF', inputBackground: '#F2F2F7',
    },
    dark: { background: '#000000', cardBackground: '#1C1C1E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', textTertiary: '#636366', accent: '#0A84FF', accentContrast: '#FFFFFF', destructive: '#FF453A', success: '#30D158', info: '#64D2FF', borderColor: '#38383A', placeholder: '#2C2C2E', segmentInactive: '#1C1C1E', segmentActive: '#2C2C2E', segmentTextInactive: '#8E8E93', segmentTextActive: '#0A84FF', reposterText: '#8E8E93', modalBackdrop: 'rgba(0, 0, 0, 0.6)', modalBackground: '#1C1C1E', inputBackground: '#1C1C1E',
    },
};


// ================== Profile Page Component (ScrollView Version) ==================
const ProfilePage: React.FC = () => {
  // --- Hooks & Context ---
  const router = useRouter();
  const { userToken, isDarkTheme } = useContext(UserContext);
  const scrollViewRef = useRef<ScrollView>(null); // Use ScrollView ref

  // --- State ---
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [friendCount, setFriendCount] = useState<number>(0);
  const [repostViewMode, setRepostViewMode] = useState<RepostViewMode>('my');
  const [myReposts, setMyReposts] = useState<RepostItem[]>([]);
  const [friendsReposts, setFriendsReposts] = useState<RepostItem[]>([]);
  const [loadingMyReposts, setLoadingMyReposts] = useState(false);
  const [loadingFriendsReposts, setLoadingFriendsReposts] = useState(false);
  const [myRepostsPage, setMyRepostsPage] = useState(1);
  const [friendsRepostsPage, setFriendsRepostsPage] = useState(1);
  const [myRepostsHasMore, setMyRepostsHasMore] = useState(true);
  const [friendsRepostsHasMore, setFriendsRepostsHasMore] = useState(true);
  const [showConnections, setShowConnections] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null); // General error state
  const [modalError, setModalError] = useState<string | null>(null); // Error state specifically for the modal
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');
  const [modalVisible, setModalVisible] = useState(false); // Article modal
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [tweetModalVisible, setTweetModalVisible] = useState(false); // Tweet modal
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [isBioModalVisible, setIsBioModalVisible] = useState(false); // Bio modal
  const [editingBioText, setEditingBioText] = useState(''); // Holds text being edited in modal
  const [isSavingBio, setIsSavingBio] = useState(false);

  // --- Theming ---
  const currentTheme = isDarkTheme ? themes.dark : themes.light;
  const styles = getStyles(currentTheme); // Generate styles

  // --- Helper: Show Message ---
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => { setMessageText(text); setMessageType(type); setMessageVisible(true); }, []);

  // --- Data Fetching Callbacks ---
  // These functions remain unchanged internally
  const fetchLoggedInUsername = useCallback(async (): Promise<string | null> => { if(!userToken)return null;try{const r=await fetch(`${domaindynamo}/get-username`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:userToken})});const d=await r.json();if(r.ok&&d.status==='Success'&&d.username){return d.username;}else{throw new Error(d.message||"Could not verify user");}}catch(e){console.error("[fetchLoggedInUsername] Error:",e);setLoggedInUsername(null);return null;}}, [userToken]);
  const fetchMyReposts = useCallback(async(isRefreshing=false)=>{const cP=isRefreshing?1:myRepostsPage;if(!loggedInUsername||loadingMyReposts||(!isRefreshing&&!myRepostsHasMore))return;console.log(`[fetchMyReposts] Fetching page ${cP} for ${loggedInUsername}. Refreshing: ${isRefreshing}`);setLoadingMyReposts(true);if(!isRefreshing)setError(null);try{const r=await fetch(`${domaindynamo}/get_reposts_by_user`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:loggedInUsername,page:cP,limit:REPOST_PAGE_LIMIT}),});if(!r.ok&&r.status!==404)throw new Error(`HTTP error ${r.status}`);const d=await r.json();if(d.status==='Success'&&Array.isArray(d.data)){const nR=d.data as RepostItem[];console.log(`[fetchMyReposts] Received ${nR.length} items.`);if(isRefreshing){setMyReposts(nR);setMyRepostsPage(1);setMyRepostsHasMore(nR.length>=REPOST_PAGE_LIMIT);}else{const eIds=new Set(myReposts.map(i=>i.original_content?.id||i.original_content?.Tweet_Link));const uNR=nR.filter(nr=>{const id=nr.original_content?.id||nr.original_content?.Tweet_Link;return id?!eIds.has(id):true;});console.log(`[fetchMyReposts] Adding ${uNR.length} unique items.`);setMyReposts(p=>[...p,...uNR]);setMyRepostsPage(p=>p+1);setMyRepostsHasMore(nR.length>=REPOST_PAGE_LIMIT);}}else if(r.status===404||(d.status==='Success'&&d.data.length===0)){console.log(`[fetchMyReposts] No more items found or 404.`);if(isRefreshing)setMyReposts([]);setMyRepostsHasMore(false);}else{throw new Error(d.message||"Failed to fetch your reposts");}}catch(e:any){console.error("[fetchMyReposts] Error:",e);setError(e.message||"Failed load");}finally{setLoadingMyReposts(false);}}, [loggedInUsername,myRepostsPage,myRepostsHasMore,myReposts,loadingMyReposts]);
  const fetchFriendsReposts = useCallback(async(isRefreshing=false)=>{const cP=isRefreshing?1:friendsRepostsPage;if(!userToken||loadingFriendsReposts||(!isRefreshing&&!friendsRepostsHasMore))return;console.log(`[fetchFriendsReposts] Fetching page ${cP}. Refreshing: ${isRefreshing}`);setLoadingFriendsReposts(true);if(!isRefreshing)setError(null);try{const r=await fetch(`${domaindynamo}/get_friends_reposts_feed`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:userToken,page:cP,limit:REPOST_PAGE_LIMIT}),});if(!r.ok&&r.status!==404)throw new Error(`HTTP error ${r.status}`);const d=await r.json();if(d.status==='Success'&&Array.isArray(d.data)){const nR=d.data as RepostItem[];console.log(`[fetchFriendsReposts] Received ${nR.length} items.`);if(isRefreshing){setFriendsReposts(nR);setFriendsRepostsPage(1);setFriendsRepostsHasMore(nR.length>=REPOST_PAGE_LIMIT);}else{const eIds=new Set(friendsReposts.map(i=>i.original_content?.id||i.original_content?.Tweet_Link));const uNR=nR.filter(nr=>{const id=nr.original_content?.id||nr.original_content?.Tweet_Link;return id?!eIds.has(id):true;});console.log(`[fetchFriendsReposts] Adding ${uNR.length} unique items.`);setFriendsReposts(p=>[...p,...uNR]);setFriendsRepostsPage(p=>p+1);setFriendsRepostsHasMore(nR.length>=REPOST_PAGE_LIMIT);}}else if(r.status===404||(d.status==='Success'&&d.data.length===0)){console.log(`[fetchFriendsReposts] No more items found or 404.`);if(isRefreshing)setFriendsReposts([]);setFriendsRepostsHasMore(false);}else{throw new Error(d.message||"Failed fetch");}}catch(e:any){console.error("[fetchFriendsReposts] Error:",e);setError(e.message||"Failed load");}finally{setLoadingFriendsReposts(false);}}, [userToken,friendsRepostsPage,friendsRepostsHasMore,friendsReposts,loadingFriendsReposts]);
  const fetchProfileData = useCallback(async (isRefreshing = false) => {
    console.log(`[fetchProfileData] Called. isRefreshing: ${isRefreshing}`);
    if (!userToken) { setLoadingProfile(false); setError("Login required."); return; }
    if (!isRefreshing) setLoadingProfile(true); else setRefreshing(true);
    setError(null); setModalError(null);

    let currentUser: string | null = null;
    try {
        currentUser = await fetchLoggedInUsername();
        if (!currentUser) throw new Error("Could not determine logged in user.");
        setLoggedInUsername(currentUser);

        console.log(`[fetchProfileData] Fetching profile details for ${currentUser}`);
        const [pfpRes, nameRes, bioRes, friendsRes] = await Promise.all([
            fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(currentUser)}`),
            fetch(`${domaindynamo}/get-full-name?username=${encodeURIComponent(currentUser)}`),
            fetch(`${domaindynamo}/get-user-bio?username=${encodeURIComponent(currentUser)}`),
            fetch(`${domaindynamo}/get_followed_users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ follower_username: currentUser }) }),
        ]);
        const responses = [pfpRes, nameRes, bioRes, friendsRes];
        const errorsToThrow: string[] = []; for(let i=0;i<responses.length;i++){const r=responses[i];if(!r.ok&&!((i===2||i===3)&&r.status===404)){let msg=`HTTP ${r.status}`;try{const ed=await r.json();msg=ed.message||ed.error||msg;}catch(e){}errorsToThrow.push(`Profile Fetch ${i} fail: ${msg}`);}}if(errorsToThrow.length>0){throw new Error(errorsToThrow.join('; '));}
        const jsonDataPromises = responses.map(async(res, i)=>{if(!res.ok){if(i===2&&res.status===404)return{status:'Success',bio:null};if(i===3&&res.status===404)return{status:'Success',followedUsernames:[]};return{status:'Error',message:`Unhandled non-ok ${res.status}`};} try{return await res.json();}catch(e){if(res.status===200&&(i===0||i===1)){if(i===0)return{status:'Success',profile_picture:null};if(i===1)return{status:'Success',full_name:null};}return{status:'Error',message:`Invalid JSON for fetch ${i}`};}});
        const [pfpData, nameData, bioData, friendsData] = await Promise.all(jsonDataPromises);
        const friendUsernames = (friendsData?.status==='Success'&&Array.isArray(friendsData.followedUsernames))?friendsData.followedUsernames:[];
        const fetchedBio = (bioData?.status==='Success')?bioData.bio:null;
        const fetchedPfp = (pfpData?.status==='Success'&&pfpData.profile_picture)?pfpData.profile_picture:null;
        const fetchedName = (nameData?.status==='Success'&&nameData.full_name)?nameData.full_name:null;

        const profile: UserProfileData = { username: currentUser, profilePictureUrl: fetchedPfp, fullName: fetchedName, bio: fetchedBio };
        setProfileData(profile);
        setFriendCount(friendUsernames.length);
    } catch (err: any) {
        console.error("[fetchProfileData] Error:", err); setError(err.message || "Failed to load profile.");
        setProfileData(null); setFriendCount(0); setLoggedInUsername(null);
    } finally {
         setLoadingProfile(false);
         if (isRefreshing) setRefreshing(false); // Ensure refreshing is set to false here
    }
  }, [userToken, fetchLoggedInUsername]);

  // --- useEffect Hooks ---
  // These remain unchanged
  useEffect(() => { fetchProfileData(false); }, [userToken]);
  useEffect(() => { if (!showConnections && loggedInUsername && repostViewMode === 'my' && myReposts.length === 0 && !loadingMyReposts && myRepostsHasMore) { console.log(">>> UseEffect: Triggering fetchMyReposts (initial/empty)"); fetchMyReposts(true); } }, [loggedInUsername, repostViewMode, myReposts.length, loadingMyReposts, fetchMyReposts, showConnections, myRepostsHasMore]);
  useEffect(() => { if (!showConnections && userToken && repostViewMode === 'friends' && friendsReposts.length === 0 && !loadingFriendsReposts && friendsRepostsHasMore) { console.log(">>> UseEffect: Triggering fetchFriendsReposts (initial/empty)"); fetchFriendsReposts(true); } }, [userToken, repostViewMode, friendsReposts.length, loadingFriendsReposts, fetchFriendsReposts, showConnections, friendsRepostsHasMore]);

  // --- Action Handlers ---
  const onRefresh = useCallback(async () => {
      setRefreshing(true); setError(null); setModalError(null);
      // Fetch profile first, which will set refreshing=false on completion
      await fetchProfileData(true);
      // Now fetch reposts if needed (profile fetch is done)
      if (!showConnections) {
          console.log(`[onRefresh] Profile refreshed. Current repostViewMode: ${repostViewMode}. Fetching reposts...`);
          if (repostViewMode === 'my') {
              await fetchMyReposts(true); // Refresh first page
          } else {
              await fetchFriendsReposts(true); // Refresh first page
          }
      } else {
           console.log("[onRefresh] Profile refreshed. Connections are visible, not refreshing reposts.");
      }
  }, [fetchProfileData, fetchMyReposts, fetchFriendsReposts, repostViewMode, showConnections]); // Dependencies updated

  // --- Load More Function (MANUAL TRIGGER) ---
  const handleLoadMore = useCallback(() => {
      if (showConnections) return; // Should not be visible anyway
      if (repostViewMode === 'my') {
          if (!loadingMyReposts && myRepostsHasMore) {
              console.log(">>> Manually triggered loadMoreMyReposts");
              fetchMyReposts(false); // Fetch next page
          }
      } else { // friends view
          if (!loadingFriendsReposts && friendsRepostsHasMore) {
              console.log(">>> Manually triggered loadMoreFriendsReposts");
              fetchFriendsReposts(false); // Fetch next page
          }
      }
  }, [
      showConnections, repostViewMode,
      loadingMyReposts, myRepostsHasMore, fetchMyReposts,
      loadingFriendsReposts, friendsRepostsHasMore, fetchFriendsReposts
  ]);

  const toggleConnectionsView = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const willShowConnections = !showConnections;
      setShowConnections(willShowConnections);
      // Scroll to top when toggling
      if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
      // If switching back to reposts, ensure data is loaded if it's currently empty but should have data
      if (!willShowConnections) {
           if (repostViewMode === 'my' && myReposts.length === 0 && myRepostsHasMore && !loadingMyReposts) {
               fetchMyReposts(true);
           } else if (repostViewMode === 'friends' && friendsReposts.length === 0 && friendsRepostsHasMore && !loadingFriendsReposts) {
               fetchFriendsReposts(true);
           }
      }
  }, [showConnections, scrollViewRef, repostViewMode, myReposts.length, friendsReposts.length, myRepostsHasMore, friendsRepostsHasMore, loadingMyReposts, loadingFriendsReposts, fetchMyReposts, fetchFriendsReposts]);


  // --- Bio Editing Handlers (MODAL) ---
  // Unchanged internally
  const handleEditBioPress = useCallback(() => {
      if (!profileData) return;
      console.log("Opening Bio Edit Modal");
      setEditingBioText(profileData.bio || '');
      setModalError(null);
      setIsBioModalVisible(true);
  }, [profileData]);

  const handleCancelBio = useCallback(() => {
      console.log("Closing Bio Edit Modal (Cancel)");
      setIsBioModalVisible(false);
      setEditingBioText('');
      Keyboard.dismiss();
  }, []);

  const handleSaveBio = useCallback(async () => {
      if (isSavingBio || !userToken || !profileData) return;
      Keyboard.dismiss();
      setIsSavingBio(true);
      setModalError(null);
      try {
          const bioToSave = editingBioText.trim();
          console.log(`[handleSaveBio] Saving bio via modal for ${profileData.username}: "${bioToSave}"`);
          const response = await fetch(`${domaindynamo}/set-user-bio`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: userToken, bio: bioToSave }),
          });
          const result = await response.json();
          if (response.ok && result.status === 'Success') {
               console.log('[handleSaveBio] Success.');
               setProfileData(prev => prev ? { ...prev, bio: bioToSave } : null);
               setIsBioModalVisible(false);
               setEditingBioText('');
               showInAppMessage('Bio updated!', 'success');
          } else {
               console.error('[handleSaveBio] Save failed:', result.message);
               setModalError(result.message || 'Failed to save bio.');
          }
      } catch (err: any) {
          console.error('[handleSaveBio] Fetch error:', err);
          setModalError(err.message || 'Network error saving bio.');
      } finally {
          setIsSavingBio(false);
      }
  }, [isSavingBio, userToken, profileData, editingBioText, showInAppMessage]);

  // --- Card Press Handlers ---
  // Unchanged internally
  const handleArticlePress = (articleData: any) => { if(!userToken){showInAppMessage('Login required.','info');return;}if(articleData?.id){setSelectedArticleId(String(articleData.id));setModalVisible(true);}else{showInAppMessage('Error opening article: Missing ID.','error');console.warn("Article data missing ID:", articleData);} };
  const handleTweetPress = (tweetData: any) => { if(!userToken){showInAppMessage('Login required.','info');return;}if(tweetData?.Tweet_Link){setSelectedTweetLink(tweetData.Tweet_Link);setTweetModalVisible(true);}else{showInAppMessage('Error opening tweet: Missing link.','error');console.warn("Tweet data missing Link:", tweetData);} };
  const navigateToUserProfile = (username: string) => { if(username&&username!==loggedInUsername){router.push(`/profile/${username}`);} };


  // --- Tab Switching ---
  const handleTabPress = (newMode: RepostViewMode) => {
      if (repostViewMode !== newMode) {
          console.log(`Switching tab to: ${newMode}`);
          setRepostViewMode(newMode);
          // If switching to a tab with no data yet, fetch it
          if (newMode === 'my' && myReposts.length === 0 && myRepostsHasMore && !loadingMyReposts) {
              fetchMyReposts(true);
          } else if (newMode === 'friends' && friendsReposts.length === 0 && friendsRepostsHasMore && !loadingFriendsReposts) {
              fetchFriendsReposts(true);
          }
      }
  };

  // --- Render Helper for Repost Item (used in manual map) ---
  // Needs a unique key prop when mapped
  const renderRepostItem = useCallback((item: RepostItem, index: number) => {
      if(!item||!item.original_content||!item.content_type){return(<View key={`repost-error-${index}`} style={styles.repostItemContainer}><Text style={[styles.placeholderText,{padding:20}]}>Content unavailable (index: {index}).</Text></View>);}
      const contentId=item.original_content.id||item.original_content.Tweet_Link;
      if(!contentId){return(<View key={`repost-id-error-${index}`} style={styles.repostItemContainer}><Text style={[styles.placeholderText,{padding:20}]}>Content identifier missing (index: {index}).</Text></View>);}
      // --- Key generation moved to the map function below ---

      const masterCardItem={type:item.content_type,id:contentId,dateTime:item.original_content.Created_At||item.original_content.date||item.reposted_at,author:item.original_content.Username||item.original_content.authors||'Unknown Author',text_content:item.original_content.Tweet||item.original_content.headline||'',media_url:item.original_content.Media_URL||item.original_content.image_url||null,categories:item.original_content.categories||item.original_content.category||null,region:item.original_content.Region||null,Explanation:item.original_content.Explanation||null,Retweets:item.original_content.Retweets||0,Favorites:item.original_content.Favorites||0,};
      const handlePress=item.content_type==='tweet'?handleTweetPress:handleArticlePress;

      // The wrapper View with the key is now applied in the .map() call below
      return(
        <View style={styles.repostItemWrapper}>
          {repostViewMode==='friends'&&item.reposted_by_username&&(
              <TouchableOpacity onPress={()=>navigateToUserProfile(item.reposted_by_username!)} style={styles.reposterInfoContainer} disabled={item.reposted_by_username===loggedInUsername}>
                  <Icon name="repeat-outline" size={14} color={currentTheme.reposterText} style={styles.reposterIcon}/>
                  <Text style={styles.reposterText} numberOfLines={1}> Reposted by {item.reposted_by_username===loggedInUsername?'You':item.reposted_by_username}</Text>
                  <Text style={styles.repostTimestamp}> • {formatTimestamp(item.reposted_at)}</Text>
              </TouchableOpacity>
          )}
          {repostViewMode==='my'&&(
              <View style={[styles.reposterInfoContainer,styles.myRepostTimestampContainer]}>
                  <Icon name="repeat-outline" size={14} color={currentTheme.reposterText} style={styles.reposterIcon}/>
                  <Text style={styles.reposterText}> You reposted</Text>
                  <Text style={styles.repostTimestamp}> • {formatTimestamp(item.reposted_at)}</Text>
              </View>
          )}
          <MasterCard item={masterCardItem} onPress={()=>handlePress(item.original_content)}/>
        </View>
      );
  }, [currentTheme, handleTweetPress, handleArticlePress, repostViewMode, loggedInUsername, navigateToUserProfile, styles]); // Dependencies


  // --- Loading/Error States (Initial Page Load) ---
  // These remain unchanged
  if (loadingProfile && !refreshing && !profileData) { return ( <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center'}]}><ActivityIndicator size="large" color={currentTheme.accent} /></SafeAreaView> ); }
  if (error && !profileData && !loadingProfile) { return ( <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}><Icon name="cloud-offline-outline" size={50} color={currentTheme.destructive} /><Text style={[styles.feedbackText, {color: currentTheme.destructive}]}>{error}</Text><TouchableOpacity style={[styles.retryButton]} onPress={() => fetchProfileData(false)}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></SafeAreaView> ); }
   if (!profileData && !loadingProfile && !error && !userToken) { return ( <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center'}]}><Icon name="log-in-outline" size={50} color={currentTheme.textSecondary} /><Text style={styles.feedbackText}>Login Required</Text></SafeAreaView> ); }
   // Handle case where user is logged in but profile hasn't loaded yet (or failed silently before error state set)
   if (!profileData && !loadingProfile && !error && userToken) { return ( <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center'}]}><ActivityIndicator size="large" color={currentTheme.accent} /><Text style={styles.feedbackText}>Loading User Data...</Text></SafeAreaView> ); }
   // Final fallback if profileData is somehow null after loading checks (shouldn't happen often)
   if (!profileData) { return ( <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center'}]}><Text style={styles.feedbackText}>Unable to load profile.</Text></SafeAreaView> ); }


   // --- Prepare data and loading states for the current view ---
   const currentListData = repostViewMode === 'my' ? myReposts : friendsReposts;
   const isLoadingCurrent = repostViewMode === 'my' ? loadingMyReposts : loadingFriendsReposts;
   const currentHasMore = repostViewMode === 'my' ? myRepostsHasMore : friendsRepostsHasMore;
   const isLoadingInitial = isLoadingCurrent && currentListData.length === 0;

   console.log(`--- Rendering ProfilePage (ScrollView) ---`);
   console.log(`Mode: ${repostViewMode}, ShowConnections: ${showConnections}`);
   console.log(`MyReposts Count: ${myReposts.length}, HasMore: ${myRepostsHasMore}, Loading: ${loadingMyReposts}`);
   console.log(`FriendsReposts Count: ${friendsReposts.length}, HasMore: ${friendsRepostsHasMore}, Loading: ${loadingFriendsReposts}`);
   console.log(`Profile Data Exists: ${!!profileData}, Loading Profile: ${loadingProfile}`);

  // --- Main Render ---
  return (
      <SafeAreaView style={styles.container}>
          <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContentContainer} // Use for padding etc.
              refreshControl={
                  <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={currentTheme.accent}
                      colors={[currentTheme.accent]}
                  />
              }
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
          >
              {/* Profile Header Section (Moved from ListHeader) */}
              <View style={styles.profileHeader}>
                  {/* Profile data is guaranteed to exist here due to checks above */}
                  <>
                    <Image
                        source={{ uri: profileData.profilePictureUrl || defaultPFP }}
                        style={styles.profileImageLarge}
                        onError={(e) => console.log("Failed to load profile image:", e.nativeEvent.error)}
                     />
                    <Text style={styles.profileFullName} numberOfLines={1}>{profileData.fullName || profileData.username}</Text>
                    {profileData.fullName && (<Text style={styles.profileUsername}>@{profileData.username}</Text>)}

                    {/* Bio Display Section */}
                    <View style={styles.bioContainer}>
                        <View style={styles.bioDisplayContainer}>
                             {(profileData.bio && profileData.bio.trim() !== '') ? (
                                 <Text style={styles.profileBio}>{profileData.bio}</Text>
                             ) : (
                                 <Text style={[styles.profileBio, styles.profileBioPlaceholder]}>
                                     No bio yet. Tap the pencil to add one.
                                 </Text>
                             )}
                             <TouchableOpacity onPress={handleEditBioPress} style={styles.editBioButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                 <Icon name="pencil-outline" style={styles.editBioIcon} />
                             </TouchableOpacity>
                        </View>
                    </View>

                    {/* Friends Toggle Button Area */}
                    <TouchableOpacity onPress={toggleConnectionsView} style={styles.statTouchable}>
                        <View style={styles.statContent}>
                            <Text style={styles.statNumber}>{friendCount}</Text>
                            <Text style={styles.statLabel}>Friends</Text>
                        </View>
                        <Icon name={showConnections?"chevron-up-outline":"chevron-down-outline"} size={20} color={currentTheme.textSecondary} style={styles.toggleIcon}/>
                    </TouchableOpacity>
                  </>
              </View>

              {/* Divider and Repost Toggle (Only shown if NOT showing connections) */}
              {!showConnections && (
                <View style={styles.listHeaderSeparator}>
                   <View style={styles.repostsHeaderContainer}>
                       <Text style={styles.sectionTitle}>Reposts</Text>
                       <View style={styles.repostToggleContainer}>
                           <TouchableOpacity style={[styles.repostToggleButton,repostViewMode==='my'?styles.repostToggleButtonActive:{}]} onPress={()=>handleTabPress('my')} disabled={loadingMyReposts||loadingFriendsReposts}>
                               <Text style={[styles.repostToggleButtonText,repostViewMode==='my'?styles.repostToggleButtonTextActive:{}]}>My Reposts</Text>
                           </TouchableOpacity>
                           <TouchableOpacity style={[styles.repostToggleButton,repostViewMode==='friends'?styles.repostToggleButtonActive:{}]} onPress={()=>handleTabPress('friends')} disabled={loadingMyReposts||loadingFriendsReposts}>
                               <Text style={[styles.repostToggleButtonText,repostViewMode==='friends'?styles.repostToggleButtonTextActive:{}]}>Friends</Text>
                           </TouchableOpacity>
                       </View>
                   </View>
                   {/* Display general list errors here if not loading initial and no items */}
                   {error && !modalError && !isLoadingCurrent && currentListData.length === 0 && (
                      <Text style={[styles.feedbackText, styles.errorText]}>{error}</Text>
                   )}
                </View>
              )}

              {/* Content Area: Connections or Reposts */}
              <View style={styles.contentArea}>
                  {showConnections ? (
                      <View style={styles.connectionsWrapper}>
                          {/* Ensure ConnectionsPage doesn't cause scroll issues itself */}
                          <ConnectionsPage />
                      </View>
                  ) : (
                      <>
                          {/* Initial Loading Indicator for Reposts */}
                          {isLoadingInitial && (
                              <ActivityIndicator style={{ marginTop: 50, marginBottom: 30 }} size="large" color={currentTheme.textSecondary} />
                          )}

                          {/* Repost Items (Mapped Manually) */}
                          {!isLoadingInitial && currentListData.length > 0 && (
                              currentListData.map((item, index) => {
                                  // Generate unique key here
                                  const contentId = item.original_content?.id || item.original_content?.Tweet_Link;
                                  const key = `repost-${item.content_type}-${contentId || `index-${index}`}`;
                                  // Render the item content (renderRepostItem doesn't need the key itself)
                                  return (
                                      <View key={key}>
                                          {renderRepostItem(item, index)}
                                      </View>
                                  );
                              })
                          )}

                          {/* Empty State for Reposts */}
                          {!isLoadingCurrent && currentListData.length === 0 && !error && (
                              <View style={styles.emptyListContainer}>
                                  <Icon name={repostViewMode === 'my' ? "newspaper-outline" : "people-outline"} size={40} color={currentTheme.textTertiary} />
                                  <Text style={styles.emptyListText}>
                                      {repostViewMode === 'my' ? "You haven't reposted anything yet." : "No reposts found from friends."}
                                  </Text>
                              </View>
                          )}

                          {/* Loading More Indicator (when appending) */}
                          {isLoadingCurrent && !isLoadingInitial && (
                              <View style={styles.footerContainer}>
                                  <ActivityIndicator style={{ marginVertical: 20 }} size="small" color={currentTheme.textSecondary} />
                              </View>
                          )}

                          {/* Load More Button */}
                          {!isLoadingCurrent && currentHasMore && currentListData.length > 0 && (
                              <TouchableOpacity onPress={handleLoadMore} style={styles.loadMoreButton} disabled={isLoadingCurrent}>
                                  <Text style={styles.loadMoreButtonText}>Load More</Text>
                              </TouchableOpacity>
                          )}

                           {/* Footer Padding */}
                           <View style={styles.footerPadding} />
                      </>
                  )}
              </View>

          </ScrollView>

          {/* --- Bio Edit Modal --- */}
          <Modal
              animationType="fade"
              transparent={true}
              visible={isBioModalVisible}
              onRequestClose={handleCancelBio} // Android back button
          >
              <TouchableWithoutFeedback onPress={handleCancelBio}>
                   {/* Make backdrop dismiss modal */}
                  <View style={styles.modalBackdrop}>
                      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                           {/* Prevent tap inside modal from closing it */}
                          <View style={styles.bioModalContainer}>
                              <Text style={styles.bioModalTitle}>Edit Bio</Text>
                              <TextInput
                                  style={styles.bioModalInput} // Use new modal-specific style
                                  value={editingBioText}
                                  onChangeText={setEditingBioText}
                                  placeholder="Tell us about yourself..."
                                  placeholderTextColor={currentTheme.textTertiary}
                                  multiline={true}
                                  maxLength={500}
                                  autoFocus={true} // Focus when modal opens
                                  scrollEnabled={true}
                              />
                              {/* Display modal-specific errors */}
                              {modalError && (
                                  <Text style={styles.bioModalErrorText}>{modalError}</Text>
                              )}
                              <View style={styles.bioModalActions}>
                                  <TouchableOpacity
                                      style={[styles.bioModalButton, styles.bioModalCancelButton]}
                                      onPress={handleCancelBio}
                                      disabled={isSavingBio}
                                  >
                                      <Text style={styles.bioModalButtonText}>Cancel</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                      style={[styles.bioModalButton, styles.bioModalSaveButton]}
                                      onPress={handleSaveBio}
                                      disabled={isSavingBio}
                                  >
                                      {isSavingBio ? (
                                          <ActivityIndicator size="small" color={currentTheme.accentContrast} />
                                      ) : (
                                          <Text style={[styles.bioModalButtonText, { color: currentTheme.accentContrast }]}>Save</Text>
                                      )}
                                  </TouchableOpacity>
                              </View>
                          </View>
                      </TouchableWithoutFeedback>
                  </View>
              </TouchableWithoutFeedback>
          </Modal>

         {/* Other Modals (Article/Tweet) */}
         <Suspense fallback={<View style={[StyleSheet.absoluteFill, {justifyContent: 'center', alignItems: 'center', backgroundColor: currentTheme.modalBackdrop}]}><ActivityIndicator color={currentTheme.accent} size="large" /></View>}>
             <ArticleModal visible={modalVisible} onClose={() => setModalVisible(false)} articleId={selectedArticleId} />
             <TweetModal visible={tweetModalVisible} onClose={() => setTweetModalVisible(false)} tweetLink={selectedTweetLink} />
         </Suspense>

         {/* In-App Message */}
         <InAppMessage visible={messageVisible} message={messageText} type={messageType} onClose={() => setMessageVisible(false)} />

      </SafeAreaView>
  );

};

// --- Styles ---
// Includes styles needed for ScrollView version
const getStyles = (currentTheme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: currentTheme.background },
    scrollContentContainer: {
        paddingBottom: 50, // Ensure content doesn't hide behind nav bar
        flexGrow: 1 // Important for ScrollView to allow content to expand
    },
    profileHeader: {
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: currentTheme.background, // Ensure background consistency
        // Optional: Add border if desired, or use listHeaderSeparator below
        // borderBottomWidth: StyleSheet.hairlineWidth,
        // borderBottomColor: currentTheme.borderColor,
    },
    profileImageLarge: { width: 100, height: 100, borderRadius: 50, marginBottom: 15, backgroundColor: currentTheme.placeholder, borderWidth: 1, borderColor: currentTheme.borderColor, },
    profileFullName: { fontSize: fontSizes.xlarge, fontWeight: '700', color: currentTheme.textPrimary, textAlign: 'center', marginBottom: 2, },
    profileUsername: { fontSize: fontSizes.medium, marginBottom: 15, color: currentTheme.textSecondary, textAlign: 'center', },
    bioContainer: { width: '100%', alignItems: 'center', marginBottom: 20, marginTop: 5, },
    bioDisplayContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '90%', minHeight: 40, },
    profileBio: { flex: 1, fontSize: fontSizes.base, textAlign: 'center', lineHeight: fontSizes.base * 1.5, color: currentTheme.textSecondary, marginRight: 5, },
    profileBioPlaceholder: { color: currentTheme.textTertiary, fontStyle: 'italic', },
    editBioButton: { padding: 8, marginLeft: 5, },
    editBioIcon: { fontSize: 18, color: currentTheme.textSecondary, },
    statTouchable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: currentTheme.segmentInactive, minWidth: 120, },
    statContent: { alignItems: 'center', flexDirection: 'row', marginRight: 8, },
    statNumber: { fontSize: fontSizes.medium, fontWeight: '600', color: currentTheme.textPrimary, marginRight: 5, },
    statLabel: { fontSize: fontSizes.base, color: currentTheme.textSecondary, lineHeight: fontSizes.medium, },
    toggleIcon: { marginLeft: 5, },

    // Separator and Toggle Bar Styles
    listHeaderSeparator: {
        backgroundColor: currentTheme.background,
        borderBottomWidth: StyleSheet.hairlineWidth, // Add border here
        borderBottomColor: currentTheme.borderColor,
        borderTopWidth: StyleSheet.hairlineWidth, // Optional: Add top border too
        borderTopColor: currentTheme.borderColor,
     },
    repostsHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 15, },
    sectionTitle: { fontSize: fontSizes.large, fontWeight: '600', color: currentTheme.textPrimary, },
    repostToggleContainer: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', backgroundColor: currentTheme.segmentInactive, padding: 2, },
    repostToggleButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6, },
    repostToggleButtonActive: { backgroundColor: currentTheme.segmentActive, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, },
    repostToggleButtonText: { fontSize: fontSizes.small, fontWeight: '600', textAlign: 'center', color: currentTheme.segmentTextInactive, },
    repostToggleButtonTextActive: { color: currentTheme.segmentTextActive, },

    // Content Area below header
    contentArea: {
        flex: 1, // Allow content like ConnectionsPage to fill space if needed
        backgroundColor: currentTheme.background,
    },

    // Repost Item Styles
    repostItemWrapper: {
        paddingHorizontal: 15, // Keep horizontal padding
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: currentTheme.borderColor,
        backgroundColor: currentTheme.background,
    },
    repostItemContainer: { // Added for error items
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: currentTheme.borderColor,
    },
    reposterInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 5, },
    myRepostTimestampContainer: {},
    reposterIcon: { marginRight: 6, },
    reposterText: { fontSize: fontSizes.small, fontWeight: '500', color: currentTheme.reposterText, flexShrink: 1 },
    repostTimestamp: { fontSize: fontSizes.xsmall, color: currentTheme.textTertiary, marginLeft: 'auto', paddingLeft: 4 },

    // Connections Wrapper (if specific styling needed when shown)
    connectionsWrapper: {
        // Let ConnectionsPage define its own padding/margins
        backgroundColor: currentTheme.background,
    },

    // Manual Footer/Empty/Loading Styles
    footerContainer: { // Used for loading more indicator
        paddingVertical: 20, // Consistent padding
        minHeight: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyListContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginTop: 50, // Margin from top content
        minHeight: 200, // Ensure it takes some space
    },
    emptyListText: { textAlign: 'center', fontSize: fontSizes.base, marginTop: 15, color: currentTheme.textSecondary, lineHeight: fontSizes.base * 1.4, },
    placeholderText: { fontSize: fontSizes.base, color: currentTheme.textTertiary, fontStyle: 'italic', textAlign: 'center', },
    feedbackText: { // General feedback/error text styling
        fontSize: fontSizes.medium,
        fontWeight: '600',
        textAlign: 'center',
        color: currentTheme.textSecondary,
        marginTop: 10,
        paddingHorizontal: 20,
    },
    errorText: { // Specific style for errors shown below toggle
        color: currentTheme.destructive,
        paddingBottom: 15, // Space below error message
        paddingHorizontal: 20,
    },
    retryButton: { // For initial load errors
        marginTop: 20,
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: currentTheme.accent,
        backgroundColor: currentTheme.background,
    },
    retryButtonText: { fontSize: fontSizes.button, fontWeight: '600', color: currentTheme.accent, },

    // --- MODAL Styles (Bio Edit) --- (Unchanged)
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: currentTheme.modalBackdrop, },
    bioModalContainer: { width: '90%', maxWidth: 400, backgroundColor: currentTheme.modalBackground, borderRadius: 14, padding: 20, paddingBottom: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5, },
    bioModalTitle: { fontSize: fontSizes.large, fontWeight: '600', color: currentTheme.textPrimary, marginBottom: 15, },
    bioModalInput: { width: '100%', height: 120, backgroundColor: currentTheme.inputBackground, borderColor: currentTheme.borderColor, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, fontSize: fontSizes.base, color: currentTheme.textPrimary, textAlignVertical: 'top', marginBottom: 10, },
    bioModalErrorText: { fontSize: fontSizes.small, color: currentTheme.destructive, textAlign: 'center', marginBottom: 10, width: '100%', },
    bioModalActions: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%', marginTop: 5, },
    bioModalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginLeft: 10, justifyContent: 'center', alignItems: 'center', minWidth: 80, },
    bioModalCancelButton: { backgroundColor: currentTheme.segmentInactive, },
    bioModalSaveButton: { backgroundColor: currentTheme.accent, },
    bioModalButtonText: { fontSize: fontSizes.button, fontWeight: '600', color: currentTheme.textSecondary, }, // Default text color

    // --- New Style for Load More Button ---
    loadMoreButton: {
        marginVertical: 20,
        marginHorizontal: 50, // Give it some horizontal margin
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: currentTheme.segmentInactive,
        borderRadius: 25, // Rounded corners
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1, // Optional subtle border
        borderColor: currentTheme.borderColor,
    },
    loadMoreButtonText: {
        fontSize: fontSizes.button,
        fontWeight: '600',
        color: currentTheme.accent, // Make text accent color
    },
    // --- New Style for Footer Padding ---
     footerPadding: {
         height: 30, // Add some space at the very bottom of the scroll view
     },
});

export default ProfilePage;