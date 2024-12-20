// pages/FollowingPage.tsx

import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
  Platform
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

  const { userToken } = useContext(UserContext); // Access the token

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
      <View style={styles.followedCard}>
        <View style={styles.cardContent}>
          <Ionicons name="person" size={30} style={styles.userIcon} />
          <Text style={styles.userName}>{item}</Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => handleUnfollow(item)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Unfollow ${item}`}
        >
          <Ionicons name="close" size={20} style={styles.closeIcon} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <BackButton />

      {/* Header with Tabs and Settings Icon */}
      <View style={styles.header}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Add Friends' && styles.activeTabButton]}
            onPress={() => handleTabChange('Add Friends')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add Friends Tab"
          >
            <Text style={[styles.tabText, activeTab === 'Add Friends' && styles.activeTabText]}>
              Add Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'Reposts' && styles.activeTabButton]}
            onPress={() => handleTabChange('Reposts')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reposts Tab"
          >
            <Text style={[styles.tabText, activeTab === 'Reposts' && styles.activeTabText]}>
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
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a user"
              placeholderTextColor="#888"
              value={searchUsername}
              onChangeText={(text) => {
                setSearchUsername(text);
                searchUser(text); // Trigger search when text changes
              }}
              accessible={true}
              accessibilityLabel="Search for a user"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => searchUser(searchUsername)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Search Button"
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {/* Search Results */}
          {searchUsername.trim().length > 0 && (
            <View style={styles.searchResultsContainer}>
              {searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => handleFollow(item)} style={styles.searchResultItem} accessible={true} accessibilityRole="button" accessibilityLabel={`Follow ${item}`}>
                      <Text style={styles.searchResultText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text style={styles.noResultsText}>No results found</Text>
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
              <Text style={styles.noContent}>You are not currently following any users.</Text>
            }
            accessible={true}
            accessibilityLabel="List of followed users"
          />
        </>
      )}
    </View>
  );
};

export default FollowingPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20, // Adjust for status bar
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabsContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
  },
  tabButton: {
    marginHorizontal: 20,
    paddingBottom: 5,
  },
  tabText: {
    fontSize: 18,
    color: '#888',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#A1A0FE',
  },
  activeTabText: {
    color: '#333',
    fontWeight: 'bold',
  },
  settingsIcon: {
    // Positioned via header's justifyContent
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
    paddingHorizontal: 20,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
    color: '#000',
  },
  searchButton: {
    marginLeft: 10,
    backgroundColor: '#A1A0FE',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginHorizontal: 20,
    marginTop: 5,
    fontSize: 14,
  },
  searchResultsContainer: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 5,
    marginHorizontal: 20,
    marginTop: 5,
    backgroundColor: '#fff',
  },
  searchResultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  searchResultText: {
    fontSize: 16,
    color: '#000',
  },
  noResultsText: {
    padding: 10,
    fontSize: 16,
    color: '#888',
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
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    color: '#000000',
  },
  userIcon: {
    marginRight: 10,
    color: '#6C63FF',
  },
  closeButton: {
    // Positioned at the end
  },
  closeIcon: {
    color: 'red',
  },
  noContent: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888',
    marginTop: 20,
  },
});
