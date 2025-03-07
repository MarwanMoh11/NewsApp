// ------------------------------------------------------
// pages/FollowingPage.tsx
// ------------------------------------------------------
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RepostFeedPage from '../app/repostfeed';
import { UserContext } from '../app/UserContext';


const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const { width } = Dimensions.get('window');

// Define Friend type
interface Friend {
  username: string;
  profile_picture: string;
}

type FriendsSubTab = 'Received' | 'Sent' | 'Accepted';

const FollowingPage: React.FC = () => {
  // Main tabs: "Friends" and "Reposts"
  const [activeTab, setActiveTab] = useState<'Friends' | 'Reposts'>('Friends');
  // Friends sub-tabs (when no search is active)
  const [activeSubTab, setActiveSubTab] = useState<FriendsSubTab>('Received');

  // Data lists
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<Friend[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<Friend[]>([]);

  // Search-related state (when user types, the whole view shows search results)
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Request loading tracker
  const [followRequestLoading, setFollowRequestLoading] = useState<{ [key: string]: boolean }>({});

  // Current user info and overall loading state
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const router = useRouter();
  const { userToken, isDarkTheme } = useContext(UserContext);
  const styles = getStyles(isDarkTheme);


  // ---------------------------
  // Helper: fetch user profile picture by username
  // ---------------------------
  const fetchUserProfilePicture = async (user: string): Promise<string> => {
    try {
      const response = await fetch(
        `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(user)}`
      );
      const data = await response.json();
      if (data.status === 'Success' && data.profile_picture) {
        return data.profile_picture;
      } else {
        return 'https://via.placeholder.com/50?text=User';
      }
    } catch (error) {
      console.error(`Error fetching profile picture for ${user}:`, error);
      return 'https://via.placeholder.com/50?text=User';
    }
  };

  // ---------------------------
  // Initialization
  // ---------------------------
  useEffect(() => {
    if (userToken) {
      fetchUsername();
    }
  }, [userToken]);

  useEffect(() => {
    if (username) {
      refreshAll();
    }
  }, [username]);

  // Refresh function for live updates
  const refreshAll = async () => {
    await Promise.all([
      fetchFriends(username),
      fetchIncomingRequests(username),
      fetchOutgoingRequests(username),
    ]);
    setLoading(false);
  };

  const handleTabChange = (tab: 'Friends' | 'Reposts') => {
    setActiveTab(tab);
    // Reset search whenever switching main tab
    if (tab === 'Friends') {
      setSearchUsername('');
      setSearchResults([]);
    }
  };

  const handleSubTabChange = (subTab: FriendsSubTab) => {
    setActiveSubTab(subTab);
  };

  // ---------------------------
  // API Call Helpers
  // ---------------------------
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
        setErrorMessage('Unable to retrieve your username.');
        setFriends([]);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setErrorMessage('Error retrieving username.');
      setFriends([]);
    }
  };

  const fetchFriends = async (user: string) => {
    try {
      const responseFollowed = await fetch(`${domaindynamo}/get_followed_users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: user }),
      });
      const dataFollowed = await responseFollowed.json();
      let following: string[] = [];
      if (dataFollowed.status === 'Success' && Array.isArray(dataFollowed.followedUsernames)) {
        following = dataFollowed.followedUsernames;
      }

      const responseFollowers = await fetch(`${domaindynamo}/get_followers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followed_username: user }),
      });
      const dataFollowers = await responseFollowers.json();
      let followers: string[] = [];
      if (dataFollowers.status === 'Success' && Array.isArray(dataFollowers.followerUsernames)) {
        followers = dataFollowers.followerUsernames;
      }

      const union = Array.from(new Set([...following, ...followers]));

      const friendList: Friend[] = await Promise.all(
        union.map(async (uname: string) => ({
          username: uname,
          profile_picture: await fetchUserProfilePicture(uname),
        }))
      );
      setFriends(friendList);
    } catch (error) {
      console.error('Error fetching friends:', error);
      setFriends([]);
    }
  };

  const fetchIncomingRequests = async (user: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get_pending_users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followed_username: user }),
      });
      const data = await response.json();
      if (data.status === 'Success' && Array.isArray(data.pendingUsernames)) {
        const incoming: Friend[] = await Promise.all(
          data.pendingUsernames.map(async (uname: string) => ({
            username: uname,
            profile_picture: await fetchUserProfilePicture(uname),
          }))
        );
        setPendingIncoming(incoming);
      } else {
        setPendingIncoming([]);
      }
    } catch (error) {
      console.error('Error fetching incoming requests:', error);
      setPendingIncoming([]);
    }
  };

  const fetchOutgoingRequests = async (user: string) => {
    try {
      const response = await fetch(`${domaindynamo}/get_outgoing_pending_requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: user }),
      });
      const data = await response.json();
      if (data.status === 'Success' && Array.isArray(data.pendingFollowRequests)) {
        const requests: Friend[] = await Promise.all(
          data.pendingFollowRequests.map(async (uname: string) => ({
            username: uname,
            profile_picture: await fetchUserProfilePicture(uname),
          }))
        );
        setPendingOutgoing(requests);
      } else {
        setPendingOutgoing([]);
      }
    } catch (error) {
      console.error('Error fetching outgoing requests:', error);
      setPendingOutgoing([]);
    }
  };

  // ---------------------------
  // Action Handlers
  // ---------------------------
  const handleAddFriend = async (newFriendUsername: string) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to add friends.');
      return;
    }
    if (
      friends.some(friend => friend.username === newFriendUsername) ||
      pendingOutgoing.some(u => u.username === newFriendUsername)
    ) {
      Alert.alert('Info', 'You are already connected or your request is pending.');
      return;
    }
    if (followRequestLoading[newFriendUsername]) return;

    setFollowRequestLoading(prev => ({ ...prev, [newFriendUsername]: true }));
    try {
      const response = await fetch(`${domaindynamo}/follow_Users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower_username: username,
          followed_username: newFriendUsername,
        }),
      });
      const result = await response.json();
      if (response.ok && result.status === 'Success') {
        Alert.alert('Success', `Friend request sent to ${newFriendUsername}.`);
        await fetchOutgoingRequests(username);
      } else {
        Alert.alert('Error', result.message || 'Failed to send friend request.');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    } finally {
      setFollowRequestLoading(prev => ({ ...prev, [newFriendUsername]: false }));
    }
  };

  const handleCancelRequest = async (friendUsername: string) => {
    try {
      const response = await fetch(`${domaindynamo}/cancel_follow_request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower_username: username,
          followed_username: friendUsername,
        }),
      });
      const result = await response.json();
      if (response.ok && result.status === 'Success') {
        Alert.alert('Cancelled', `Your friend request to ${friendUsername} has been cancelled.`);
        await fetchOutgoingRequests(username);
      } else {
        Alert.alert('Error', result.message || 'Failed to cancel friend request.');
      }
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  const handleAcceptRequest = async (requestingUser: string) => {
    try {
      const response = await fetch(`${domaindynamo}/accept_follow_request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower_username: requestingUser,
          followed_username: username,
        }),
      });
      const result = await response.json();
      if (response.ok && result.status === 'Success') {
        Alert.alert('Success', `You have accepted ${requestingUser}'s request.`);
        await refreshAll();
      } else {
        Alert.alert('Error', result.message || 'Failed to accept friend request.');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  const handleRejectRequest = async (requestingUser: string) => {
    try {
      const response = await fetch(`${domaindynamo}/reject_follow_request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower_username: requestingUser,
          followed_username: username,
        }),
      });
      const result = await response.json();
      if (response.ok && result.status === 'Success') {
        Alert.alert('Rejected', `You have rejected ${requestingUser}'s request.`);
        await fetchIncomingRequests(username);
      } else {
        Alert.alert('Error', result.message || 'Failed to reject friend request.');
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  const handleRemoveFriend = async (friendUsername: string) => {
    try {
      const response1 = await fetch(`${domaindynamo}/remove_follow_Users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower_username: username,
          followed_username: friendUsername,
        }),
      });
      const response2 = await fetch(`${domaindynamo}/remove_follow_Users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follower_username: friendUsername,
          followed_username: username,
        }),
      });
      if (response1.ok || response2.ok) {
        Alert.alert('Removed', `You have removed ${friendUsername} as a friend.`);
        await refreshAll();
      } else {
        Alert.alert('Error', 'Failed to remove friend.');
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  // ---------------------------
  // Search Functionality
  // ---------------------------
  const searchUser = async (query: string) => {
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await fetch(`${domaindynamo}/get-similar_users_searched`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: query }),
      });
      const data = await response.json();
      if (data.status === 'Success' && Array.isArray(data.similar_users)) {
        const results: Friend[] = await Promise.all(
          data.similar_users.map(async (uname: string) => ({
            username: uname,
            profile_picture: await fetchUserProfilePicture(uname),
          }))
        );
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setErrorMessage('Failed to search for users.');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // ---------------------------
  // Rendering Helpers for Friend Cards
  // ---------------------------
  const renderReceivedRequestCard = ({ item }: { item: Friend }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Image source={{ uri: item.profile_picture }} style={styles.profileImage} />
        <Text style={styles.userName}>{item.username}</Text>
      </View>
      <View style={styles.actionGroup}>
        <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => handleAcceptRequest(item.username)}>
          <Ionicons name="checkmark" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => handleRejectRequest(item.username)}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSentRequestCard = ({ item }: { item: Friend }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Image source={{ uri: item.profile_picture }} style={styles.profileImage} />
        <Text style={styles.userName}>{item.username}</Text>
        <Text style={styles.pendingText}>Pending</Text>
      </View>
      <View style={styles.actionGroup}>
        <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => handleCancelRequest(item.username)}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Compute accepted friends from friends list minus pending
  const acceptedFriends = friends.filter(
    friend =>
      !pendingIncoming.some(u => u.username === friend.username) &&
      !pendingOutgoing.some(u => u.username === friend.username)
  );

  const renderFriendCard = ({ item }: { item: Friend }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Image source={{ uri: item.profile_picture }} style={styles.profileImage} />
        <Text style={styles.userName}>{item.username}</Text>
      </View>
      <View style={styles.actionGroup}>
        <TouchableOpacity style={[styles.actionButton, styles.removeButton]} onPress={() => handleRemoveFriend(item.username)}>
          <Ionicons name="trash" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResultCard = ({ item }: { item: Friend }) => {
    const isSent = pendingOutgoing.some(u => u.username === item.username);
    const isFriend = acceptedFriends.some(u => u.username === item.username);
    const isReceived = pendingIncoming.some(u => u.username === item.username);
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Image source={{ uri: item.profile_picture }} style={styles.profileImage} />
          <Text style={styles.userName}>{item.username}</Text>
        </View>
        {(isFriend || isSent || isReceived) ? (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#7F8C8D' }]} disabled>
            {isSent ? (
              <Ionicons name="time-outline" size={24} color="#fff" />
            ) : (
              <Ionicons name="person" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#2980B9' }]} onPress={() => handleAddFriend(item.username)} disabled={followRequestLoading[item.username]}>
            {followRequestLoading[item.username] ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="person-add" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ---------------------------
  // Main Render
  // ---------------------------
  return (
    <View style={[styles.container, { backgroundColor: isDarkTheme ? '#121212' : '#F7F9FA' }]}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={async () => {
              setLoading(true);
              await refreshAll();
            }}
            colors={['#6C63FF']}
            tintColor={isDarkTheme ? '#121212' : '#2C3E50'}
          />
        }
      >

        {/* Main Tabs */}
        <View style={styles.tabsWrapper}>
          <View style={styles.tabsContainer}>
            {(['Friends', 'Reposts'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
                onPress={() => handleTabChange(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {activeTab === 'Reposts' ? (
          <RepostFeedPage />
        ) : (
          <View style={styles.contentWrapper}>
            {searchUsername.trim().length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Search Results</Text>
                {searchLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6C63FF" />
                    <Text style={styles.loadingText}>Searching...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.username}
                    renderItem={renderSearchResultCard}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
                  />
                )}
              </View>
            ) : (
              <View>
                {/* Friends Subtabs */}
                <View style={styles.subTabsContainer}>
                  {(['Received', 'Sent', 'Accepted'] as FriendsSubTab[]).map(subtab => (
                    <TouchableOpacity
                      key={subtab}
                      style={[styles.subTabButton, activeSubTab === subtab && styles.activeSubTabButton]}
                      onPress={() => handleSubTabChange(subtab)}
                    >
                      <Text style={[styles.subTabText, activeSubTab === subtab && styles.activeSubTabText]}>
                        {subtab}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {activeSubTab === 'Received' && (
                  <FlatList
                    data={pendingIncoming}
                    renderItem={renderReceivedRequestCard}
                    keyExtractor={(item) => item.username}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No received requests.</Text>}
                  />
                )}
                {activeSubTab === 'Sent' && (
                  <FlatList
                    data={pendingOutgoing}
                    renderItem={renderSentRequestCard}
                    keyExtractor={(item) => item.username}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No sent requests.</Text>}
                  />
                )}
                {activeSubTab === 'Accepted' && (
                  <FlatList
                    data={acceptedFriends}
                    renderItem={renderFriendCard}
                    keyExtractor={(item) => item.username}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No friends yet. Search and add some!</Text>}
                  />
                )}
              </View>
            )}

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a user..."
                placeholderTextColor={isDarkTheme ? '#A0A0A0' : '#95A5A6'}
                value={searchUsername}
                onChangeText={(text) => {
                  setSearchUsername(text);
                  searchUser(text);
                }}
              />
            </View>
          </View>
        )}


      </ScrollView>
    </View>
  );
};

export default FollowingPage;

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const getStyles = (isDarkTheme: boolean) =>
StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  tabsWrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
     borderColor: isDarkTheme ? '#374151' : '#CED6E0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: isDarkTheme ? '#1C1C1E' : '#F1F2F6',
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#1E90FF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkTheme ? '#D1D5DB' : '#57606F',
  },
  activeTabText: {
    color: '#fff',
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    color: isDarkTheme ? '#F3F4F6' : '#2F3542',
  },
  subTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: isDarkTheme ? '#1C1C1E' : '#F1F2F6',
    borderRadius: 20,
    marginBottom: 12,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeSubTabButton: {
    backgroundColor: '#1E90FF',
    borderRadius: 20,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDarkTheme ? '#D1D5DB' : '#57606F',
  },
  activeSubTabText: {
    color: '#fff',
  },
  listContainer: {
    paddingBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: isDarkTheme ? '#1C1C1E' : '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#1E90FF',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    color: isDarkTheme ? '#F3F4F6' : '#2F3542',
  },
  pendingText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginLeft: 8,
    color: '#F39C12',
  },
  actionGroup: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  actionButton: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#28A745',
  },
  rejectButton: {
    backgroundColor: '#DC3545',
  },
  removeButton: {
    backgroundColor: '#DC3545',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
     borderColor: isDarkTheme ? '#374151' : '#CED6E0',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 44,
    marginTop: 12,
    backgroundColor: isDarkTheme ? '#1C1C1E' : '#fff',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: isDarkTheme ? '#D1D5DB' : '#2F3542',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  loadingText: {
    fontSize: 16,
    marginLeft: 8,
    color: isDarkTheme ? '#D1D5DB' : '#57606F',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 8,
    fontStyle: 'italic',
    color: isDarkTheme ? '#D1D5DB' : '#57606F',
  },
  sliderWrapper: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: isDarkTheme ? '#D1D5DB' : '#2F3542',
  },
  sliderContainer: {
    height: 20,
    width: 200,
    backgroundColor: isDarkTheme ? '#374151' : '#CED6E0',
    backgroundColor: '#CED6E0',
    borderRadius: 10,
    position: 'relative',
    alignSelf: 'flex-end',
  },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    width: 200,
    height: 20,
  },
  sliderKnob: {
    position: 'absolute',
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF4757',
  },
});

