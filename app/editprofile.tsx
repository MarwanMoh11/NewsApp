// ------------------------------------------------------
// ProfileSettings.tsx
// (With Loading Spinner, Go Back, and Username Checks)
// ------------------------------------------------------
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserContext } from '../app/UserContext';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import WebCamera from '../components/WebCamera';

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

// Cloudinary Configuration
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/davi2jx4z/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'unsigned_preset';

export default function ProfileSettings() {
  const router = useRouter();
  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext);

  // -------------- Loading / Saving States --------------
  const [pageLoading, setPageLoading] = useState(true);    // Initial page load
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false); // For "Save Changes" spinner

  // -------------- Profile Data --------------
  const [fullName, setFullName] = useState('John Doe');
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [pfp, setPfp] = useState<string>('https://via.placeholder.com/150?text=Profile+Picture');

  // Animate the save button for feedback
  const [buttonScale] = useState(new Animated.Value(1));

  // -------------- Modal Visibility States --------------
  const [isModalVisible, setModalVisible] = useState(false);
  const [isWebCameraVisible, setWebCameraVisible] = useState(false);

  // -------------- Fetch Data on Mount --------------
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userToken) {
        setFullName('Guest');
        setPfp('https://via.placeholder.com/150?text=Guest');
        setPageLoading(false);
        return;
      }

      try {
        const response = await fetch(`${domaindynamo}/get-username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: userToken }),
        });
        const data = await response.json();

        if (data.status === 'Success' && data.username) {
          setUsername(data.username);
          setNewUsername(data.username);

          const fullNameRes = await fetch(
            `${domaindynamo}/get-full-name?username=${encodeURIComponent(data.username)}`
          );
          const fullNameData = await fullNameRes.json();
          if (fullNameData.status === 'Success') {
            setFullName(fullNameData.full_name || 'No Name');
          }

          const pfpRes = await fetch(
            `${domaindynamo}/get-profile-picture?username=${encodeURIComponent(data.username)}`
          );
          const pfpData = await pfpRes.json();
          if (pfpData.status === 'Success') {
            setPfp(pfpData.profile_picture);
          }
        } else {
          setFullName('Guest');
          setPfp('https://via.placeholder.com/150?text=Guest');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        Alert.alert('Error', 'Unable to fetch profile info');
      } finally {
        setPageLoading(false);
      }
    };

    fetchProfile();
  }, [userToken]);

  // -------------- Animate Save Button --------------
  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  // -------------- Save Handler --------------
  const handleSave = async () => {
    // Basic check for empty username
    if (!newUsername.trim()) {
      Alert.alert('Error', 'Username cannot be empty.');
      return;
    }
    // Optionally, you could also check for empty fullName if needed
    // if (!fullName.trim()) {
    //   Alert.alert('Error', 'Name cannot be empty.');
    //   return;
    // }

    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to save changes.');
      return;
    }

    setSavingProfile(true); // Show the saving spinner

    try {
      let updatedToken = userToken;

      // Update full name (optional check if you want to forbid empty)
      if (fullName !== 'Guest') {
        const fullNameRes = await fetch(`${domaindynamo}/update_full_name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: updatedToken, newFullName: fullName }),
        });
        const fullNameData = await fullNameRes.json();
        if (fullNameData.status === 'Success') {
          updatedToken = fullNameData.token;
          setUserToken(updatedToken);
        } else {
          throw new Error('Failed to update full name');
        }
      }

      // Update username if changed
      if (newUsername && newUsername !== username) {
        const usernameRes = await fetch(`${domaindynamo}/update_username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: updatedToken, newUsername }),
        });
        const usernameData = await usernameRes.json();
        if (usernameData.status === 'Success') {
          updatedToken = usernameData.token;
          setUserToken(updatedToken);
          setUsername(newUsername);
        } else {
          throw new Error(usernameData.message || 'Failed to update username');
        }
      }

      // Update profile picture if changed
      if (
        pfp &&
        pfp !== 'https://via.placeholder.com/150?text=Profile+Picture' &&
        pfp !== 'https://via.placeholder.com/150?text=Guest'
      ) {
        const pfpRes = await fetch(`${domaindynamo}/update_profile_picture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: updatedToken, newProfilePicture: pfp }),
        });
        const pfpData = await pfpRes.json();
        if (pfpData.status === 'Success') {
          updatedToken = pfpData.token;
          setUserToken(updatedToken);
        } else {
          throw new Error(pfpData.message || 'Failed to update profile picture');
        }
      }

      Alert.alert('Success', 'Profile changes saved successfully.');
      router.push('/');  // or router.back() if you want to return to the previous screen
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to save changes. Please try again.');
    } finally {
      setSavingProfile(false); // Hide the spinner
    }
  };

  // -------------- Handle "Return to Settings" or "Go Back" --------------
  const handleGoBack = () => {
    // If you have a specific route for "Settings", you can push that route
    // e.g., router.push('/settings');
    // Or simply go back to the previous screen:
    router.back();
  };

  // -------------- Image Upload Handler --------------
  const handleImageUpload = async () => {
    if (Platform.OS !== 'web') {
      let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access media library is required!');
        return;
      }
    }

    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });

    console.log('ImagePicker Result:', pickerResult);

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      const asset = pickerResult.assets[0];
      const { uri, fileName, mimeType } = asset;

      if (!uri) {
        Alert.alert('Error', 'Failed to obtain image URI.');
        return;
      }

      // If it starts with data
      if (uri.startsWith('data:image/')) {
        const formData = new FormData();
        formData.append('file', uri);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        setUploadingImage(true);

        try {
          const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          console.log('Cloudinary Upload Response:', data);

          if (data.secure_url) {
            setPfp(data.secure_url);
            Alert.alert('Success', 'Profile picture updated successfully.');
          } else if (data.error) {
            throw new Error(data.error.message || 'Failed to upload profile picture.');
          } else {
            throw new Error('Unexpected upload response from Cloudinary.');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
        } finally {
          setUploadingImage(false);
        }
      } else {
        // For file URIs
        const filename = fileName || uri.split('/').pop() || 'profile_picture';
        const match = /\.(\w+)$/.exec(filename);
        const type = mimeType || (match ? `image/${match[1]}` : `image`);

        if (!match && !mimeType) {
          Alert.alert('Error', 'Image must have a valid file extension (e.g., .jpg, .png).');
          return;
        }

        const formData = new FormData();
        formData.append('file', {
          uri,
          name: filename,
          type,
        });
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        setUploadingImage(true);

        try {
          const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          console.log('Cloudinary Upload Response:', data);

          if (data.secure_url) {
            setPfp(data.secure_url);
            Alert.alert('Success', 'Profile picture updated successfully.');
          } else if (data.error) {
            throw new Error(data.error.message || 'Failed to upload profile picture.');
          } else {
            throw new Error('Unexpected upload response from Cloudinary.');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
        } finally {
          setUploadingImage(false);
        }
      }
    } else {
      console.log('ImagePicker canceled by user.');
    }
  };

  // -------------- Upload Image via Camera --------------
  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      setWebCameraVisible(true);
      return;
    }

    let permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access camera is required!');
      return;
    }

    let pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });

    console.log('ImagePicker Result (Camera):', pickerResult);

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      const asset = pickerResult.assets[0];
      const { uri, fileName, mimeType } = asset;

      if (!uri) {
        Alert.alert('Error', 'Failed to obtain image URI.');
        return;
      }

      if (uri.startsWith('data:image/')) {
        const formData = new FormData();
        formData.append('file', uri);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        setUploadingImage(true);

        try {
          const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          console.log('Cloudinary Upload Response (Camera):', data);

          if (data.secure_url) {
            setPfp(data.secure_url);
            Alert.alert('Success', 'Profile picture updated successfully.');
          } else if (data.error) {
            throw new Error(data.error.message || 'Failed to upload profile picture.');
          } else {
            throw new Error('Unexpected upload response from Cloudinary.');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
        } finally {
          setUploadingImage(false);
        }
      } else {
        const filename = fileName || uri.split('/').pop() || 'profile_picture';
        const match = /\.(\w+)$/.exec(filename);
        const type = mimeType || (match ? `image/${match[1]}` : `image`);

        if (!match && !mimeType) {
          Alert.alert('Error', 'Image must have a valid file extension (e.g., .jpg, .png).');
          return;
        }

        const formData = new FormData();
        formData.append('file', {
          uri,
          name: filename,
          type,
        });
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        setUploadingImage(true);

        try {
          const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          console.log('Cloudinary Upload Response (Camera):', data);

          if (data.secure_url) {
            setPfp(data.secure_url);
            Alert.alert('Success', 'Profile picture updated successfully.');
          } else if (data.error) {
            throw new Error(data.error.message || 'Failed to upload profile picture.');
          } else {
            throw new Error('Unexpected upload response from Cloudinary.');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
        } finally {
          setUploadingImage(false);
        }
      }
    } else {
      console.log('ImagePicker (Camera) canceled by user.');
    }
  };

  // -------------- Profile Picture Click Handler --------------
  const handleProfilePicPress = () => {
    setModalVisible(true);
  };

  // -------------- Handle Web Camera Capture --------------
  const handleWebCapture = async (imageSrc: string) => {
    setWebCameraVisible(false);
    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('file', imageSrc);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('Cloudinary Upload Response (Web):', data);

      if (data.secure_url) {
        setPfp(data.secure_url);
        Alert.alert('Success', 'Profile picture updated successfully.');
      } else if (data.error) {
        throw new Error(data.error.message || 'Failed to upload profile picture.');
      } else {
        throw new Error('Unexpected upload response from Cloudinary.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleWebCancel = () => {
    setWebCameraVisible(false);
  };

  // ------------------ Main Render ------------------
  const dynamicStyles = getStyles(isDarkTheme);

  if (pageLoading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={isDarkTheme ? '#BB9CED' : '#6D28D9'} />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.screenContainer}>
      {/* Loading Overlay when saving profile */}
      {savingProfile && (
        <View style={dynamicStyles.savingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={dynamicStyles.savingOverlayText}>Saving Changes...</Text>
        </View>
      )}

      {/* Header Section */}
      <View style={dynamicStyles.headerSection}>
        <Text style={dynamicStyles.headerTitle}>Edit Profile</Text>
      </View>

      {/* Profile Picture + Upload (clickable) */}
      <View style={dynamicStyles.profileSection}>
        <TouchableOpacity
          style={dynamicStyles.profilePicContainer}
          onPress={handleProfilePicPress}
          activeOpacity={0.7}
        >
          <Image source={{ uri: pfp }} style={dynamicStyles.profilePic} />
          <View style={dynamicStyles.cameraIconContainer}>
            <Ionicons name="camera" size={24} color="#fff" />
          </View>
          {uploadingImage && (
            <View style={dynamicStyles.uploadOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Custom Modal for Web and Native */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={dynamicStyles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Update Profile Picture</Text>
            <TouchableOpacity
              style={dynamicStyles.modalButton}
              onPress={() => {
                setModalVisible(false);
                if (Platform.OS === 'web') {
                  setWebCameraVisible(true);
                } else {
                  handleTakePhoto();
                }
              }}
            >
              <Ionicons
                name="camera"
                size={20}
                color={isDarkTheme ? '#fff' : '#333'}
                style={dynamicStyles.modalIcon}
              />
              <Text style={dynamicStyles.modalButtonText}>Take a Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dynamicStyles.modalButton}
              onPress={() => {
                setModalVisible(false);
                handleImageUpload();
              }}
            >
              <Ionicons
                name="images"
                size={20}
                color={isDarkTheme ? '#fff' : '#333'}
                style={dynamicStyles.modalIcon}
              />
              <Text style={dynamicStyles.modalButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={isDarkTheme ? '#fff' : '#333'}
                style={dynamicStyles.modalIcon}
              />
              <Text style={dynamicStyles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* WebCamera Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isWebCameraVisible}
        onRequestClose={() => setWebCameraVisible(false)}
      >
        <View style={dynamicStyles.webCameraContainer}>
          <WebCamera onCapture={handleWebCapture} onCancel={handleWebCancel} isDarkTheme={isDarkTheme} />
        </View>
      </Modal>

      {/* Input Fields */}
      <View style={dynamicStyles.inputsSection}>
        <View style={dynamicStyles.inputRow}>
          <Text style={dynamicStyles.inputLabel}>Name</Text>
          <TextInput
            style={dynamicStyles.textInput}
            value={fullName}
            onChangeText={(text) => setFullName(text)}
            placeholder="Enter your full name"
            placeholderTextColor={isDarkTheme ? '#A1A1AA' : '#999'}
          />
        </View>

        <View style={dynamicStyles.inputRow}>
          <Text style={dynamicStyles.inputLabel}>Username</Text>
          <TextInput
            style={dynamicStyles.textInput}
            value={newUsername}
            onChangeText={(text) => setNewUsername(text)}
            placeholder="Enter your username"
            placeholderTextColor={isDarkTheme ? '#A1A1AA' : '#999'}
          />
        </View>
      </View>

      {/* Bottom Buttons: "Save Changes" and "Go Back" */}
      <View style={dynamicStyles.actionsSection}>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={dynamicStyles.saveButton}
            onPress={() => {
              animateButton();
              handleSave();
            }}
            disabled={savingProfile} // Prevent double-tap
          >
            <Text style={dynamicStyles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Return to Main Settings / Go Back Button */}
        <TouchableOpacity
          style={dynamicStyles.backButton}
          onPress={handleGoBack}
          disabled={savingProfile}
        >
          <Text style={dynamicStyles.backButtonText}>Return to Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --------------------------------------------------
// DYNAMIC STYLES BASED ON THEME
// --------------------------------------------------
const getStyles = (isDarkTheme: boolean) =>
  StyleSheet.create({
    // Loading
    loadingContainer: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#1F2937' : '#E9D5FF',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Full Screen
    screenContainer: {
      flex: 1,
      backgroundColor: isDarkTheme ? '#1F2937' : '#E9D5FF',
    },

    // Saving Overlay
    savingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    savingOverlayText: {
      color: '#FFF',
      marginTop: 10,
      fontSize: 16,
    },

    // ------------------ Header Section ------------------
    headerSection: {
      backgroundColor: isDarkTheme ? '#374151' : '#6D28D9',
      paddingTop: Platform.OS === 'ios' ? 50 : 30,
      paddingBottom: 20,
      alignItems: 'center',
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      shadowColor: isDarkTheme ? '#000' : '#6D28D9',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkTheme ? 0.3 : 0.5,
      shadowRadius: 4,
      elevation: 5,
    },
    headerTitle: {
      color: '#fff',
      fontSize: 24,
      fontWeight: 'bold',
    },

    // ------------------ Profile Picture Section ------------------
    profileSection: {
      alignItems: 'center',
      marginTop: 20,
      paddingHorizontal: 20,
    },
    profilePicContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      borderColor: isDarkTheme ? '#BB9CED' : '#6D28D9',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: isDarkTheme ? '#374151' : '#FFFFFF',
    },
    profilePic: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    cameraIconContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      padding: 4,
    },
    uploadOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ------------------ Modal Styles ------------------
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: Dimensions.get('window').width * 0.8,
      backgroundColor: isDarkTheme ? '#374151' : '#fff',
      borderRadius: 10,
      padding: 20,
      alignItems: 'center',
      shadowColor: isDarkTheme ? '#000' : '#6D28D9',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkTheme ? 0.3 : 0.5,
      shadowRadius: 4,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDarkTheme ? '#fff' : '#333',
      marginBottom: 20,
    },
    modalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkTheme ? '#4B5563' : '#F0F0F0',
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 8,
      width: '100%',
      marginBottom: 10,
    },
    cancelButton: {
      backgroundColor: isDarkTheme ? '#6B7280' : '#D1D5DB',
    },
    modalIcon: {
      marginRight: 10,
    },
    modalButtonText: {
      fontSize: 16,
      color: isDarkTheme ? '#fff' : '#333',
    },

    // ------------------ WebCamera Styles ------------------
    webCameraContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkTheme ? '#1F2937' : '#E9D5FF',
    },

    // ------------------ Inputs Section ------------------
    inputsSection: {
      marginTop: 30,
      paddingHorizontal: 16,
    },
    inputRow: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 16,
      color: isDarkTheme ? '#D1D5DB' : '#4B5563',
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: isDarkTheme ? '#374151' : '#F9FAFB',
      borderRadius: 8,
      fontSize: 16,
      padding: 12,
      color: isDarkTheme ? '#F3F4F6' : '#333',
    },

    // ------------------ Actions Section ------------------
    actionsSection: {
      marginTop: 20,
      paddingHorizontal: 16,
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: 20,
    },
    saveButton: {
      backgroundColor: isDarkTheme ? '#BB9CED' : '#6D28D9',
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10, // Spacing before back button
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    backButton: {
      backgroundColor: isDarkTheme ? '#4B5563' : '#FFF',
      borderWidth: 1,
      borderColor: isDarkTheme ? '#BB9CED' : '#6D28D9',
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
    },
    backButtonText: {
      fontSize: 16,
      color: isDarkTheme ? '#BB9CED' : '#6D28D9',
      fontWeight: '600',
    },
  });
