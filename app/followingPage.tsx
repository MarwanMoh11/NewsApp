import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, FlatList, Alert, Image, TextInput , Platform} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomButton from '../components/ui/ChronicallyButton';
import RepostFeedPage from '../app/repostFeed';

const FollowingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Add Friends');
  var [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [follower, setFollower] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const router = useRouter();

const domaindynamo = 'https://keen-alfajores-31c262.netlify.app/.netlify/functions/index'


  useEffect(() => {
    fetchUsername();
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'Reposts') {
      router.push('/repostFeed');
    }
  };

  const handleUnfollow = async (followedUser: string) => {
      try {
        const response = await fetch(`${domaindynamo}/remove_follow_Users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_username: follower, followed_username: followedUser }),
        });

        const result = await response.json();

        if (response.ok) {
          setFollowedUsers((prevUsers) =>
            prevUsers.filter((user) => user.username !== followedUser)
          );
          router.push('/followingPage');
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
      try {
        const response = await fetch(`${domaindynamo}/follow_Users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_username: follower, followed_username: followedUser }),
        });

        const result = await response.json();

        if (response.ok) {
          setFollowedUsers((prevUsers) =>
            prevUsers.filter((user) => user.username !== followedUser)
          );
          router.push('/followingPage');
          Alert.alert('Success', `You have followed ${followedUser}.`);
        } else {
          Alert.alert('Error', result.message || 'Failed to follow the user.');
        }
      } catch (error) {
        console.error('Error following user:', error);
        Alert.alert('Error', 'Something went wrong. Please try again later.');
      }
    };




    const searchUser = async (query: string) => {
      if (query.length === 0) {
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
        console.log('Search API response:', data); // Debug log
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
    try {
      const response = await fetch(`${domaindynamo}/get-username`);
      const data = await response.json();
      if (data.username) {
        setFollower(data.username);
        fetchContent(data.username);
      } else {
        setFollower('');
        setFollowedUsers([]);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setFollowedUsers([]);
    }
  };

  const fetchContent = async (user: string) => {
    try {
      const followingResponse = await fetch(`${domaindynamo}/get_followed_users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_username: user }),
      });

      const followedUsers = await followingResponse.json();
      setFollowedUsers(followedUsers.followedUsernames || []);
      console.log('FOLLOWEDUSERS:',followedUsers.followedUsernames);
    } catch (error) {
      console.error('Error fetching content:', error);
      setFollowedUsers([]);
    }
  };

  const renderFollowedCard = ({ item }: {item: string}) => {
    return (
      <View style={styles.followedCard}>
        <View style={styles.cardContent}>
          <Ionicons name="person" size={30} style={styles.userIcon} />
          <Text style={styles.userName}>{item}</Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => handleUnfollow(item)}
        >
          <Ionicons name="close" size={20} style={styles.closeIcon} />
        </TouchableOpacity>
      </View>
    );
  };




  const [isButtonVisible, setIsButtonVisible] = useState(true);

  const handleHomePress = () => {
    console.log(router.push('/mynews'));
  };

  const handleBookmarkPress = () => {
    router.push('/savedArticles');
  };

  const handleAddressBookPress = () => {
      router.push('/followingPage');
  };

  const handleSearchPress = () => {
    router.push('/searchPage');
  };

return (
  <View style={styles.container}>
    <View style={styles.header}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'Add Friends' && styles.activeTabButton]}
          onPress={() => setActiveTab('Add Friends')}
        >
          <Text style={[styles.tabText, activeTab === 'Add Friends' && styles.activeTabText]}>
            Add Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'Reposts' && styles.activeTabButton]}
          onPress={() => setActiveTab('Reposts')}
        >
          <Text style={[styles.tabText, activeTab === 'Reposts' && styles.activeTabText]}>
            Reposts
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsIcon}>
        <Icon name="settings-outline" size={24} color="#888" />
      </TouchableOpacity>
    </View>

    {activeTab === 'Reposts' ? (
      <RepostFeedPage />
    ) : (
      <>
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
          />
          <TouchableOpacity style={styles.followButton} onPress={() => searchUser(searchUsername)}>
            <Text style={styles.followButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {isButtonPressed && errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {searchUsername.length > 0 && (
          <View style={styles.searchResultsContainer}>
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.username}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => handleFollow(item)}>
                    <Text style={styles.searchResultText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={styles.searchResultText}>No results found</Text>
            )}
          </View>
        )}

        <FlatList
          data={followedUsers}
          renderItem={renderFollowedCard}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.contentContainer}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>
              You are not currently following any users.
            </Text>
          }
        />
      </>
    )}

    <CustomButton
      barButtons={[
        { iconName: 'home', onPress: handleHomePress },
        { iconName: 'bookmark', onPress: handleBookmarkPress },
        { iconName: 'address-book', onPress: handleAddressBookPress },
        { iconName: 'search', onPress: handleSearchPress },
      ]}
    />
  </View>
);
};


export default FollowingPage;

const styles = StyleSheet.create({
  logoImage: {
    width: 300,
    height: 100,
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 10,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flex: 1,
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
    position: 'absolute',
    right: 20,
  },
  followedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    position: 'relative',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 5,
  },
  userIcon: {
    marginRight: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  closeIcon: {
    color: 'red',
  },
  contentContainer: {
    padding: 10,
    paddingBottom: 80,
    backgroundColor: '#f9f9f9',
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
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
    color: '#000',
  },
  followButton: {
    marginLeft: 10,
    backgroundColor: '#A1A0FE',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginTop: 5,
    marginLeft: 20,
    fontSize: 14,
  },
  searchResultsContainer: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: '#fff',
  },
  searchResultText: {
    padding: 10,
    fontSize: 16,
    color: '#000',
  },
});