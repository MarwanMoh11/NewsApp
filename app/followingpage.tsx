// app/connections.tsx (Example Path)
// This is the full, unabbreviated code for the ConnectionsPage component.

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  Keyboard,
  Modal, // Using Modal instead of Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { UserContext } from './UserContext'; // Adjust path if needed
import { ScrollContext } from './ScrollContext'; // Adjust path if needed
import PublicProfileModal from './ProfileModal';
import InAppMessage from '../components/ui/InAppMessage'; // Adjust path if needed

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const { width } = Dimensions.get('window');

// --- Interfaces ---
interface Friend {
  username: string;
  profile_picture: string;
}

type SubTab = 'Friends' | 'Requests';

// --- Responsive Sizing ---
const getResponsiveSize = (baseSize: number): number => {
  if (width < 350) return baseSize * 0.9;
  if (width < 400) return baseSize;
  return baseSize * 1.1;
};

const fontSizes = {
  small: getResponsiveSize(11),
  base: getResponsiveSize(13),
  medium: getResponsiveSize(15),
  large: getResponsiveSize(17),
  button: getResponsiveSize(14),
};

// --- Default Placeholder ---
const defaultPFP = 'https://via.placeholder.com/40/cccccc/969696?text=User';

// --- Component ---
const ConnectionsPage: React.FC = () => {
  // --- State ---
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('Friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<Friend[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<Friend[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');
  const [showConfirmRemoveDialog, setShowConfirmRemoveDialog] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);

  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);


  // --- Hooks ---
  const router = useRouter();
  const { userToken, isDarkTheme } = useContext(UserContext);
  const { setScrollToTop } = useContext(ScrollContext);
  const flatListRef = useRef<FlatList>(null);

  // --- Theming ---
   const themes = {
    light: {
      background: '#F8F9FA', cardBackground: '#FFFFFF', textPrimary: '#1F2937',
      textSecondary: '#6B7280', textTertiary: '#9CA3AF', accent: '#6366F1',
      accentContrast: '#FFFFFF', destructive: '#EF4444', success: '#10B981',
      info: '#3B82F6', borderColor: '#E5E7EB', placeholder: '#E5E7EB',
      inputBackground: '#FFFFFF', destructiveContrast: '#FFFFFF',
      successContrast: '#FFFFFF', infoContrast: '#FFFFFF',
      buttonSecondaryBackground: '#E5E7EB', buttonSecondaryText: '#374151',
      subTabTextInactive: '#6B7280',
      subTabTextActive: '#1F2937',
      subTabIndicator: '#6366F1',
      modalBackdrop: 'rgba(0, 0, 0, 0.4)',
      modalBackground: '#FFFFFF',
    },
    dark: {
      background: '#000000', cardBackground: '#1A1A1A', textPrimary: '#F9FAFB',
      textSecondary: '#9CA3AF', textTertiary: '#6B7280', accent: '#818CF8',
      accentContrast: '#FFFFFF', destructive: '#F87171', success: '#34D399',
      info: '#60A5FA', borderColor: '#374151', placeholder: '#374151',
      inputBackground: '#1F2937', destructiveContrast: '#FFFFFF',
      successContrast: '#111827', infoContrast: '#111827',
      buttonSecondaryBackground: '#374151', buttonSecondaryText: '#D1D5DB',
      subTabTextInactive: '#9CA3AF',
      subTabTextActive: '#F9FAFB',
      subTabIndicator: '#818CF8',
      modalBackdrop: 'rgba(0, 0, 0, 0.6)',
      modalBackground: '#1F2937',
    },
  };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;
  const styles = getStyles(currentTheme);

  // --- Helper Functions ---
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
    // Optional: Auto-hide after a delay
    // setTimeout(() => setMessageVisible(false), 3000);
  }, []);

   const handleViewProfile = useCallback((profileUsername: string) => {
      if (!profileUsername) return;
      // Optionally, you could prevent opening own profile from here if desired
      // if (profileUsername === username) return;

      console.log(`[ConnectionsPage] Opening profile modal for: ${profileUsername}`);
      setSelectedProfileUsername(profileUsername);
      setIsProfileModalVisible(true);
    }, [username]); // Dependency on own username if self-check is added

  // --- Effects ---
  useEffect(() => {
    // Fetch username when component mounts or userToken changes
    if (userToken) {
      fetchUsername();
    } else {
      // Handle logged out state
      setLoading(false);
      showInAppMessage("Please log in to manage connections.", 'info');
      setUsername('');
      setFriends([]);
      setPendingIncoming([]);
      setPendingOutgoing([]);
    }
  }, [userToken]); // Rerun effect if userToken changes

  useEffect(() => {
    // Fetch connection data once username is available
    if (username) {
      console.log(`Username set: ${username}. Fetching all connection data.`);
      fetchAllConnectionData(); // Fetches friends, incoming, and outgoing
    }
  }, [username]); // Rerun effect if username changes

  useEffect(() => {
    // Setup scroll-to-top functionality via context
    setScrollToTop(() => () => {
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
        console.log('ConnectionsPage: Scrolling list to top');
      }
    });
     // Cleanup function to reset scroll-to-top callback on unmount
     return () => setScrollToTop(() => () => {});
  }, [setScrollToTop]);

  // --- Data Fetching ---
  const fetchUsername = async () => {
    if (!userToken) return;
    setLoading(true);
    setUsername('');
    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success' && data.username) {
        setUsername(data.username);
      } else {
        setUsername('');
        showInAppMessage(data.message || 'Could not verify user session.', 'error');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error fetching username:', error);
      showInAppMessage(`Error fetching user: ${error.message}`, 'error');
      setUsername('');
      setLoading(false);
    }
  };

  const fetchConnections = async (user: string) => {
    try {
      const responseFollowed = await fetch(`${domaindynamo}/get_followed_users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: user }),
      });
      const dataFollowed = await responseFollowed.json();
      let connections: string[] = (responseFollowed.ok && dataFollowed.status === 'Success' && Array.isArray(dataFollowed.followedUsernames)) ? dataFollowed.followedUsernames : [];

      const connectionList: Friend[] = await Promise.all(
        connections.map(async (uname: string) => ({
          username: uname,
          profile_picture: await fetchUserProfilePicture(uname),
        }))
      );
      setFriends(connectionList);
    } catch (error) {
      console.error('Error fetching connections:', error);
      setFriends([]);
    }
  };

  const fetchAllConnectionData = async () => {
    if (!username) return;
    console.log("Fetching all connection data (Friends, Incoming, Outgoing)...");
    try {
      await Promise.all([
        fetchConnections(username),
        fetchIncomingRequests(username),
        fetchOutgoingRequests(username),
      ]);
      console.log("Finished fetching all connection data.");
    } catch (error) {
        console.error("Error during combined fetch:", error);
        showInAppMessage("Failed to load connection details.", "error");
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!username) { setRefreshing(false); return; }
    console.log("Refreshing connection data...");
    setRefreshing(true);
    await fetchAllConnectionData();
  }, [username]);

  const fetchUserProfilePicture = async (user: string): Promise<string> => {
    if (!user) return defaultPFP;
    try {
      const response = await fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(user)}`);
      const data = await response.json();
      return (response.ok && data.status === 'Success' && data.profile_picture) ? data.profile_picture : defaultPFP;
    } catch (error) {
      console.error(`Error fetching profile picture for ${user}:`, error);
      return defaultPFP;
    }
  };

  const fetchIncomingRequests = async (user: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get_pending_users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followed_username: user }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success' && Array.isArray(data.pendingUsernames)) {
        const incoming: Friend[] = await Promise.all(
          data.pendingUsernames.map(async (uname: string) => ({
            username: uname,
            profile_picture: await fetchUserProfilePicture(uname),
          }))
        );
        setPendingIncoming(incoming);
      } else {
        setPendingIncoming([]);
         if (data.message && data.message !== 'No pending follow requests found.') {
            console.warn('Error fetching incoming requests:', data.message);
         } else if (!response.ok) {
             console.warn('Error fetching incoming requests:', `Status: ${response.status}`);
         }
      }
    } catch (error) {
      console.error('Error fetching incoming requests:', error);
      setPendingIncoming([]);
    }
  };

  const fetchOutgoingRequests = async (user: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get_outgoing_pending_requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: user }),
      });
      const data = await response.json();
      if (response.ok && data.status === 'Success' && Array.isArray(data.pendingFollowRequests)) {
        const requests: Friend[] = await Promise.all(
          data.pendingFollowRequests.map(async (uname: string) => ({
            username: uname,
            profile_picture: await fetchUserProfilePicture(uname),
          }))
        );
        setPendingOutgoing(requests);
      } else {
        setPendingOutgoing([]);
         if (data.message && data.message !== 'No outgoing pending follow requests found.') {
             console.warn('Error fetching outgoing requests:', data.message);
         } else if (!response.ok) {
             console.warn('Error fetching outgoing requests:', `Status: ${response.status}`);
         }
      }
    } catch (error) {
      console.error('Error fetching outgoing requests:', error);
      setPendingOutgoing([]);
    }
  };

 // --- Action Handlers ---
 const handleAction = async (actionType: string, targetUsername: string, apiEndpoint: string, body: object, successMessage: string, errorMessage: string) => {
    if (actionLoading[targetUsername]) return;
    setActionLoading(prev => ({ ...prev, [targetUsername]: true }));
    try {
        const response = await fetch(`${domaindynamo}${apiEndpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const result = await response.json();
        if (response.ok && result.status === 'Success') {
            showInAppMessage(successMessage, 'success');
            await fetchAllConnectionData(); // Refetch data on success
        } else {
            showInAppMessage(result.message || errorMessage, 'error');
        }
    } catch (error: any) {
        console.error(`Error performing action ${actionType}:`, error);
        showInAppMessage(`Action failed: ${error.message || 'Network error'}`, 'error');
    } finally {
        setActionLoading(prev => ({ ...prev, [targetUsername]: false }));
    }
 };

 const handleAddFriend = (newFriendUsername: string) => {
    if (!userToken || !username) { showInAppMessage('Login required.', 'info'); return; }
    if (newFriendUsername === username) { showInAppMessage("You cannot add yourself as a friend.", 'info'); return; }
    if (friends.some(f => f.username === newFriendUsername) || pendingOutgoing.some(u => u.username === newFriendUsername) || pendingIncoming.some(u => u.username === newFriendUsername)) {
        showInAppMessage('Already friends or request pending.', 'info'); return;
    }
    handleAction(
        'addFriend', newFriendUsername, '/follow_Users',
        { follower_username: username, followed_username: newFriendUsername },
        `Friend request sent to ${newFriendUsername}.`,
        'Failed to send friend request.'
    );
 };

 const handleCancelRequest = (friendUsername: string) => {
    if (!username) return;
    handleAction(
        'cancelRequest', friendUsername, '/cancel_follow_request',
        { follower_username: username, followed_username: friendUsername },
        `Friend request to ${friendUsername} cancelled.`,
        'Failed to cancel friend request.'
    );
 };

 // Updated handler to: 1. Accept B->A, 2. Create A->B, 3. Accept A->B
 const handleAcceptRequest = async (requestingUser: string) => {
    if (!username) return;

    console.log(`[handleAcceptRequest] Accepting request from ${requestingUser} and attempting auto-mutual follow.`);

    // --- Step 1: Accept the incoming request (B -> A) ---
    let acceptSuccess = false;
    try {
         await handleAction(
            'acceptRequest',
            requestingUser,
            '/accept_follow_request', // Endpoint to accept B -> A
            { follower_username: requestingUser, followed_username: username },
            `Accepted ${requestingUser}'s friend request.`, // Initial message
            'Failed to accept friend request.'
        );
        acceptSuccess = true;
    } catch (error) {
         console.error("Error during Step 1 (Accept B->A):", error);
         acceptSuccess = false;
         // Error message already shown by handleAction
         return; // Stop if initial accept fails
    }

    // --- Step 2: Create the follow-back request (A -> B) ---
    let followBackCreated = false;
    if (acceptSuccess) { // Only proceed if step 1 didn't throw
        try {
            await handleAction(
                'followBackCreate', // Different type for clarity
                requestingUser,
                '/follow_Users', // Endpoint to create A -> B
                { follower_username: username, followed_username: requestingUser },
                `Follow request sent to ${requestingUser}.`, // Intermediate message (will be overwritten)
                `Accepted request, but failed to initiate follow back to ${requestingUser}.`
            );
            followBackCreated = true;
        } catch (error) {
            console.error("Error during Step 2 (Create A->B):", error);
            followBackCreated = false;
            // Error message shown by handleAction
            // Don't necessarily stop here, maybe Step 3 can still clean up if needed,
            // but likely it will fail too if Step 2 failed.
        }
    }

    // --- Step 3: Accept the follow-back request (A -> B) ---
    if (followBackCreated) { // Only proceed if A->B record was likely created
        try {
            await handleAction(
                'acceptFollowBack', // Different type for clarity
                requestingUser,
                '/accept_follow_request', // Endpoint to accept A -> B
                { follower_username: username, followed_username: requestingUser }, // Note: follower is current user now
                `Accepted ${requestingUser} and followed back. You are now friends.`, // Final success message
                `Failed to auto-accept follow back for ${requestingUser}.`
            );
        } catch (error) {
             console.error("Error during Step 3 (Accept A->B):", error);
             // Error message shown by handleAction
             showInAppMessage(`Follow back for ${requestingUser} may require manual acceptance.`, 'error');
        }
    } else if (acceptSuccess) {
        // If Step 1 succeeded but Step 2 failed, inform the user
         showInAppMessage(`Accepted ${requestingUser}'s request, but could not automatically follow back.`, 'error');
    }

    // Note: fetchAllConnectionData is called inside handleAction on success of each step.
    // The final call after Step 3 (if successful) should show the mutual state.
 };



 const handleRejectRequest = (requestingUser: string) => {
     if (!username) return;
     handleAction(
        'rejectRequest', requestingUser, '/reject_follow_request',
        { follower_username: requestingUser, followed_username: username },
        `Rejected ${requestingUser}'s friend request.`,
        'Failed to reject friend request.'
    );
 };

 // Uses Modal instead of Alert
 const handleRemoveFriend = (friendUsername: string) => {
     if (!username) return;
     console.log(`[handleRemoveFriend] Initiating removal for: ${friendUsername}`);
     setUserToRemove(friendUsername);
     setShowConfirmRemoveDialog(true);
 };

 // Handler for confirming removal from modal - attempts mutual removal
 const confirmRemoveFriend = async () => {
    if (!userToRemove || !username) return;

    const targetUsername = userToRemove; // Store in temp variable before state is cleared

    setShowConfirmRemoveDialog(false); // Hide dialog immediately
    setUserToRemove(null); // Clear the user state

    console.log(`[confirmRemoveFriend] Attempting mutual removal for: ${targetUsername}`);

    // --- Step 1: Remove current user's follow (A -> B) ---
    let removeStep1Success = false;
    try {
        await handleAction(
            'removeFriend', // actionType
            targetUsername, // targetUsername for loading state
            '/remove_follow_Users', // apiEndpoint
            { follower_username: username, followed_username: targetUsername }, // body
            `Removed ${targetUsername} from friends.`, // Primary success message
            `Failed to remove ${targetUsername}.` // Error for this step
        );
        removeStep1Success = true; // Assume okay if no exception
    } catch (error) {
        console.error(`[confirmRemoveFriend] Error during remove step 1 (A->B) for ${targetUsername}:`, error);
        // Error message shown by handleAction
        removeStep1Success = false;
    }

    // --- Step 2: Attempt to remove the other user's follow (B -> A) ---
    // We attempt this regardless of step 1's specific backend outcome,
    // as the goal is to ensure the connection is broken from both sides if possible.
    // The backend handles cases where the follow doesn't exist.
    console.log(`[confirmRemoveFriend] Attempting reverse removal (B->A) for ${targetUsername}.`);
    try {
        await handleAction(
            'removeFriendReverse', // Different actionType for logging clarity
            targetUsername, // Keep loading tied to the target user visually
            '/remove_follow_Users', // Same endpoint
            { follower_username: targetUsername, followed_username: username }, // Reversed body
            `Removed ${targetUsername} from friends (mutual).`, // Optional more specific success message if needed
            `Failed to remove reverse connection for ${targetUsername}.` // Specific error message
        );
        // If the first message was already shown, the second success message might be redundant.
        // Consider making the second handleAction call silent on success if preferred.
    } catch (error) {
         console.error(`[confirmRemoveFriend] Error during remove step 2 (B->A) for ${targetUsername}:`, error);
         // Error message shown by handleAction
         // If step 1 succeeded but step 2 failed, the removal is only partial.
         if (removeStep1Success) {
             showInAppMessage(`Removed ${targetUsername}, but failed to remove reverse connection.`, 'error');
         }
    }

    // Note: fetchAllConnectionData is called inside handleAction on success of *each* step,
    // so the list should reflect the final state after both attempts.
 };


 const cancelRemoveFriend = () => {
    console.log('[cancelRemoveFriend] Cancelled removal.');
    setShowConfirmRemoveDialog(false);
    setUserToRemove(null);
 };


   // --- Search Functionality ---
   const searchUser = useCallback(async (query: string) => {
     const trimmedQuery = query.trim();
     if (trimmedQuery.length === 0) {
       setSearchResults([]);
       setHasSearched(false);
       return;
     }
     setSearchLoading(true);
     setHasSearched(true);
     try {
       const response = await fetch(`${domaindynamo}/get-similar_users_searched`, {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ username: trimmedQuery }),
       });
       const data = await response.json();
       if (response.ok && data.status === 'Success' && Array.isArray(data.similar_users)) {
         const filteredUsers = data.similar_users.filter((uname: string) => uname !== username);
         const results: Friend[] = await Promise.all(
           filteredUsers.map(async (uname: string) => ({
             username: uname,
             profile_picture: await fetchUserProfilePicture(uname),
           }))
         );
         setSearchResults(results);
       } else {
         setSearchResults([]);
         if (data.message && data.message !== 'No similar users found.') {
             console.warn("Search error:", data.message);
         } else if (!response.ok) {
             console.warn("Search error:", `Status: ${response.status}`);
         }
       }
     } catch (error: any) {
       console.error('Error searching users:', error);
       showInAppMessage(`Search failed: ${error.message || 'Network error'}`, 'error');
       setSearchResults([]);
     } finally {
       setSearchLoading(false);
     }
   }, [username, domaindynamo, showInAppMessage]);

    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
    const handleSearchTextChange = (text: string) => {
        setSearchUsername(text);
        if (debounceTimeout.current) { clearTimeout(debounceTimeout.current); }
        debounceTimeout.current = setTimeout(() => {
            searchUser(text);
        }, 500);
    };

   // --- Sub Tab Change Handler ---
   const handleSubTabChange = (subTab: SubTab) => {
       setActiveSubTab(subTab);
       setSearchUsername('');
       setSearchResults([]);
       setHasSearched(false);
       Keyboard.dismiss();
   };


  // --- Render Helpers ---
    const renderUserCard = (
        item: Friend,
        actions: React.ReactNode,
        statusText?: string,
        statusColor?: string
      ) => (
      <View style={styles.userCard}>
        {/* --- Wrap Image and Info in TouchableOpacity --- */}
        <TouchableOpacity
          style={styles.userInfoTouchable} // Added style for this touchable area
          onPress={() => handleViewProfile(item.username)} // Call handler on press
          // disabled={item.username === username} // Optionally disable for own profile
        >
          <Image source={{ uri: item.profile_picture || defaultPFP }} style={styles.profileImage} />
          <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">{item.username}</Text>
              {statusText && <Text style={[styles.statusText, { color: statusColor || currentTheme.textSecondary }]}>{statusText}</Text>}
          </View>
        </TouchableOpacity>
        {/* --- End Touchable Area --- */}

        {/* Action buttons remain separate */}
        <View style={styles.userActions}>
            {actions}
        </View>
      </View>
    );

  const renderReceivedRequestCard = ({ item }: { item: Friend }) => renderUserCard(item,
    <>
      <TouchableOpacity style={[styles.actionButton, { backgroundColor: currentTheme.success }]} onPress={() => handleAcceptRequest(item.username)} disabled={actionLoading[item.username]}>
        {actionLoading[item.username] ? <ActivityIndicator size="small" color={currentTheme.successContrast} /> : <Icon name="checkmark-outline" size={18} color={currentTheme.successContrast} />}
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionButton, { backgroundColor: currentTheme.destructive }]} onPress={() => handleRejectRequest(item.username)} disabled={actionLoading[item.username]}>
         {actionLoading[item.username] ? <ActivityIndicator size="small" color={currentTheme.destructiveContrast} /> : <Icon name="close-outline" size={18} color={currentTheme.destructiveContrast} />}
      </TouchableOpacity>
    </>
  );

  const renderFriendCard = ({ item }: { item: Friend }) => renderUserCard(item,
    <TouchableOpacity style={[styles.actionButton, { backgroundColor: currentTheme.buttonSecondaryBackground }]} onPress={() => handleRemoveFriend(item.username)} disabled={actionLoading[item.username]}>
      {actionLoading[item.username] ? <ActivityIndicator size="small" color={currentTheme.buttonSecondaryText} /> : <Icon name="person-remove-outline" size={18} color={currentTheme.destructive} />}
    </TouchableOpacity>
  );

  const renderSearchResultCard = ({ item }: { item: Friend }) => {
    const isFriend = friends.some(u => u.username === item.username);
    const isSent = pendingOutgoing.some(u => u.username === item.username);
    const isReceived = pendingIncoming.some(u => u.username === item.username);
    const isLoading = actionLoading[item.username];

    let statusText = '';
    let statusColor = currentTheme.textSecondary;
    let actionButton: React.ReactNode = null;

    if (isFriend) {
        statusText = 'Friends';
        actionButton = (
             <TouchableOpacity style={[styles.actionButton, { backgroundColor: currentTheme.buttonSecondaryBackground }]} disabled={true} >
                <Icon name="checkmark-done-outline" size={18} color={currentTheme.success} />
            </TouchableOpacity>
        );
    } else if (isSent) {
        statusText = 'Request Sent';
        statusColor = currentTheme.info;
         actionButton = (
             <TouchableOpacity style={[styles.actionButton, { backgroundColor: currentTheme.destructive }]} onPress={() => handleCancelRequest(item.username)} disabled={isLoading} >
                {isLoading ? <ActivityIndicator size="small" color={currentTheme.destructiveContrast} /> : <Icon name="close-outline" size={18} color={currentTheme.destructiveContrast} />}
            </TouchableOpacity>
        );
    } else if (isReceived) {
        statusText = 'Friend Request Received';
        statusColor = currentTheme.info;
         actionButton = (
             <View style={{flexDirection: 'row', gap: styles.userActions.gap}}>
                 <TouchableOpacity style={[styles.actionButton, { backgroundColor: currentTheme.success }]} onPress={() => handleAcceptRequest(item.username)} disabled={isLoading} >
                    {isLoading ? <ActivityIndicator size="small" color={currentTheme.successContrast} /> : <Icon name="checkmark-outline" size={18} color={currentTheme.successContrast} />}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: currentTheme.destructive }]} onPress={() => handleRejectRequest(item.username)} disabled={isLoading} >
                    {isLoading ? <ActivityIndicator size="small" color={currentTheme.destructiveContrast} /> : <Icon name="close-outline" size={18} color={currentTheme.destructiveContrast} />}
                </TouchableOpacity>
             </View>
        );
    } else {
        actionButton = (
             <TouchableOpacity style={[styles.actionButton, { backgroundColor: currentTheme.accent }]} onPress={() => handleAddFriend(item.username)} disabled={isLoading} >
                {isLoading ? <ActivityIndicator size="small" color={currentTheme.accentContrast} /> : <Icon name="person-add-outline" size={18} color={currentTheme.accentContrast} />}
            </TouchableOpacity>
        );
    }

    return renderUserCard(item, actionButton, statusText, statusColor);
  };


  // Determine which data list and render function to use
  let currentData: Friend[] = [];
  let renderFunction: ({ item }: { item: Friend }) => JSX.Element | null;
  let emptyText = "No users found.";

  if (hasSearched) {
      currentData = searchResults;
      renderFunction = renderSearchResultCard;
      emptyText = searchLoading ? "Searching..." : "No users found matching your search.";
  } else {
      switch (activeSubTab) {
          case 'Requests':
              currentData = pendingIncoming;
              renderFunction = renderReceivedRequestCard;
              emptyText = "No pending friend requests.";
              break;
          case 'Friends':
          default:
              currentData = friends;
              renderFunction = renderFriendCard;
              emptyText = "You haven't added any friends yet.\nSearch to find friends!";
              break;
      }
  }


  // --- Main Render ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer]}>
          <View style={[styles.searchBar, { backgroundColor: currentTheme.inputBackground, borderColor: currentTheme.borderColor }]}>
              <Icon name="search-outline" size={18} color={currentTheme.textSecondary} style={{ marginRight: 6 }}/>
              <TextInput
                  style={[styles.searchInput, { color: currentTheme.textPrimary }]}
                  placeholder="Search users to add..."
                  placeholderTextColor={currentTheme.textSecondary}
                  value={searchUsername}
                  onChangeText={handleSearchTextChange}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setHasSearched(true)}
              />
              {searchLoading && <ActivityIndicator size="small" color={currentTheme.accent} style={{ marginLeft: 6 }}/>}
              {searchUsername.length > 0 && !searchLoading && (
                   <TouchableOpacity onPress={() => { handleSearchTextChange(''); Keyboard.dismiss(); }} style={{ padding: 4, marginLeft: 6 }}>
                      <Icon name="close-circle" size={18} color={currentTheme.textTertiary} />
                  </TouchableOpacity>
              )}
          </View>
      </View>

      {/* Content Area */}
      <View style={styles.contentWrapper}>
          {/* Sub Tabs (only show if not searching) */}
          {!hasSearched && (
              <View style={styles.subTabsContainer}>
                {(['Friends', 'Requests'] as SubTab[]).map(subtab => (
                  <TouchableOpacity
                    key={subtab}
                    style={[
                        styles.subTabButton,
                        activeSubTab === subtab && { borderBottomColor: currentTheme.subTabIndicator, borderBottomWidth: 2 }
                    ]}
                    onPress={() => handleSubTabChange(subtab)}
                  >
                    <Text style={[
                        styles.subTabText,
                        { color: activeSubTab === subtab ? currentTheme.subTabTextActive : currentTheme.subTabTextInactive },
                    ]}>
                      {subtab === 'Requests' && pendingIncoming.length > 0
                        ? `${subtab} (${pendingIncoming.length})`
                        : subtab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
          )}

          {/* List Area */}
          {loading && !refreshing ? (
               <View style={styles.feedbackContainer}>
                  <ActivityIndicator size="large" color={currentTheme.accent} />
               </View>
          ) : (
               <FlatList
                  ref={flatListRef}
                  data={currentData}
                  renderItem={renderFunction}
                  keyExtractor={(item) => item.username}
                  contentContainerStyle={styles.listContainer}
                  ListEmptyComponent={
                      searchLoading && hasSearched ? (
                           <View style={styles.feedbackContainer}>
                              <ActivityIndicator size="large" color={currentTheme.accent} />
                           </View>
                      ) : (
                           <View style={styles.feedbackContainer}>
                              <Icon name={hasSearched ? "search-outline" : (activeSubTab === 'Friends' ? "people-outline" : "mail-unread-outline")} size={40} color={currentTheme.textTertiary} />
                              <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>{emptyText}</Text>
                          </View>
                      )
                  }
                  refreshControl={
                      <RefreshControl
                          refreshing={refreshing}
                          onRefresh={onRefresh}
                          tintColor={currentTheme.accent}
                          colors={[currentTheme.accent]}
                      />
                  }
                  onScrollBeginDrag={Keyboard.dismiss}
                  keyboardShouldPersistTaps="handled"
              />
          )}
      </View>

       {/* In-App Message Display */}
       <InAppMessage
            visible={messageVisible}
            message={messageText}
            type={messageType}
            onClose={() => setMessageVisible(false)}
        />

       {/* Confirmation Modal for Removing Friend */}
       <Modal
            animationType="fade"
            transparent={true}
            visible={showConfirmRemoveDialog}
            onRequestClose={cancelRemoveFriend}
        >
            <View style={[styles.modalBackdrop, { backgroundColor: currentTheme.modalBackdrop }]}>
                <View style={[styles.modalContainer, { backgroundColor: currentTheme.modalBackground }]}>
                    <Text style={[styles.modalTitle, { color: currentTheme.textPrimary }]}>Remove Friend</Text>
                    <Text style={[styles.modalMessage, { color: currentTheme.textSecondary }]}>
                        Are you sure you want to remove {userToRemove} as a friend?
                    </Text>
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalCancelButton]}
                            onPress={cancelRemoveFriend}
                        >
                            <Text style={[styles.modalButtonText, { color: currentTheme.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: currentTheme.destructive }]}
                            onPress={confirmRemoveFriend}
                        >
                            <Text style={[styles.modalButtonText, { color: currentTheme.destructiveContrast }]}>Remove</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
       </Modal>

       <PublicProfileModal
                 visible={isProfileModalVisible}
                 onClose={() => {
                     setIsProfileModalVisible(false); // Hide the profile modal
                     setSelectedProfileUsername(null); // Clear selected user
                 }}
                 targetUsername={selectedProfileUsername} // Pass the username from state
              />

    </SafeAreaView>
  );
};

export default ConnectionsPage;

// ------------------------------------------------------
// STYLES (Complete)
// ------------------------------------------------------
const getStyles = (currentTheme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    searchContainer: {
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      paddingHorizontal: 10,
      height: 40,
      borderWidth: 1,
      borderColor: currentTheme.borderColor,
      backgroundColor: currentTheme.inputBackground,
    },
    searchInput: {
      flex: 1,
      fontSize: fontSizes.base,
      marginLeft: 6,
      color: currentTheme.textPrimary,
    },
    contentWrapper: {
      flex: 1,
    },
    subTabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: currentTheme.borderColor,
    },
    subTabButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    subTabText: {
      fontSize: fontSizes.base,
      fontWeight: '600',
    },
    listContainer: {
      paddingHorizontal: 16,
      paddingBottom: 80,
    },
    userCard: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: currentTheme.borderColor,
        },
        // --- ADDED STYLE for the touchable profile area ---
        userInfoTouchable: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1, // Allow it to take up space pushing actions to the right
          marginRight: 8, // Add some space before action buttons
        },
        // --- END ADDED STYLE ---
        profileImage: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: currentTheme.placeholder
        },
        userInfo: {
            // Removed flex: 1 from here, moved to TouchableOpacity
            marginLeft: 10,
            justifyContent: 'center',
        },
    userName: {
      fontSize: fontSizes.base,
      fontWeight: '600',
      color: currentTheme.textPrimary,
    },
    statusText: {
        fontSize: fontSizes.small,
        marginTop: 1,
        color: currentTheme.textSecondary,
    },
    userActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionButton: {
      padding: 6,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 36,
      minHeight: 36,
    },
    feedbackContainer: {
        flex: 1,
        paddingVertical: 30,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 150,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: fontSizes.base,
        marginTop: 8,
        color: currentTheme.textSecondary,
        lineHeight: fontSizes.base * 1.4,
    },
     retryButton: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: currentTheme.accent,
     },
     retryButtonText: {
      fontSize: fontSizes.button,
      fontWeight: '600',
      color: currentTheme.accent,
     },
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: currentTheme.modalBackdrop, // Use theme color
    },
    modalContainer: {
        width: '85%',
        maxWidth: 350,
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        backgroundColor: currentTheme.modalBackground, // Use theme color
    },
    modalTitle: {
        fontSize: fontSizes.large,
        fontWeight: 'bold',
        marginBottom: 10,
        color: currentTheme.textPrimary, // Use theme color
    },
    modalMessage: {
        fontSize: fontSizes.base,
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: fontSizes.base * 1.5,
        color: currentTheme.textSecondary, // Use theme color
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 5,
    },
    modalCancelButton: {
        backgroundColor: currentTheme.buttonSecondaryBackground,
        borderWidth: 1,
        borderColor: currentTheme.borderColor,
    },
    modalConfirmButton: {
        backgroundColor: currentTheme.destructive, // Use theme color
    },
    modalButtonText: {
        fontSize: fontSizes.button,
        fontWeight: '600',
        // color applied inline via theme
    },
  });
