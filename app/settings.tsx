import React, { useEffect, useState, useContext } from 'react'
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
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { UserContext } from '../app/UserContext'
import BackButton from '../components/ui/BackButton'

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index'
// or your actual server URL

export default function SettingsScreen() {
  const router = useRouter()
  const { userToken, setUserToken } = useContext(UserContext)

  // ------------------ Loading State ------------------
  const [pageLoading, setPageLoading] = useState(true)

  // Basic user info
  const [username, setUsername] = useState<string>('Guest')
  const [fullName, setFullName] = useState<string>('Guest')
  const [profilePicture, setProfilePicture] = useState<string | null>(null)

  // Toggles
  const [darkMode, setDarkMode] = useState(false)
  const [isPushNotificationsEnabled, setIsPushNotificationsEnabled] = useState(false)

  // ------------------ Fetch User Data ------------------
  useEffect(() => {
    const fetchUsernameAndProfile = async () => {
      if (!userToken) {
        // Not logged in: set defaults
        setUsername('Guest')
        setFullName('Guest')
        setProfilePicture(null)
        setPageLoading(false)
        return
      }

      try {
        // 1) Get username from netlify function
        const response = await fetch(`${domaindynamo}/get-username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken }),
        })
        const data = await response.json()

        if (data.status === 'Success' && data.username) {
          setUsername(data.username)

          // 2) Get full name
          const fullNameRes = await fetch(
            `${domaindynamo}/get-full-name?username=${encodeURIComponent(data.username)}`
          )
          const fullNameData = await fullNameRes.json()
          if (fullNameData.status === 'Success') {
            setFullName(fullNameData.full_name)
          } else {
            setFullName('Unknown')
          }

          // 3) Get profile picture
          const pfpRes = await fetch(
            `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(data.username)}`
          )
          const pfpData = await pfpRes.json()
          if (pfpData.status === 'Success') {
            setProfilePicture(pfpData.profile_picture)
          } else {
            setProfilePicture(null)
          }
        } else {
          // Fallback
          setUsername('Guest')
          setFullName('Guest')
          setProfilePicture(null)
        }
      } catch (error) {
        console.error('Error fetching username or profile:', error)
        Alert.alert('Error', 'Unable to fetch user profile')
      } finally {
        setPageLoading(false)
      }
    }

    fetchUsernameAndProfile()
  }, [userToken])

  // ------------------ Logout ------------------
  const handleLogout = () => {
    setUserToken?.(null)
    router.push('/')
  }

  // ------------------ Deactivate ------------------
  const handleDeactivateAccount = async () => {
    if (!userToken || !username) {
      Alert.alert('Error', 'You must be logged in to deactivate your account.')
      return
    }
    try {
      const response = await fetch(`${domaindynamo}/deactivate-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (response.ok) {
        console.log(`Deactivating account for: ${username}`)
        router.push('/')
      } else {
        const errorData = await response.json()
        console.error('Deactivation failed:', errorData.message)
      }
    } catch (error) {
      console.error('Error deactivating account:', error)
    }
  }

  const confirmDeactivation = () => {
    if (!username) return
    Alert.alert(
      'Account Deactivation',
      'Are you sure you want to deactivate your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', onPress: handleDeactivateAccount },
      ],
      { cancelable: false }
    )
  }

  // ------------------ Delete ------------------
  const handleDeleteAccount = async () => {
    if (!userToken || !username) {
      Alert.alert('Error', 'You must be logged in to delete your account.')
      return
    }
    try {
      const response = await fetch(`${domaindynamo}/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (response.ok) {
        console.log(`Deleting account for: ${username}`)
        router.push('/')
      } else {
        const errorData = await response.json()
        console.error('Deletion failed:', errorData.message)
      }
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  const confirmDeletion = () => {
    if (!username) return
    Alert.alert(
      'Account Deletion',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', onPress: handleDeleteAccount, style: 'destructive' },
      ],
      { cancelable: false }
    )
  }

  // ------------------ Navigation ------------------
  const handleEditProfile = () => router.push('/editprofile')
  const handleEditPreferences = () => router.push('/preferences')

  // ------------------ Render ------------------
  if (pageLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6D28D9" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Top Section: "Back" button + big header */}
      <View style={styles.headerSection}>
        <BackButton />

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <View style={styles.profilePicContainer}>
            <Image
              style={styles.profilePic}
              source={
                profilePicture
                  ? { uri: profilePicture }
                  : require('../assets/images/logo.png')
              }
            />
          </View>
          <Text style={styles.fullNameText}>Hello, {fullName}</Text>
          <Text style={styles.subTitle}>Manage your account settings</Text>
        </View>
      </View>

      {/* Middle Section: Toggles */}
      <View style={styles.togglesSection}>
        {/* Push Notifications */}
        <View style={styles.toggleRow}>
          <View style={styles.labelRow}>
            <Ionicons name="notifications-outline" size={20} color="#6D28D9" />
            <Text style={styles.labelText}>Push Notifications</Text>
          </View>
          <Switch
            value={isPushNotificationsEnabled}
            onValueChange={() => setIsPushNotificationsEnabled(!isPushNotificationsEnabled)}
            thumbColor={isPushNotificationsEnabled ? '#6D28D9' : '#f4f3f4'}
            trackColor={{ false: '#767577', true: '#BB9CED' }}
          />
        </View>

        {/* Dark Mode */}
        <View style={styles.toggleRow}>
          <View style={styles.labelRow}>
            <Ionicons name="moon-outline" size={20} color="#6D28D9" />
            <Text style={styles.labelText}>Dark Mode</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            thumbColor={darkMode ? '#6D28D9' : '#f4f3f4'}
            trackColor={{ false: '#767577', true: '#BB9CED' }}
          />
        </View>

        {/* Buttons: Edit Profile + Edit Preferences */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={handleEditProfile}
          >
            <Ionicons name="person-outline" size={16} color="#6D28D9" style={styles.iconMargin} />
            <Text style={[styles.outlineButtonText, { color: '#6D28D9' }]}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={handleEditPreferences}
          >
            <Ionicons name="settings-outline" size={16} color="#6D28D9" style={styles.iconMargin} />
            <Text style={[styles.outlineButtonText, { color: '#6D28D9' }]}>Edit Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Section: Action Buttons (Logout, Deactivate, Delete) */}
      <View style={styles.actionsSection}>
        {/* Logout */}
        <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color="#6D28D9" style={styles.iconMargin} />
          <Text style={[styles.actionButtonText, { color: '#6D28D9' }]}>Logout</Text>
        </TouchableOpacity>

        {/* Deactivate Account */}
        <TouchableOpacity style={styles.destructiveButton} onPress={confirmDeactivation}>
          <Ionicons name="person-remove-outline" size={16} color="#DC2626" style={styles.iconMargin} />
          <Text style={[styles.actionButtonText, { color: '#DC2626' }]}>Deactivate Account</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.destructiveButton} onPress={confirmDeletion}>
          <Ionicons name="trash-outline" size={16} color="#DC2626" style={styles.iconMargin} />
          <Text style={[styles.actionButtonText, { color: '#DC2626' }]}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------
const styles = StyleSheet.create({
  // Loading Screen
  loadingContainer: {
    flex: 1,
    backgroundColor: '#E9D5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#E9D5FF', // Purple-themed background
  },

  // ------------------ Header Section ------------------
  headerSection: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30, // Extra top padding if needed
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: '#6D28D9', // Bold purple header
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  profileInfo: {
    marginTop: 10,
    alignItems: 'center',
  },
  profilePicContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#D8B4FE',
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
    color: '#FFFFFF',
    marginBottom: 5,
  },
  subTitle: {
    fontSize: 14,
    color: '#E9D5FF',
  },

  // ------------------ Toggles Section ------------------
  togglesSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    color: '#4B5563',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#6D28D9',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
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

  // ------------------ Actions Section ------------------
  actionsSection: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    justifyContent: 'center',
  },
  destructiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
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
})
