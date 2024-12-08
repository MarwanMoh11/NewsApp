import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Linking,
  Platform,
  FlatList,
  TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust the path as needed

const domaindynamo = 'https://keen-alfajores-31c262.netlify.app/.netlify/functions/index';

const TweetPage: React.FC = () => {
  const [tweetData, setTweetData] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [comment, setComment] = useState('');
  const [allComments, setAllComments] = useState([]);
  const router = useRouter();
  const { userToken } = useContext(UserContext);

  useEffect(() => {
    if (userToken) {
      getTweet();
      fetchUsername();
    }
  }, [userToken]);

  useEffect(() => {
    if (tweetData) {
      fetchComments();
    }
  }, [tweetData]);

  const fetchUsername = async () => {
    if (!userToken) return;
    try {
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken })
      });
      const data = await response.json();
      if (data.status === 'Success' && data.username) {
        setUsername(data.username);
      } else {
        setUsername('');
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setUsername('Guest');
    }
  };

  const getTweet = async () => {
    if (!userToken) return;
    try {
      const response = await fetch(`${domaindynamo}/get-tweettodisp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken })
      });
      const data = await response.json();
      if (data.status === 'Success') {
        setTweetData(data.data);
      } else {
        Alert.alert('Error', 'No tweet data found');
      }
    } catch (error) {
      console.error('Error fetching tweet data:', error);
      Alert.alert('Error', 'Unable to fetch tweet data');
    }
  };

  const fetchComments = async () => {
    if (!userToken || !tweetData) return;
    try {
      const response = await fetch(`${domaindynamo}/get_comments_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, tweet_link: tweetData.Tweet_Link })
      });

      const data = await response.json();

      if (response.ok && data.status === 'Success') {
        setAllComments(data.data);
      } else {
        setAllComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setAllComments([]);
    }
  };

  const handleShare = async (tweetLink: string) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to share tweets.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/share_tweets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: userToken, tweet_link: tweetLink }),
      });

      const data = await response.json();
      if (data.status === 'Success') {
        Platform.OS === 'web'
          ? alert('Tweet shared successfully!')
          : Alert.alert('Success', 'Tweet shared successfully!');
      } else {
        Platform.OS === 'web'
          ? alert('Unable to share tweet')
          : Alert.alert('Error', 'Unable to share tweet');
      }
    } catch (error) {
      console.error('Error sharing tweet', error);
      Alert.alert('Error', 'Unable to share tweet');
    }
  };

  const handleMediaPress = (tweetLink: string) => {
    Linking.openURL(tweetLink).catch((err) =>
      Alert.alert('Error', 'Failed to open tweet.')
    );
  };

  const handleSave = async (tweetLink: string) => {
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to save tweets.');
      return;
    }

    const response = await fetch(`${domaindynamo}/save-tweets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: userToken, tweet_link: tweetLink }),
    });

    const data = await response.json();
    if (response.ok && data.status === 'Success') {
      Platform.OS === 'web'
        ? alert('Tweet saved successfully!')
        : Alert.alert('Success', 'Tweet saved successfully!');
    } else {
      Platform.OS === 'web'
        ? alert('Error: Tweet could not be saved')
        : Alert.alert('Error', 'Tweet could not be saved');
    }
  };

  const postComment = async (comment: string) => {
    if (!userToken || !tweetData) {
      Alert.alert('Error', 'You must be logged in and have a tweet loaded to comment.');
      return;
    }

    try {
      const response = await fetch(`${domaindynamo}/comment_tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({username: username,tweet_link: tweetData.Tweet_Link, content: comment, parent_comment_id: null }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.status === 'Success') {
        if (Platform.OS === 'web') {
          alert('Success: Comment has been posted');
          router.push('/tweetpage');
        } else {
          Alert.alert('Success', 'Comment has been posted');
        }
        // Refresh comments
        setComment('');
        fetchComments();
      } else {
        Platform.OS === 'web'
          ? alert('Error: could not post comment')
          : Alert.alert('Error', 'Could not post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      Platform.OS === 'web'
        ? alert('Error: could not post comment')
        : Alert.alert('Error', 'Could not post comment');
    }
  };

  const renderCommentCard = ({ item }) => {
    const formatDate = (isoDate) => {
      const date = new Date(isoDate);
      return date.toLocaleString();
    };

    return (
      <View style={styles.commentCard}>
        <View style={styles.cardContent}>
          <Icon name="person" size={30} style={styles.userIcon} />
          <View style={styles.commentHeader}>
            <Text style={styles.userName}>{item.username}</Text>
            <Text style={styles.commentDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
        <Icon name="arrow-back" size={30} color="black" />
      </TouchableOpacity>
      <Text style={styles.header}>News Detail</Text>

      {tweetData ? (
        <>
          <View style={styles.tweetCard}>
            <View style={styles.tweetHeader}>
              <Image
                source={{ uri: 'https://via.placeholder.com/50' }}
                style={styles.avatar}
              />
              <View>
                <Text style={styles.username}>{tweetData.Username}</Text>
                <Text style={styles.timestamp}>{tweetData.Created_At}</Text>
              </View>
            </View>
            <Text style={styles.tweetText}>{tweetData.Tweet}</Text>
            {tweetData.Media_URL && (
              <TouchableOpacity onPress={() => handleMediaPress(tweetData.Tweet_Link)}>
                <Image
                  source={{ uri: tweetData.Media_URL }}
                  style={styles.media}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
            <View style={styles.stats}>
              <Text style={styles.stat}>Retweets: {tweetData.Retweets || 0}</Text>
              <Text style={styles.stat}>Likes: {tweetData.Favorites || 0}</Text>
            </View>
          </View>

          <Text style={styles.aiExplanationHeader}>AI Depth Explanation</Text>
          <Text style={styles.aiExplanationText}>{tweetData.Explanation}</Text>

          <View style={styles.actionIcons}>
            <TouchableOpacity onPress={() => handleSave(tweetData.Tweet_Link)}>
              <Icon name="bookmark-outline" size={30} color="#A1A0FE" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleShare(tweetData.Tweet_Link)}>
              <Icon name="share-outline" size={30} color="#A1A0FE" />
            </TouchableOpacity>
          </View>
          <View style={styles.commentContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Type your comment..."
              placeholderTextColor="#FFFF00"
              value={comment}
              onChangeText={(text) => setComment(text)}
            />
            <TouchableOpacity
              style={styles.postCommentButton}
              onPress={() => postComment(comment)}
            >
              <Text style={styles.postButtonText}>Post Comment</Text>
            </TouchableOpacity>
            <FlatList
              data={allComments}
              renderItem={renderCommentCard}
              keyExtractor={(item) => item.comment_id.toString()}
              contentContainerStyle={styles.commentCard}
              ListEmptyComponent={
                <Text style={styles.noComments}>
                  No comments yet. Be the first to comment!
                </Text>
              }
            />
          </View>
        </>
      ) : (
        <Text style={styles.loadingText}>Loading tweet details...</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  backIcon: {
    marginBottom: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  tweetCard: {
    backgroundColor: '#000000',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  tweetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  tweetText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  media: {
    width: '100%',
    height: 200,
    marginTop: 10,
    borderRadius: 10,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  stat: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  aiExplanationHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  aiExplanationText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
  },
  actionIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginTop: 50,
  },

  commentContainer: {
    flex: 1,
    backgroundColor: '#8a7fdc',
    paddingHorizontal: 20,
    paddingTop: 40,
    width: '95%',
    marginBottom: 40,
    paddingBottom: 40,
  },
  commentCard: {
    backgroundColor: '#F7B8D2',
    width: '98%',
    marginTop: 20,
    borderRadius: 15,
    paddingBottom: 20,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'left',
    marginTop: 5,
    paddingLeft: 25,
  },
  commentInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: '#F7B8D2',
    color: '#000',
  },
  postCommentButton: {
    marginLeft: 10,
    backgroundColor: '#A1A0FE',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 15,
  },
  postButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userIcon: {
    marginRight: 10,
    paddingLeft: 10,
  },
  userName: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 5,
  },
  noComments: {
    fontSize: 16,
    color: '#8a7fdc',
    fontWeight: 'bold',
    marginTop: 10,
    alignSelf: 'center',
    paddingBottom: 10,
  },
  commentDate: {
    fontSize: 12,
    color: '#555',
    marginLeft: 10,
    textAlign: 'right',
  },
});

export default TweetPage;
