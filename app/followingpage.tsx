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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RepostFeedPage from '../app/repostfeed';
import { UserContext } from '../app/UserContext';
import BackButton from '../components/ui/BackButton';

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const FollowingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Add Friends');
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const router = useRouter();

  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext); // Consume isDarkTheme

  useEffect(() => {
    if (userToken) {
      fetchUsername();
    }
  }, [userToken]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const handleUnfollow = async (followedUser: string) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to unfollow users.');
      return;
    }
    try {
      const response = await fetch(`${domaindynamo}/remove_follow_Users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: username, followed_username: followedUser }),
      });

      const result = await response.json();

      if (response.ok) {
        setFollowedUsers((prevUsers) =>
          prevUsers.filter((user) => user !== followedUser)
        );
        Alert.alert('Success', `You have unfollowed ${followedUser}.`);
      } else {
        Alert.alert('Error', result.message || 'Failed to unfollow the user.');
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  const handleFollow = async (followedUser: string) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to follow users.');
      return;
    }
    try {
      const response = await fetch(`${domaindynamo}/follow_Users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: username, followed_username: followedUser }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success', `You have followed ${followedUser}.`);
        // Optionally refresh the followed list after following
        fetchFollowedUsers(username);
      } else {
        Alert.alert('Error', result.message || 'Failed to follow the user.');
      }
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Something went wrong. Please try again later.');
    }
  };

  const searchUser = async (query: string) => {
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/get-similar_users_searched`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: query }),
      });

      const data = await response.json();
      console.log('Search API response:', data);
      if (data.status === 'Success' && Array.isArray(data.similar_users)) {
        setSearchResults(data.similar_users);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setErrorMessage('Failed to search for users.');
      setSearchResults([]);
    }
  };

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
        // Once we have the username, we fetch followed users.
        setUsername(data.username);
        fetchFollowedUsers(data.username);
      } else {
        setFollowedUsers([]);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setFollowedUsers([]);
    }
  };

  const fetchFollowedUsers = async (username: string) => {
    if (!userToken) return;
    try {
      const followingResponse = await fetch(`${domaindynamo}/get_followed_users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: username }),
      });

      const result = await followingResponse.json();
      if (result.status === 'Success' && Array.isArray(result.followedUsernames)) {
        setFollowedUsers(result.followedUsernames);
      } else {
        setFollowedUsers([]);
      }
    } catch (error) {
      console.error('Error fetching followed users:', error);
      setFollowedUsers([]);
    }
  };

  const renderFollowedCard = ({ item }: { item: string }) => {
    return (
      <View
        style={[
          styles.followedCard,
          {
            backgroundColor: isDarkTheme ? '#1F2937' : '#f9f9f9',
            borderColor: isDarkTheme ? '#374151' : '#E0E0E0',
          },
        ]}
      >
        <View style={styles.cardContent}>
          <Ionicons
            name="person"
            size={30}
            style={[
              styles.userIcon,
              { color: isDarkTheme ? '#BB9CED' : '#6C63FF' },
            ]}
          />
          <Text
            style={[
              styles.userName,
              { color: isDarkTheme ? '#F3F4F6' : '#333333' },
            ]}
          >
            {item}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => handleUnfollow(item)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Unfollow ${item}`}
        >
          <Ionicons
            name="close"
            size={20}
            style={[
              styles.closeIcon,
              { color: isDarkTheme ? '#F87171' : 'red' },
            ]}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkTheme ? '#111827' : '#FFFFFF' },
      ]}
    >
      {/* Back Button */}
      <BackButton />

      {/* Header with Tabs */}
      <View
        style={[
          styles.header,
          { borderBottomColor: isDarkTheme ? '#374151' : '#E0E0E0' },
        ]}
      >
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'Add Friends' && styles.activeTabButton,
              activeTab === 'Add Friends' && {
                borderBottomColor: '#A1A0FE',
              },
            ]}
            onPress={() => handleTabChange('Add Friends')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add Friends Tab"
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'Add Friends' && styles.activeTabText,
                activeTab === 'Add Friends' && { color: '#A1A0FE' },
                activeTab !== 'Add Friends' && { color: '#888888' },
              ]}
            >
              Add Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'Reposts' && styles.activeTabButton,
              activeTab === 'Reposts' && {
                borderBottomColor: '#A1A0FE',
              },
            ]}
            onPress={() => handleTabChange('Reposts')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reposts Tab"
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'Reposts' && styles.activeTabText,
                activeTab === 'Reposts' && { color: '#A1A0FE' },
                activeTab !== 'Reposts' && { color: '#888888' },
              ]}
            >
              Reposts
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Based on Active Tab */}
      {activeTab === 'Reposts' ? (
        <RepostFeedPage />
      ) : (
        <>
          {/* Search Bar */}
          <View
            style={[
              styles.searchBarContainer,
              {
                backgroundColor: isDarkTheme ? '#374151' : '#F5F5F5',
                borderColor: isDarkTheme ? '#374151' : '#CCC',
              },
            ]}
          >
            <TextInput
              style={[
                styles.searchInput,
                { color: isDarkTheme ? '#F3F4F6' : '#000000' },
              ]}
              placeholder="Search for a user"
              placeholderTextColor={isDarkTheme ? '#D1D5DB' : '#888888'}
              value={searchUsername}
              onChangeText={(text) => {
                setSearchUsername(text);
                searchUser(text); // Trigger search when text changes
              }}
              accessible={true}
              accessibilityLabel="Search for a user"
            />
            <TouchableOpacity
              style={[
                styles.searchButton,
                { backgroundColor: '#A1A0FE' },
              ]}
              onPress={() => searchUser(searchUsername)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Search Button"
            >
              <Text style={[styles.searchButtonText, { color: '#FFFFFF' }]}>
                Search
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <Text
              style={[
                styles.errorText,
                { color: isDarkTheme ? '#F87171' : 'red' },
              ]}
            >
              {errorMessage}
            </Text>
          ) : null}

          {/* Search Results */}
          {searchUsername.trim().length > 0 && (
            <View
              style={[
                styles.searchResultsContainer,
                {
                  backgroundColor: isDarkTheme ? '#1F2937' : '#FFFFFF',
                  borderColor: isDarkTheme ? '#374151' : '#CCC',
                },
              ]}
            >
              {searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleFollow(item)}
                      style={[
                        styles.searchResultItem,
                        {
                          borderBottomColor: isDarkTheme ? '#374151' : '#EEE',
                        },
                      ]}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Follow ${item}`}
                    >
                      <Text
                        style={[
                          styles.searchResultText,
                          { color: isDarkTheme ? '#F3F4F6' : '#000000' },
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text
                  style={[
                    styles.noResultsText,
                    { color: isDarkTheme ? '#D1D5DB' : '#888888' },
                  ]}
                >
                  No results found
                </Text>
              )}
            </View>
          )}

          {/* List of Followed Users */}
          <FlatList
            data={followedUsers}
            renderItem={renderFollowedCard}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.followedListContainer}
            ListEmptyComponent={
              <Text
                style={[
                  styles.noContent,
                  { color: isDarkTheme ? '#D1D5DB' : '#888888' },
                ]}
              >
                You are not currently following any users.
              </Text>
            }
            accessible={true}
            accessibilityLabel="List of followed users"
            style={{ backgroundColor: isDarkTheme ? '#111827' : '#FFFFFF' }}
          />
        </>
      )}
    </View>
  );
};

export default FollowingPage;

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative', // Ensure that absolutely positioned children are relative to this container
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center', // Center the tabs
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20, // Adjust for status bar
    paddingBottom: 10,
    borderBottomWidth: 1,
    // borderBottomColor handled dynamically
  },
  tabsContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
  },
  tabButton: {
    marginHorizontal: 20,
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent', // Default transparent border
  },
  tabText: {
    fontSize: 18,
    color: '#888888', // Default secondary text color
  },
  activeTabButton: {
    // Additional styles if needed
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 20,
    // backgroundColor and borderColor handled dynamically
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 15,
    fontSize: 16,
    borderRadius: 20,
    // color handled dynamically
  },
  searchButton: {
    marginLeft: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#A1A0FE', // Accent color
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF', // White text
  },
  errorText: {
    marginHorizontal: 20,
    marginTop: 5,
    fontSize: 14,
    color: 'red', // Default red color, overridden dynamically
  },
  searchResultsContainer: {
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 5,
    marginHorizontal: 20,
    marginTop: 5,
    backgroundColor: '#FFFFFF', // Default white, overridden dynamically
    borderColor: '#CCC', // Default border, overridden dynamically
  },
  searchResultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE', // Default border, overridden dynamically
  },
  searchResultText: {
    fontSize: 16,
    color: '#000000', // Default black, overridden dynamically
  },
  noResultsText: {
    padding: 10,
    fontSize: 16,
    color: '#888888', // Default gray, overridden dynamically
  },
  followedListContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  followedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9', // Default background, overridden dynamically
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0', // Default border, overridden dynamically
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    fontSize: 16,
    color: '#333333', // Default text color, overridden dynamically
  },
  userIcon: {
    marginRight: 10,
    color: '#6C63FF', // Default icon color, overridden dynamically
  },
  closeButton: {
    // Positioned at the end
  },
  closeIcon: {
    color: 'red', // Default red color, overridden dynamically
  },
  noContent: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888888', // Default gray, overridden dynamically
    marginTop: 20,
  },
});
