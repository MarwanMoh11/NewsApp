import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';

const domaindynamo = Platform.OS === 'web'
  ?  'http://localhost:3000' // Use your local IP address for web
  : 'http://192.168.100.2:3000';       // Use localhost for mobile emulator or device

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const [isPushNotificationsEnabled, setIsPushNotificationsEnabled] = useState(false);
  const [isDarkThemeEnabled, setIsDarkThemeEnabled] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const response = await fetch(`${domaindynamo}/get-username`);
        const data = await response.json();
        if (data.username) {
          setUsername(data.username);
        } else {
          Alert.alert('Error', 'Failed to fetch username');
        }
      } catch (error) {
        console.error('Error fetching username:', error);
        Alert.alert('Error', 'Unable to fetch username');
      }
    };

    fetchUsername();
  }, []);

  const togglePushNotifications = () => {
    setIsPushNotificationsEnabled((prev) => !prev);
  };

  const toggleDarkTheme = () => {
    setIsDarkThemeEnabled((prev) => !prev);
  };

  const logout = () => {
    router.push('/home');
  };

const handleDeactivation = async (nickname: string) => {
  try {
    const deactivateresponse = await fetch(`${domaindynamo}/deactivate-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nickname }),
    });

    if (deactivateresponse.ok) {
      console.log(`Deactivating account for: ${nickname}`);
      router.push('/home');
    } else {
      const errorData = await deactivateresponse.json();
      console.error('Deactivation failed:', errorData.message);
    }
  } catch (error) {
    console.error('Error deactivating account:', error);
  }
};

const handleDeletion = async (nickname: string) => {
  try {
    const deleteResponse = await fetch(`${domaindynamo}/delete-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nickname }),
    });

    if (deleteResponse.ok) {
      console.log(`Deleting account for: ${nickname}`);
      router.push('/home');
    } else {
      const errorData = await deleteResponse.json();
      console.error('Deletion failed:', errorData.message);
    }
  } catch (error) {
    console.error('Error deleting account:', error);
  }
};

  const confirmDeactivation = () => {
    if (Platform.OS === 'web') {
      const userConfirmed = window.confirm(
        'Account Deactivation\n\nAre you sure you want to deactivate your account?'
      );
      if (userConfirmed) {
        handleDeactivation(username!);
      }
    } else {
      Alert.alert(
        'Account Deactivation',
        'Are you sure you want to deactivate your account?',
        [
          { text: 'Cancel', onPress: () => console.log('Deactivation canceled') },
          { text: 'Deactivate', onPress: () => handleDeactivation(username!) },
        ],
        { cancelable: false }
      );
    }
  };

  const confirmDeletion = () => {
    if (Platform.OS === 'web') {
      const userConfirmed = window.confirm(
        'Account Deletion\n\nAre you sure you want to permanently delete your account? This action cannot be undone.'
      );
      if (userConfirmed) {
        handleDeletion(username!);
      }

    } else {
      Alert.alert(
        'Account Deletion',
        'Are you sure you want to permanently delete your account? This action cannot be undone.',
        [
          { text: 'Cancel', onPress: () => console.log('Deletion canceled') },
          { text: 'Delete', onPress: () => handleDeletion(username!) },
        ],
        { cancelable: false }
      );
    }
  };

  return (
    <View style={[styles.mainContainer, isDarkThemeEnabled && styles.darkTheme]}>
      <View style={styles.sidebar}>
        <Text style={styles.profileName}>{username || 'User'}</Text>
        <ScrollView>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./edit-profile')}>
            <Text style={styles.menuText}>Edit Profile</Text>
            <Icon name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./preferences')}>
            <Text style={styles.menuText}>Edit Preferences</Text>
            <Icon name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.switchItem}>
            <Text style={styles.menuText}>Push Notifications</Text>
            <Switch
              value={isPushNotificationsEnabled}
              onValueChange={togglePushNotifications}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isPushNotificationsEnabled ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
          <View style={styles.switchItem}>
            <Text style={styles.menuText}>Dark Theme Mode</Text>
            <Switch
              value={isDarkThemeEnabled}
              onValueChange={toggleDarkTheme}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isDarkThemeEnabled ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./language-settings')}>
            <Text style={styles.menuText}>Language</Text>
            <Icon name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('./faq-support')}>
            <Text style={styles.menuText}>FAQ's & Support</Text>
            <Icon name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={logout}>
            <Text style={styles.menuText}>Logout</Text>
            <Icon name="exit-outline" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={confirmDeactivation}>
            <Text style={[styles.menuText, styles.dangerText]}>Deactivate Account</Text>
            <Icon name="alert-circle-outline" size={20} color="#E57373" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={confirmDeletion}>
            <Text style={[styles.menuText, styles.dangerText]}>Delete Account</Text>
            <Icon name="trash-outline" size={20} color="#E57373" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#8A7FDC',
  },
  darkTheme: {
    backgroundColor: '#121212',
  },
  sidebar: {
    flex: 1,
    backgroundColor: '#6246EA',
    borderRadius: 20,
    padding: 20,
    margin: 15,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#bbb',
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dangerText: {
    color: '#E57373',
  },
});