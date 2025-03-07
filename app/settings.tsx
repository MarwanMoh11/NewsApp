// app/settings.tsx
import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  Image,
  Switch,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { UserContext } from './UserContext'; // Adjust the path if necessary
import BackButton from '../components/ui/BackButton';

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

export default function SettingsScreen() {
  const router = useRouter();
  const { userToken, setUserToken, isDarkTheme, toggleTheme } = useContext(UserContext);

  // Loading state
  const [pageLoading, setPageLoading] = useState(true);

  // Basic user info
  const [username, setUsername] = useState<string>('Guest');
  const [fullName, setFullName] = useState<string>('Guest');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  // Toggles
  const [isPushNotificationsEnabled, setIsPushNotificationsEnabled] = useState(false);

  // ------------------ Fetch User Data ------------------
  useEffect(() => {
    const fetchUsernameAndProfile = async () => {
      if (!userToken) {
        setUsername('Guest');
        setFullName('Guest');
        setProfilePicture(null);
        setPageLoading(false);
        return;
      }
      try {
        // 1) Get username
        const response = await fetch(`${domaindynamo}/get-username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken }),
        });
        const data = await response.json();
        if (data.status === 'Success' && data.username) {
          setUsername(data.username);

          // 2) Get full name
          const fullNameRes = await fetch(
            `${domaindynamo}/get-full-name?username=${encodeURIComponent(data.username)}`
          );
          const fullNameData = await fullNameRes.json();
          if (fullNameData.status === 'Success') {
            setFullName(fullNameData.full_name || 'Unknown');
          } else {
            setFullName('Unknown');
          }

          // 3) Get profile picture
          const pfpRes = await fetch(
            `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(data.username)}`
          );
          const pfpData = await pfpRes.json();
          if (pfpData.status === 'Success') {
            setProfilePicture(pfpData.profile_picture);
          } else {
            setProfilePicture(null);
          }
        } else {
          setUsername('Guest');
          setFullName('Guest');
          setProfilePicture(null);
        }
      } catch (error) {
        console.error('Error fetching username or profile:', error);
        Alert.alert('Error', 'Unable to fetch user profile');
      } finally {
        setPageLoading(false);
      }
    };

    fetchUsernameAndProfile();
  }, [userToken]);

  // ------------------ Handle Navigation on userToken Change ------------------
  useEffect(() => {
    if (!pageLoading && userToken === null) {
      router.replace('/'); // Navigate to home screen when userToken is null
    }
  }, [userToken, pageLoading, router]);

  // ------------------ Logout ------------------
  const handleLogout = () => {
    setUserToken(null);
  };

  // ------------------ Delete and Logout ------------------
  const handleDeleteAndLogout = async () => {
    const deletionSuccess = await handleDeleteAccount();
    if (!deletionSuccess) {
      Alert.alert('Error', 'Account deletion failed. Please try again.');
    }
  };

  // ------------------ Delete Account ------------------
  const handleDeleteAccount = async (): Promise<boolean> => {
    if (!userToken || !username) {
      Alert.alert('Error', 'You must be logged in to delete your account.');
      return false;
    }
    try {
      const response = await fetch(`${domaindynamo}/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (response.ok) {
        console.log(`Deleting account for: ${username}`);
        setUserToken(null);
        return true;
      } else {
        const errorData = await response.json();
        console.error('Deletion failed:', errorData.message);
        Alert.alert('Error', errorData.message || 'Failed to delete account.');
        return false;
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
      return false;
    }
  };

  const confirmDeletion = () => {
    if (!username) return;
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
        handleDeleteAndLogout();
      }
    } else {
      Alert.alert(
        'Account Deletion',
        'Are you sure you want to permanently delete your account? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', onPress: handleDeleteAndLogout, style: 'destructive' },
        ],
        { cancelable: false }
      );
    }
  };

  // ------------------ Deactivate and Logout ------------------
  const handleDeactivateAndLogout = async () => {
    const deactivationSuccess = await handleDeactivateAccount();
    if (!deactivationSuccess) {
      Alert.alert('Error', 'Account deactivation failed. Please try again.');
    }
  };

  // ------------------ Deactivate Account ------------------
  const handleDeactivateAccount = async (): Promise<boolean> => {
    if (!userToken || !username) {
      Alert.alert('Error', 'You must be logged in to deactivate your account.');
      return false;
    }
    try {
      const response = await fetch(`${domaindynamo}/deactivate-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (response.ok) {
        console.log(`Deactivating account for: ${username}`);
        setUserToken(null);
        return true;
      } else {
        const errorData = await response.json();
        console.error('Deactivation failed:', errorData.message);
        Alert.alert('Error', errorData.message || 'Failed to deactivate account.');
        return false;
      }
    } catch (error) {
      console.error('Error deactivating account:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
      return false;
    }
  };

  const confirmDeactivation = () => {
    if (!username) return;
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to deactivate your account? You can reactivate it later.')) {
        handleDeactivateAndLogout();
      }
    } else {
      Alert.alert(
        'Account Deactivation',
        'Are you sure you want to deactivate your account? You can reactivate it later.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Deactivate', onPress: handleDeactivateAndLogout, style: 'destructive' },
        ],
        { cancelable: false }
      );
    }
  };

  // ------------------ Navigation ------------------
  const handleEditProfile = () => router.push('/editprofile');
  const handleEditPreferences = () => router.push('/preferences');

  const dynamicStyles = getStyles(isDarkTheme);

  if (pageLoading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={isDarkTheme ? '#BB9CED' : '#6D28D9'} />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      {/* Top Section */}
      <View style={dynamicStyles.headerSection}>
        <BackButton />
        <View style={dynamicStyles.profileInfo}>
          <View style={dynamicStyles.profilePicContainer}>
            <Image
              style={dynamicStyles.profilePic}
              source={
                profilePicture
                  ? { uri: profilePicture }
                  : require('../assets/images/logo.png')
              }
            />
          </View>
          <Text style={dynamicStyles.fullNameText}>Hello, {fullName}</Text>
          <Text style={dynamicStyles.subTitle}>Manage your account settings</Text>
        </View>
      </View>

      {/* Middle Section: Toggles */}
      <View style={dynamicStyles.togglesSection}>
        <View style={dynamicStyles.toggleRow}>
          <View style={dynamicStyles.labelRow}>
            <Ionicons name="notifications-outline" size={20} color={isDarkTheme ? '#BB9CED' : '#6D28D9'} />
            <Text style={dynamicStyles.labelText}>Push Notifications</Text>
          </View>
          <Switch
            value={isPushNotificationsEnabled}
            onValueChange={() => setIsPushNotificationsEnabled(!isPushNotificationsEnabled)}
            thumbColor={isPushNotificationsEnabled ? (isDarkTheme ? '#BB9CED' : '#6D28D9') : '#f4f3f4'}
            trackColor={{ false: '#767577', true: isDarkTheme ? '#BB9CED' : '#6D28D9' }}
          />
        </View>
        <View style={dynamicStyles.toggleRow}>
          <View style={dynamicStyles.labelRow}>
            <Ionicons name="moon-outline" size={20} color={isDarkTheme ? '#BB9CED' : '#6D28D9'} />
            <Text style={dynamicStyles.labelText}>Dark Mode</Text>
          </View>
          <Switch
            value={isDarkTheme}
            onValueChange={toggleTheme}
            thumbColor={isDarkTheme ? '#BB9CED' : '#f4f3f4'}
            trackColor={{ false: '#767577', true: '#BB9CED' }}
          />
        </View>
        <View style={dynamicStyles.buttonRow}>
          <TouchableOpacity style={dynamicStyles.outlineButton} onPress={handleEditProfile}>
            <Ionicons name="person-outline" size={16} color={isDarkTheme ? '#BB9CED' : '#6D28D9'} style={dynamicStyles.iconMargin} />
            <Text style={[dynamicStyles.outlineButtonText, { color: isDarkTheme ? '#BB9CED' : '#6D28D9' }]}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.outlineButton} onPress={handleEditPreferences}>
            <Ionicons name="settings-outline" size={16} color={isDarkTheme ? '#BB9CED' : '#6D28D9'} style={dynamicStyles.iconMargin} />
            <Text style={[dynamicStyles.outlineButtonText, { color: isDarkTheme ? '#BB9CED' : '#6D28D9' }]}>Edit Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Section: Action Buttons */}
      <View style={dynamicStyles.actionsSection}>
        <TouchableOpacity style={dynamicStyles.actionButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={isDarkTheme ? '#BB9CED' : '#6D28D9'} style={dynamicStyles.iconMargin} />
          <Text style={[dynamicStyles.actionButtonText, { color: isDarkTheme ? '#BB9CED' : '#6D28D9' }]}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={dynamicStyles.destructiveButton} onPress={confirmDeactivation}>
          <Ionicons name="person-remove-outline" size={16} color="#DC2626" style={dynamicStyles.iconMargin} />
          <Text style={[dynamicStyles.actionButtonText, { color: '#DC2626' }]}>Deactivate Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={dynamicStyles.destructiveButton} onPress={confirmDeletion}>
          <Ionicons name="trash-outline" size={16} color="#DC2626" style={dynamicStyles.iconMargin} />
          <Text style={[dynamicStyles.actionButtonText, { color: '#DC2626' }]}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default SettingsScreen;

const getStyles = (isDarkTheme: boolean) =>
  StyleSheet.create({
    // Loading Screen
    loadingContainer: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#121212' : '#E9D5FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Main Container
    container: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#121212' : '#E9D5FF',
    },
    // Header Section
    headerSection: {
      paddingTop: Platform.OS === 'ios' ? 50 : 30,
      paddingBottom: 20,
      paddingHorizontal: 16,
      backgroundColor: isDarkTheme ? '#121212' : '#6D28D9',
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    headerTitle: {
      color: '#fff',
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    profileInfo: {
      marginTop: 10,
      alignItems: 'center',
    },
    profilePicContainer: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: isDarkTheme ? '#121212' : '#D8B4FE',
      overflow: 'hidden',
      marginBottom: 10,
    },
    profilePic: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    fullNameText: {
      fontSize: 22,
      fontWeight: 'bold',
      color: isDarkTheme ? '#F3F4F6' : '#FFFFFF',
      marginBottom: 5,
    },
    subTitle: {
      fontSize: 14,
      color: isDarkTheme ? '#9CA3AF' : '#E9D5FF',
    },
    // Toggles Section
    togglesSection: {
      marginTop: 20,
      paddingHorizontal: 16,
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDarkTheme ? '#121212' : '#FFFFFF',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    labelText: {
      marginLeft: 6,
      fontSize: 16,
      color: isDarkTheme ? '#D1D5DB' : '#4B5563',
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    outlineButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: isDarkTheme ? '#BB9CED' : '#6D28D9',
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: isDarkTheme ? '#121212' : '#FFFFFF',
      justifyContent: 'center',
      marginRight: 8,
    },
    outlineButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    iconMargin: {
      marginRight: 4,
    },
    // Actions Section
    actionsSection: {
      marginTop: 20,
      paddingHorizontal: 16,
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: 20,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkTheme ? '#121212' : '#F3E8FF',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 10,
      justifyContent: 'center',
    },
    destructiveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkTheme ? '#121212' : '#FEE2E2',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 10,
      justifyContent: 'center',
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
