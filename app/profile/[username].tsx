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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { UserContext } from '../UserContext';
import MasterCard from '../../components/MasterCard';
import InAppMessage from '../../components/ui/InAppMessage';

// --- Lazy Imports ---
const ArticleModal = React.lazy(() => import('../articlepage'));
const TweetModal = React.lazy(() => import('../tweetpage'));

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


// ================== Public Profile Page Component ==================
const PublicProfilePage: React.FC = () => {
  // --- Hooks & Context ---
  const router = useRouter();
  const { username: targetUsernameParam } = useLocalSearchParams<{ username: string }>();
  const targetUsername = Array.isArray(targetUsernameParam) ? targetUsernameParam[0] : targetUsernameParam;
  const { userToken, isDarkTheme } = useContext(UserContext);
  const flatListRef = useRef<FlatList>(null);

  // --- State ---
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [targetUserReposts, setTargetUserReposts] = useState<RepostItem[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingReposts, setLoadingReposts] = useState(false);
  const [repostsPage, setRepostsPage] = useState(1); // Current page *loaded*
  const [repostsHasMore, setRepostsHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('loading');
  const [actionLoading, setActionLoading] = useState(false);
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');
  const [articleModalVisible, setArticleModalVisible] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [tweetModalVisible, setTweetModalVisible] = useState(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);

  // --- Theming ---
   const themes = {
       light: { background: '#FFFFFF', cardBackground: '#F8F9FA', textPrimary: '#1C1C1E', textSecondary: '#6B7280', textTertiary: '#AEAEB2', accent: '#007AFF', accentContrast: '#FFFFFF', destructive: '#FF3B30', success: '#34C759', info: '#5AC8FA', borderColor: '#E5E7EB', placeholder: '#EFEFF4', segmentInactive: '#F2F2F7', /* Friend Button Specific */ buttonPrimaryBG: '#007AFF', buttonPrimaryText: '#FFFFFF', buttonSecondaryBG: '#E5E7EB', buttonSecondaryText: '#1C1C1E', buttonDestructiveBG: '#FFE5E5', buttonDestructiveText: '#FF3B30', buttonPendingBG: '#E5E7EB', buttonPendingText: '#6B7280', modalBackdrop: 'rgba(0, 0, 0, 0.4)', modalBackground: '#FFFFFF', inputBackground: '#F2F2F7', reposterText: '#6B7280',
       },
       dark: { background: '#000000', cardBackground: '#1C1C1E', textPrimary: '#FFFFFF', textSecondary: '#8E8E93', textTertiary: '#636366', accent: '#0A84FF', accentContrast: '#FFFFFF', destructive: '#FF453A', success: '#30D158', info: '#64D2FF', borderColor: '#38383A', placeholder: '#2C2C2E', segmentInactive: '#1C1C1E', /* Friend Button Specific */ buttonPrimaryBG: '#0A84FF', buttonPrimaryText: '#FFFFFF', buttonSecondaryBG: '#2C2C2E', buttonSecondaryText: '#FFFFFF', buttonDestructiveBG: '#5C1F1F', buttonDestructiveText: '#FF453A', buttonPendingBG: '#2C2C2E', buttonPendingText: '#8E8E93', modalBackdrop: 'rgba(0, 0, 0, 0.6)', modalBackground: '#1C1C1E', inputBackground: '#1C1C1E', reposterText: '#8E8E93',
       },
   };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;
  const styles = getStyles(currentTheme);

  // --- Helper: Show Message (Memoized) ---
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
       setMessageText(text); setMessageType(type); setMessageVisible(true);
  }, []);

  // --- Data Fetching Callbacks (Memoized) ---
  const fetchLoggedInUsername = useCallback(async (): Promise<string | null> => {
      if (!userToken) return null;
      try { const r=await fetch(`${domaindynamo}/get-username`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:userToken})});const d=await r.json();return(r.ok&&d.status==='Success'&&d.username)?d.username:null; } catch (e) { console.error("[fetchLoggedInUsername] Error:", e); return null; }
  }, [userToken]);

  const checkFriendStatus = useCallback(async (loggedInUser: string | null, targetUser: string | undefined) => {
      const target = targetUser;
      if (!userToken || !loggedInUser || !target || loggedInUser === target) { setFriendStatus(loggedInUser === target ? 'self' : 'logged_out'); return; }
      console.log(`[checkFriendStatus] Checking: ${loggedInUser} vs ${target}`); setFriendStatus('loading');
      try { const r=await fetch(`${domaindynamo}/check_friend_status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:userToken,other_username:target})});const d=await r.json(); if(r.ok&&d.status){const v:FriendStatus[]=['friends','request_sent','request_received','not_friends'];console.log(`[checkFriendStatus] Received status: ${d.status}`);setFriendStatus(v.includes(d.status)?d.status:'error');}else{console.warn("[checkFriendStatus] Failed:",d.message);setFriendStatus('error');} } catch (err) { console.error("[checkFriendStatus] Error:", err); setFriendStatus('error'); }
  }, [userToken]);

  const fetchProfileData = useCallback(async (usernameToFetch: string | undefined) => {
      const target = usernameToFetch;
      if (!target) { setError("User not specified."); setLoadingProfile(false); return; }
      console.log(`[fetchProfileData] Fetching profile for: ${target}.`); setLoadingProfile(true); setError(null);
      try { const[p,n,b]=await Promise.all([fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(target)}`),fetch(`${domaindynamo}/get-full-name?username=${encodeURIComponent(target)}`),fetch(`${domaindynamo}/get-user-bio?username=${encodeURIComponent(target)}`)]);if(!p.ok&&p.status===404)throw new Error(`User '${target}' not found.`);const rs=[p,n,b];const eT:string[]=[];for(let i=0;i<rs.length;i++){const r=rs[i];if(!r.ok&&!((i===1||i===2)&&r.status===404)){let m=`HTTP ${r.status}`;try{const ed=await r.json();m=ed.message||ed.error||m;}catch(e){}eT.push(`Profile Fetch ${i} fail: ${m}`);}}if(eT.length>0){throw new Error(eT.join('; '));} const jP=rs.map(async(r,i)=>{if(!r.ok){if(i===1&&r.status===404)return{status:'Success',full_name:null};if(i===2&&r.status===404)return{status:'Success',bio:null};throw new Error(`HTTP ${r.status} for ${i}`);}try{return await r.json();}catch(e){if(r.status===200&&(i===0||i===1)){if(i===0)return{status:'Success',profile_picture:null};if(i===1)return{status:'Success',full_name:null};}return{status:'Error',message:`Invalid JSON ${i}`};}}); const[pd,nd,bd]=await Promise.all(jP);const pf:UserProfileData={username:target,profilePictureUrl:(pd?.status==='Success'&&pd.profile_picture)?pd.profile_picture:null,fullName:(nd?.status==='Success'&&nd.full_name)?nd.full_name:null,bio:(bd?.status==='Success')?bd.bio:null}; setProfileData(pf); }
      catch (err: any) { setError(err.message || "Failed to load profile."); setProfileData(null); setFriendStatus('error'); } finally { setLoadingProfile(false); }
  }, []);

  // MODIFIED: Accepts pageToFetch argument
  const fetchTargetUserReposts = useCallback(async (usernameToFetch: string | undefined, pageToFetch: number, isRefreshing = false) => {
      const target = usernameToFetch;
      if (!target) return;
      // Prevent fetch if already loading this page or no more data
      if (loadingReposts || (!isRefreshing && !repostsHasMore)) return;

      console.log(`[fetchTargetUserReposts] Fetching page ${pageToFetch} for ${target}. Refresh: ${isRefreshing}`);
      setLoadingReposts(true); if (isRefreshing) { setError(null); } // Clear general error on refresh, keep profile error if exists

      try {
          const response = await fetch(`${domaindynamo}/get_reposts_by_user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: target, page: pageToFetch, limit: REPOST_PAGE_LIMIT }), });
          if (!response.ok && response.status !== 404) throw new Error(`HTTP error ${response.status}`);
          const data = await response.json();
          if (data.status === 'Success' && Array.isArray(data.data)) {
              const newReposts = data.data as RepostItem[];
              setTargetUserReposts(prev => isRefreshing ? newReposts : [...prev, ...newReposts.filter(nr => !(prev.some(pr => (pr.original_content?.id || pr.original_content?.Tweet_Link) === (nr.original_content?.id || nr.original_content?.Tweet_Link))))]);
              // Update page number *after* successful fetch
              setRepostsPage(pageToFetch);
              setRepostsHasMore(newReposts.length >= REPOST_PAGE_LIMIT);
          } else if (response.status === 404 || (data.status === 'Success' && data.data.length === 0)) {
              setRepostsHasMore(false); // No more pages
              // Don't reset page number here if fetching page > 1 resulted in no data
          } else { throw new Error(data.message || `Failed fetch`); }
      } catch (e: any) { console.error(`[fetchTargetUserReposts] Error for ${target} page ${pageToFetch}:`, e); if (isRefreshing) setError(e.message || `Failed load reposts.`); }
      finally { setLoadingReposts(false); }
  // REMOVED repostsPage dependency. Depends on loading/hasMore state.
  }, [repostsHasMore, loadingReposts]);

  // --- UseEffect Hooks (REVISED) ---
  useEffect(() => {
      // Effect 1: Fetch loggedInUsername on initial load or token change
      fetchLoggedInUsername().then(uname => { setLoggedInUsername(uname); });
  }, [fetchLoggedInUsername]);

  useEffect(() => {
      // Effect 2: Fetch Profile Data when targetUsername changes
      if (targetUsername) {
          setProfileData(null); // Clear previous profile
          setTargetUserReposts([]); // Clear previous reposts
          setRepostsPage(1); // Reset page
          setRepostsHasMore(true); // Assume has more
          setFriendStatus('loading'); // Reset status
          setError(null); // Clear errors
          setLoadingProfile(true); // Set loading before fetch
          fetchProfileData(targetUsername);
      } else { /* Handle no targetUsername */ setError("User not specified."); setLoadingProfile(false); setProfileData(null); setTargetUserReposts([]); }
  }, [targetUsername, fetchProfileData]); // Only depends on targetUsername and the stable fetch function ref

  useEffect(() => {
      // Effect 3: Check Friend Status when targetUsername OR loggedInUsername changes
       if (targetUsername && loggedInUsername !== undefined) { // Check if loggedInUsername state is determined
           checkFriendStatus(loggedInUsername, targetUsername);
       } else if (targetUsername) { // target known, but loggedInUser isn't yet
           setFriendStatus('loading');
       }
  }, [targetUsername, loggedInUsername, checkFriendStatus]); // Depends on IDs and stable check function ref

  useEffect(() => {
       // Effect 4: Fetch Initial Reposts (Page 1) when targetUsername changes AND profile isn't loading
       // Prevents fetching reposts before profile load potentially fails
       if (targetUsername && !loadingProfile && profileData) { // Only fetch if profile loaded successfully
           console.log(`Effect 4: Fetching initial reposts for ${targetUsername}.`);
           // State resets are now primarily in Effect 2, just call fetch here
           fetchTargetUserReposts(targetUsername, 1, true); // Fetch page 1, isRefreshing=true
       } else if (targetUsername && !loadingProfile && !profileData) {
           // Profile load finished but failed, don't fetch reposts
           console.log("Effect 4: Profile load failed, skipping initial repost fetch.");
           setLoadingReposts(false); // Ensure repost loading stops
           setRepostsHasMore(false);
       }
  }, [targetUsername, loadingProfile, profileData, fetchTargetUserReposts]); // Runs when targetUsername changes or profile loading finishes


  // --- Action Handlers (Memoized) ---
  const onRefresh = useCallback(async () => {
      if (!targetUsername) return;
      console.log(`[onRefresh] Refreshing profile for ${targetUsername}`);
      setRefreshing(true); setError(null);
      const currentLoggedInUser = await fetchLoggedInUsername();
      setLoggedInUsername(currentLoggedInUser);
      // Run fetches concurrently
      await Promise.all([
         fetchProfileData(targetUsername),
         checkFriendStatus(currentLoggedInUser, targetUsername),
         fetchTargetUserReposts(targetUsername, 1, true) // Fetch page 1, isRefreshing=true
      ]);
      setRefreshing(false);
  }, [targetUsername, fetchLoggedInUsername, fetchProfileData, checkFriendStatus, fetchTargetUserReposts]);

  // MODIFIED: Calculates next page and passes it
  const loadMoreReposts = useCallback(() => {
      if (!loadingReposts && repostsHasMore && targetUsername) {
          const nextPage = repostsPage + 1;
          fetchTargetUserReposts(targetUsername, nextPage, false); // Fetch next page
      }
  // Now depends on repostsPage state
  }, [loadingReposts, repostsHasMore, targetUsername, repostsPage, fetchTargetUserReposts]);

 // --- Friend Action Handlers (Memoized) ---
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
        // Placeholder - likely navigate to a different screen
        if (!targetUsername) return;
        showInAppMessage("Respond to requests on your Connections page.", "info");
        // Example navigation: router.push('/(tabs)/connections');
    }, [targetUsername, showInAppMessage /*, router */]);

  // --- Card Press Handlers (Memoized - Unchanged) ---
  const handleArticlePress = useCallback((articleData: any) => { if(!userToken){showInAppMessage('Login required','info');return;} if(articleData?.id){setSelectedArticleId(String(articleData.id));setArticleModalVisible(true);}else{showInAppMessage('Error opening article.','error');} }, [userToken, showInAppMessage]);
  const handleTweetPress = useCallback((tweetData: any) => { if(!userToken){showInAppMessage('Login required','info');return;} if(tweetData?.Tweet_Link){setSelectedTweetLink(tweetData.Tweet_Link);setTweetModalVisible(true);}else{showInAppMessage('Error opening tweet.','error');} }, [userToken, showInAppMessage]);

  // --- Render Item for Repost List (Memoized - Unchanged) ---
  const renderRepostItem = useCallback(({ item }: { item: RepostItem }) => { if(!item||!item.original_content||!item.content_type){return(<View><Text style={[styles.placeholderText,{padding:20}]}>Content unavailable.</Text></View>);}const contentId=item.original_content.id||item.original_content.Tweet_Link;if(!contentId){return(<View><Text style={[styles.placeholderText,{padding:20}]}>Content identifier missing.</Text></View>);}const masterCardItem={type:item.content_type,id:contentId,dateTime:item.original_content.Created_At||item.original_content.date||item.reposted_at,author:item.original_content.Username||item.original_content.authors||'Unknown',text_content:item.original_content.Tweet||item.original_content.headline||'',media_url:item.original_content.Media_URL||item.original_content.image_url||null,Retweets:item.original_content.Retweets,Favorites:item.original_content.Favorites,};const handlePress=item.content_type==='tweet'?handleTweetPress:handleArticlePress;return(<View style={styles.repostItemContainer}><MasterCard item={masterCardItem} onPress={()=>handlePress(item.original_content)}/></View>); }, [handleTweetPress, handleArticlePress, styles, currentTheme]);

  // --- List Header Component (Memoized - Unchanged implementation) ---
  const ListHeader = useCallback(() => { /* ... same button logic based on friendStatus ... */ let buttonContent: React.ReactNode = null; if(friendStatus==='loading'){buttonContent=<ActivityIndicator size="small" color={currentTheme.textSecondary} style={styles.friendStatusLoader}/>;}else if(friendStatus!=='self'&&friendStatus!=='logged_out'&&friendStatus!=='error'){let buttonText='';let buttonAction=()=>{};let buttonStyle={};let textStyle={};let IconComponent:React.ReactNode|null=null;const isDisabled=actionLoading;switch(friendStatus){case'not_friends':buttonText='Add Friend';buttonAction=handleSendRequest;buttonStyle=styles.buttonPrimary;textStyle=styles.buttonPrimaryText;IconComponent=<Icon name="person-add-outline" size={16} color={currentTheme.buttonPrimaryText} style={styles.buttonIcon}/>;break;case'request_sent':buttonText='Request Sent';buttonAction=handleCancelRequest;buttonStyle=styles.buttonPending;textStyle=styles.buttonPendingText;IconComponent=<Icon name="time-outline" size={16} color={currentTheme.buttonPendingText} style={styles.buttonIcon}/>;break;case'request_received':buttonText='Respond';buttonAction=handleRespondToRequest;buttonStyle=styles.buttonSecondary;textStyle=styles.buttonSecondaryText;IconComponent=<Icon name="mail-unread-outline" size={16} color={currentTheme.buttonSecondaryText} style={styles.buttonIcon}/>;break;case'friends':buttonText='Friends';buttonAction=handleRemoveFriend;buttonStyle=styles.buttonSecondary;textStyle=styles.buttonSecondaryText;IconComponent=<Icon name="checkmark-outline" size={16} color={currentTheme.buttonSecondaryText} style={styles.buttonIcon}/>;break;}buttonContent=(<TouchableOpacity style={[styles.profileActionButton,buttonStyle,isDisabled?styles.buttonDisabled:{}]} onPress={buttonAction} disabled={isDisabled}>{actionLoading?<ActivityIndicator size="small" color={(textStyle as any).color||currentTheme.textPrimary}/>:<> {IconComponent} <Text style={[styles.profileActionButtonText,textStyle]}>{buttonText}</Text> </>}</TouchableOpacity>);} return( <View><View style={styles.profileHeader}>{profileData?(<>{/*...PFP, Name, Bio...*/}<Image source={{uri:profileData.profilePictureUrl||defaultPFP}} style={styles.profileImageLarge} onError={(e)=>console.log("PFP Error", e.nativeEvent.error)}/><Text style={styles.profileFullName} numberOfLines={1}>{profileData.fullName||profileData.username}</Text><Text style={styles.profileUsername}>@{profileData.username}</Text>{(profileData.bio&&profileData.bio.trim()!=='')?(<Text style={styles.profileBio}>{profileData.bio}</Text>):(<Text style={[styles.profileBio, styles.profileBioPlaceholder]}>No bio yet.</Text>)}{buttonContent}</>):(!loadingProfile&&error&&(<Text style={[styles.feedbackText,{color:currentTheme.destructive}]}>{error}</Text>))}</View><View style={styles.repostsHeaderContainer}><Text style={styles.sectionTitle}>Reposts</Text></View>{error&&profileData&&!loadingReposts&&(<Text style={[styles.feedbackText,{paddingBottom:10,color:currentTheme.destructive}]}>{error}</Text>)}</View> );}, [ profileData, friendStatus, actionLoading, handleSendRequest, handleCancelRequest, handleRemoveFriend, handleRespondToRequest, currentTheme, styles, loadingProfile, error, targetUsername ]); // Added targetUsername dependency for safety

  // --- List Footer & Empty Components (Memoized - Unchanged) ---
  const ListFooter = useCallback(() => { if(loadingReposts && !refreshing && targetUserReposts.length > 0){return(<View style={styles.footerContainer}><ActivityIndicator style={{marginVertical:20}} size="small" color={currentTheme.textSecondary}/></View>);} return <View style={styles.footerContainer}/>; },[loadingReposts, refreshing, targetUserReposts.length, currentTheme, styles]);
  const ListEmpty = useCallback(() => { if (!loadingReposts && targetUserReposts.length === 0) { return (<View style={styles.emptyListContainer}><Icon name={"newspaper-outline"} size={40} color={currentTheme.textTertiary} /><Text style={styles.emptyListText}>{profileData?.username || 'This user'} hasn't reposted anything yet.</Text></View>); } /* Don't show loader if main profile is loading */ return null; }, [loadingReposts, targetUserReposts.length, profileData, currentTheme, styles]);

  // --- On End Reached Logic (Memoized) ---
  const handleEndReached = useCallback(() => { loadMoreReposts(); }, [loadMoreReposts]);

  // --- Loading/Error States (Initial Page Load - Adjusted) ---
  // Show loader if profile hasn't loaded OR friend status check is pending (after profile load)
  if (((loadingProfile && !profileData) || (friendStatus === 'loading' && profileData)) && !refreshing) {
       return ( <SafeAreaView style={[styles.container, styles.centerScreen]}><ActivityIndicator size="large" color={currentTheme.accent} /></SafeAreaView> );
  }
  // Critical error states (unchanged)
  if (error && !profileData && !loadingProfile) { return ( <SafeAreaView style={[styles.container, styles.centerScreen, { padding: 20 }]}><Icon name="alert-circle-outline" size={50} color={currentTheme.destructive} /><Text style={[styles.feedbackText, {color: currentTheme.destructive, marginTop: 15}]}>{error}</Text></SafeAreaView> ); }
  if (!targetUsername && !loadingProfile) { return ( <SafeAreaView style={[styles.container, styles.centerScreen]}><Text style={styles.feedbackText}>User not specified.</Text></SafeAreaView> ); }
  // Fallback if profile is null after loading without error
  if (!profileData && !loadingProfile && !error) { return ( <SafeAreaView style={[styles.container, styles.centerScreen]}><Text style={styles.feedbackText}>Could not load profile.</Text></SafeAreaView> ); }

  // --- Main Render ---
  return (
    <SafeAreaView style={styles.container}>
        <FlatList
            ref={flatListRef}
            data={targetUserReposts}
            renderItem={renderRepostItem}
            keyExtractor={(item, index) => `repost-${item.content_type}-${item.original_content?.id || item.original_content?.Tweet_Link || `pub-fr-${index}`}`}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={ListEmpty}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.8}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentTheme.accent} colors={[currentTheme.accent]}/>}
            contentContainerStyle={styles.listContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            extraData={{ friendStatus, actionLoading, profileData, loadingReposts, error }} // Include states affecting header/footer/empty
            style={{ flex: 1 }}
        />

       {/* Modals */}
       <Suspense fallback={<View style={[StyleSheet.absoluteFill, styles.centerScreen, {backgroundColor: currentTheme.modalBackdrop}]}><ActivityIndicator color={currentTheme.accent} size="large" /></View>}>
           <ArticleModal visible={articleModalVisible} onClose={() => setArticleModalVisible(false)} articleId={selectedArticleId} />
           <TweetModal visible={tweetModalVisible} onClose={() => setTweetModalVisible(false)} tweetLink={selectedTweetLink} />
       </Suspense>

       {/* In-App Message */}
       <InAppMessage visible={messageVisible} message={messageText} type={messageType} onClose={() => setMessageVisible(false)} />
    </SafeAreaView>
  );

};

// --- Styles ---
// Using the same getStyles function and styles object from the previous correct version
const getStyles = (currentTheme: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: currentTheme.background },
    centerScreen: { justifyContent:'center', alignItems:'center' },
    listContentContainer: { paddingBottom: 50, },
    profileHeader: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 20 : 30, paddingBottom: 25, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: currentTheme.borderColor, backgroundColor: currentTheme.background, },
    profileImageLarge: { width: 100, height: 100, borderRadius: 50, marginBottom: 15, backgroundColor: currentTheme.placeholder, borderWidth: 1, borderColor: currentTheme.borderColor, },
    profileFullName: { fontSize: fontSizes.xlarge, fontWeight: '700', color: currentTheme.textPrimary, textAlign: 'center', marginBottom: 2, },
    profileUsername: { fontSize: fontSizes.medium, marginBottom: 15, color: currentTheme.textSecondary, textAlign: 'center', },
    profileBio: { fontSize: fontSizes.base, textAlign: 'center', lineHeight: fontSizes.base * 1.5, color: currentTheme.textSecondary, marginBottom: 25, paddingHorizontal: 15, },
    profileBioPlaceholder: { color: currentTheme.textTertiary, fontStyle: 'italic', },
    profileActionButton: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, justifyContent: 'center', alignItems: 'center', minHeight: 40, minWidth: 150, gap: 8, },
    buttonIcon: { marginRight: -4, /* Adjust if needed */ },
    buttonPrimary: { backgroundColor: currentTheme.buttonPrimaryBG, },
    buttonSecondary: { backgroundColor: currentTheme.buttonSecondaryBG, borderWidth: 1, borderColor: currentTheme.borderColor, },
    buttonPending: { backgroundColor: currentTheme.buttonPendingBG, borderWidth: 1, borderColor: currentTheme.borderColor, },
    buttonDestructive: { backgroundColor: currentTheme.buttonDestructiveBG, },
    profileActionButtonText: { fontSize: fontSizes.button, fontWeight: '600', },
    buttonPrimaryText: { color: currentTheme.buttonPrimaryText, },
    buttonSecondaryText: { color: currentTheme.buttonSecondaryText, },
    buttonPendingText: { color: currentTheme.buttonPendingText, },
    buttonDestructiveText: { color: currentTheme.buttonDestructiveText, },
    buttonDisabled: { opacity: 0.6, },
    friendStatusLoader: { marginTop: 10, marginBottom: 15, height: 40 }, // Give loader space like button
    repostsHeaderContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15, backgroundColor: currentTheme.background, },
    sectionTitle: { fontSize: fontSizes.large, fontWeight: '600', color: currentTheme.textPrimary, },
    repostItemContainer: { paddingHorizontal: 15, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: currentTheme.borderColor, backgroundColor: currentTheme.background, },
    footerContainer: { paddingBottom: 30, minHeight: 50, justifyContent:'center', alignItems:'center' },
    emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 30, minHeight: 200, },
    emptyListText: { textAlign: 'center', fontSize: fontSizes.base, marginTop: 15, color: currentTheme.textSecondary, lineHeight: fontSizes.base * 1.4, },
    placeholderText: { fontSize: fontSizes.base, color: currentTheme.textTertiary, fontStyle: 'italic', textAlign: 'center', },
    feedbackText: { fontSize: fontSizes.medium, fontWeight: '600', textAlign: 'center', color: currentTheme.textSecondary, marginTop: 10, paddingHorizontal: 20, },
});


export default PublicProfilePage;