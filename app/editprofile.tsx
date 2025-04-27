// app/editprofile.tsx (Assuming this is the correct route based on navigation)
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable, // Use Pressable for modal overlay
  Dimensions,
  ScrollView, // Use ScrollView for content
  SafeAreaView, // Use SafeAreaView for top/bottom padding
  StatusBar, // Control status bar style
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserContext } from './UserContext'; // Adjust path if necessary
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons'; // Use consistent import
import WebCamera from '../components/WebCamera'; // Adjust path if necessary
import BackButton from '../components/ui/BackButton'; // Adjust path if necessary

// Configuration
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/davi2jx4z/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'unsigned_preset';
const defaultProfilePic = require('../assets/images/logo.png'); // Default image

export default function ProfileSettings() {
  const router = useRouter();
  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext);

  // --- State ---
  const [pageLoading, setPageLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false); // Specific to image upload spinner
  const [savingProfile, setSavingProfile] = useState(false); // Specific to save button spinner
  const [fullName, setFullName] = useState('');
  const [originalUsername, setOriginalUsername] = useState(''); // Store the initial username
  const [newUsername, setNewUsername] = useState(''); // For the input field
  const [pfp, setPfp] = useState<string | null>(null); // Use null initially
  const [isModalVisible, setModalVisible] = useState(false); // Image source selection modal
  const [isWebCameraVisible, setWebCameraVisible] = useState(false); // Web camera modal

  // --- Styles & Theme ---
  const dynamicStyles = getStyles(isDarkTheme);
  const themeStatusBar = isDarkTheme ? 'light-content' : 'dark-content';
  const themeBackgroundColor = dynamicStyles.screenContainer.backgroundColor;

  // --- Fetch Data ---
  const fetchProfile = useCallback(async () => {
    if (!userToken) {
      setFullName('Guest');
      setOriginalUsername('Guest');
      setNewUsername('Guest');
      setPfp(null); // Use null for default/guest state
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      // Fetch username first
      const response = await fetch(`${domaindynamo}/get-username`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: userToken }),
      });
      const data = await response.json();

      if (data.status === 'Success' && data.username) {
        const fetchedUsername = data.username;
        setOriginalUsername(fetchedUsername);
        setNewUsername(fetchedUsername);

        // Fetch full name and pfp in parallel
        const [fullNameData, pfpData] = await Promise.all([
          fetch(`${domaindynamo}/get-full-name?username=${encodeURIComponent(fetchedUsername)}`).then(res => res.json()),
          fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(fetchedUsername)}`).then(res => res.json())
        ]);

        setFullName(fullNameData.status === 'Success' ? fullNameData.full_name || '' : ''); // Default to empty string if no name
        setPfp(pfpData.status === 'Success' ? pfpData.profile_picture : null);

      } else {
        // Handle case where token is valid but username fetch fails
        console.warn("Username fetch failed despite valid token.");
        setFullName('Guest'); setOriginalUsername('Guest'); setNewUsername('Guest'); setPfp(null);
        // Optionally log out: setUserToken(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Unable to fetch profile info. Please try again.');
      // Reset to guest state on error
      setFullName('Guest'); setOriginalUsername('Guest'); setNewUsername('Guest'); setPfp(null);
    } finally {
      setPageLoading(false);
    }
  }, [userToken, setUserToken]); // Added setUserToken dependency

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // --- Save Handler ---
  const handleSave = useCallback(async () => {
    const trimmedUsername = newUsername.trim();
    const trimmedFullName = fullName.trim();

    if (!trimmedUsername) {
      Alert.alert('Username Required', 'Username cannot be empty.');
      return;
    }
    if (!trimmedFullName) {
       Alert.alert('Name Required', 'Name cannot be empty.');
       return;
    }
    if (!userToken) {
      Alert.alert('Error', 'You must be logged in to save changes.');
      return;
    }

    setSavingProfile(true); // Show saving indicator on button

    try {
      let updatedToken = userToken; // Start with current token
      let profileUpdated = false;
      let usernameUpdated = false;
      let pfpUpdated = false;

      // 1. Update Full Name (if changed)
      // Assuming backend handles checking if name actually changed
      const fullNameRes = await fetch(`${domaindynamo}/update_full_name`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: updatedToken, newFullName: trimmedFullName }),
      });
      const fullNameData = await fullNameRes.json();
      if (fullNameData.status === 'Success') {
        updatedToken = fullNameData.token; // Get potentially refreshed token
        setUserToken(updatedToken);
        profileUpdated = true;
      } else {
        throw new Error(fullNameData.message || 'Failed to update full name');
      }

      // 2. Update Username (if changed)
      if (trimmedUsername !== originalUsername) {
        const usernameRes = await fetch(`${domaindynamo}/update_username`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: updatedToken, newUsername: trimmedUsername }),
        });
        const usernameData = await usernameRes.json();
        if (usernameData.status === 'Success') {
          updatedToken = usernameData.token; // Get potentially refreshed token
          setUserToken(updatedToken);
          setOriginalUsername(trimmedUsername); // Update original username state
          usernameUpdated = true;
          profileUpdated = true;
        } else {
          // Don't throw error immediately, maybe just name updated successfully
          Alert.alert('Username Error', usernameData.message || 'Failed to update username. It might already be taken.');
           // Revert username input if update failed
          setNewUsername(originalUsername);
        }
      }

      // 3. Update Profile Picture (if changed)
      // Assuming backend handles checking if PFP actually changed
      // Check if pfp state is not null and not the default placeholder logic if needed
      if (pfp) { // Only update if pfp is not null
          const pfpRes = await fetch(`${domaindynamo}/update_profile_picture`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: updatedToken, newProfilePicture: pfp }),
          });
          const pfpData = await pfpRes.json();
          if (pfpData.status === 'Success') {
            updatedToken = pfpData.token; // Get potentially refreshed token
            setUserToken(updatedToken);
            pfpUpdated = true;
            profileUpdated = true;
          } else {
             // Don't throw error, maybe other parts saved
            console.warn("PFP update failed (backend):", pfpData.message);
            // Optionally inform user PFP didn't save
            // Alert.alert('Profile Picture Error', pfpData.message || 'Failed to update profile picture.');
          }
      }


      if (profileUpdated) {
        Alert.alert('Success', 'Profile updated successfully.');
        router.back(); // Go back after successful save
      } else if (!usernameUpdated) {
         // If only username failed, name/pfp might have succeeded but we showed an error
         // If nothing was changed or only PFP failed silently, maybe just go back
         // router.back();
      }

    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Save Error', error.message || 'Failed to save changes. Please try again.');
    } finally {
      setSavingProfile(false); // Hide indicator on button
    }
  }, [userToken, fullName, newUsername, originalUsername, pfp, setUserToken, router]);

  // --- Go Back Handler ---
  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  // --- Cloudinary Upload Function ---
  const uploadImageToCloudinary = useCallback(async (uri: string, fileName?: string | null, mimeType?: string | null) => {
    if (!uri) {
      Alert.alert('Upload Error', 'Invalid image source.');
      return;
    }

    setUploadingImage(true); // Show spinner on profile pic
    const formData = new FormData();
    let fileData: any;

    // Handle base64 or file URI
    if (uri.startsWith('data:image/')) {
      fileData = uri; // Send base64 directly
    } else {
      const filename = fileName || uri.split('/').pop() || 'profile.jpg'; // Default filename
      const match = /\.(\w+)$/.exec(filename);
      const type = mimeType || (match ? `image/${match[1]}` : `image/jpeg`); // Default type
      fileData = { uri, name: filename, type };
    }

    formData.append('file', fileData);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
      const data = await response.json();
      console.log('Cloudinary Upload Response:', data);

      if (data.secure_url) {
        setPfp(data.secure_url); // Update state with new URL
        // No Alert needed here, user sees the image update. Save happens on "Save Changes".
      } else {
        throw new Error(data.error?.message || 'Upload failed: Invalid response from Cloudinary.');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', error.message || 'Could not upload image. Please try again.');
    } finally {
      setUploadingImage(false); // Hide spinner on profile pic
    }
  }, []); // No external dependencies needed if config is constant

  // --- Image Upload Logic (Combined Camera/Gallery Picker) ---
  const pickImage = useCallback(async (useCamera: boolean) => {
    setModalVisible(false); // Close selection modal
    let permissionResult;
    let pickerResult;

    try {
      if (useCamera) {
        if (Platform.OS === 'web') {
          setWebCameraVisible(true); // Open web camera modal
          return;
        }
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access camera is required!');
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7,
        });
      } else {
        if (Platform.OS !== 'web') {
          permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (permissionResult.status !== 'granted') {
            Alert.alert('Permission Denied', 'Permission to access media library is required!');
            return;
          }
        }
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7,
        });
      }

      console.log('ImagePicker Result:', pickerResult);

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        // Directly call upload function after picking
        await uploadImageToCloudinary(asset.uri, asset.fileName, asset.mimeType);
      } else {
        console.log('ImagePicker canceled by user.');
      }
    } catch (error) {
        console.error("Error during image picking:", error);
        Alert.alert('Image Error', 'Could not select image.');
    }
  }, [uploadImageToCloudinary]); // Now depends on uploadImageToCloudinary

  // --- Web Camera Handlers ---
  const handleWebCapture = useCallback(async (imageSrc: string) => {
    setWebCameraVisible(false);
    if (imageSrc) {
      await uploadImageToCloudinary(imageSrc); // Upload captured base64 image
    }
  }, [uploadImageToCloudinary]);

  const handleWebCancel = useCallback(() => {
    setWebCameraVisible(false);
  }, []);

  // --- Loading UI ---
  if (pageLoading) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer}>
        <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />
        <ActivityIndicator size="large" color={dynamicStyles.loadingIndicator.color} />
      </SafeAreaView>
    );
  }

  // --- Main Render ---
  return (
    <SafeAreaView style={dynamicStyles.screenContainer}>
      <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />

      {/* Header */}
      <View style={dynamicStyles.headerContainer}>
         {/* Use BackButton component */}
         <BackButton style={dynamicStyles.headerButton}/>
         <Text style={dynamicStyles.headerTitle}>Edit Profile</Text>
         {/* Save Button in Header */}
         <TouchableOpacity
            style={dynamicStyles.headerButton}
            onPress={handleSave}
            disabled={savingProfile || pageLoading || uploadingImage} // Also disable save while uploading image
        >
            {savingProfile ? (
                <ActivityIndicator size="small" color={dynamicStyles.headerButtonText.color} />
            ) : (
                <Text style={dynamicStyles.headerButtonText}>Save</Text>
            )}
         </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={dynamicStyles.scrollContentContainer}
        keyboardShouldPersistTaps="handled" // Dismiss keyboard on scroll tap
      >
        {/* Profile Picture Section */}
        <View style={dynamicStyles.profilePicSection}>
          <TouchableOpacity
            style={dynamicStyles.profilePicContainer}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            disabled={uploadingImage} // Disable while uploading
          >
            <Image
              // Use pfp state, fallback to defaultProfilePic if pfp is null
              source={pfp ? { uri: pfp } : defaultProfilePic}
              style={dynamicStyles.profilePic}
              // Provide defaultSource only if pfp has a value (network image)
              defaultSource={pfp ? defaultProfilePic : undefined}
            />
            {/* Edit Icon Overlay */}
            {!uploadingImage && (
              <View style={dynamicStyles.editIconOverlay}>
                <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
              </View>
            )}
            {/* Uploading Spinner Overlay */}
            {uploadingImage && (
              <View style={dynamicStyles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(true)} disabled={uploadingImage}>
             <Text style={dynamicStyles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Input Fields Section */}
        <View style={dynamicStyles.inputGroup}>
            <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.inputLabel}>Name</Text>
                <TextInput
                    style={dynamicStyles.textInput}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor={dynamicStyles.textInputPlaceholder.color}
                    autoCapitalize="words"
                    textContentType="name" // Hint for autofill
                    returnKeyType="next" // Suggest 'next' action on keyboard
                    // onSubmitEditing={() => { /* Focus next input if available */ }}
                />
            </View>
            <View style={dynamicStyles.separator} />
            <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.inputLabel}>Username</Text>
                <TextInput
                    style={dynamicStyles.textInput}
                    value={newUsername}
                    onChangeText={setNewUsername}
                    placeholder="Enter your username"
                    placeholderTextColor={dynamicStyles.textInputPlaceholder.color}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username" // Hint for autofill
                    returnKeyType="done" // Suggest 'done' action on keyboard
                    // onSubmitEditing={handleSave} // Optionally trigger save on 'done'
                />
            </View>
        </View>

        {/* Optional: Add other profile fields here following the same pattern */}

      </ScrollView>

      {/* Image Source Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        {/* Use Pressable overlay to close modal on outside tap */}
        <Pressable style={dynamicStyles.modalOverlay} onPress={() => setModalVisible(false)}>
          {/* Use Pressable for content to prevent closing when tapping inside */}
          <Pressable style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Change Photo</Text>
            <TouchableOpacity style={dynamicStyles.modalOption} onPress={() => pickImage(true)}>
              <Ionicons name="camera-outline" size={22} color={dynamicStyles.modalOptionText.color} />
              <Text style={dynamicStyles.modalOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.modalOption} onPress={() => pickImage(false)}>
              <Ionicons name="image-outline" size={22} color={dynamicStyles.modalOptionText.color} />
              <Text style={dynamicStyles.modalOptionText}>Choose From Library</Text>
            </TouchableOpacity>
             <TouchableOpacity
                style={[dynamicStyles.modalOption, dynamicStyles.modalCancelOption]}
                onPress={() => setModalVisible(false)}
            >
              {/* Removed icon from cancel button for standard action sheet look */}
              <Text style={[dynamicStyles.modalOptionText, dynamicStyles.modalCancelText]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Web Camera Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isWebCameraVisible}
        onRequestClose={handleWebCancel} // Use cancel handler
      >
        <WebCamera onCapture={handleWebCapture} onCancel={handleWebCancel} isDarkTheme={isDarkTheme} />
      </Modal>

    </SafeAreaView>
  );
}

// --- Styles ---
const AppColors = {
  lightBackground: '#F7F7F7', lightCard: '#FFFFFF', lightTextPrimary: '#000000', lightTextSecondary: '#6D6D72', lightTextTertiary: '#BCBBC1', lightBorder: '#E5E5E5', lightAccent: '#007AFF', lightDestructive: '#FF3B30', lightSystemGray5: '#E9E9EA', lightModalBackdrop: 'rgba(0, 0, 0, 0.4)',
  darkBackground: '#000000', darkCard: '#1C1C1E', darkTextPrimary: '#FFFFFF', darkTextSecondary: '#8E8E93', darkTextTertiary: '#48484A', darkBorder: '#38383A', darkAccent: '#0A84FF', darkDestructive: '#FF453A', darkSystemGray5: '#2C2C2E', darkModalBackdrop: 'rgba(0, 0, 0, 0.6)',
  appAccentPurple: '#9067C6', // Keep your accent if needed elsewhere
};

const getStyles = (isDarkTheme: boolean) => {
  const colors = {
    background: isDarkTheme ? AppColors.darkBackground : AppColors.lightBackground,
    card: isDarkTheme ? AppColors.darkCard : AppColors.lightCard,
    textPrimary: isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightTextPrimary,
    textSecondary: isDarkTheme ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
    textTertiary: isDarkTheme ? AppColors.darkTextTertiary : AppColors.lightTextTertiary,
    border: isDarkTheme ? AppColors.darkBorder : AppColors.lightBorder,
    accent: isDarkTheme ? AppColors.darkAccent : AppColors.lightAccent, // Use system blue for actions
    destructive: isDarkTheme ? AppColors.darkDestructive : AppColors.lightDestructive,
    modalBackdrop: isDarkTheme ? AppColors.darkModalBackdrop : AppColors.lightModalBackdrop,
    // Use a semi-transparent card background for the action sheet modal for iOS look
    modalCard: isDarkTheme ? 'rgba(44, 44, 46, 0.9)' : 'rgba(242, 242, 247, 0.9)', // System Gray 5 with transparency
    appAccent: AppColors.appAccentPurple, // Your purple
  };

  return StyleSheet.create({
    // --- Containers ---
    screenContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingIndicator: {
      color: colors.textSecondary,
    },
    scrollContentContainer: {
      paddingBottom: 40,
    },
    // --- Header ---
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8, // Less horizontal padding for buttons
      paddingBottom: 10,
      paddingTop: Platform.OS === 'ios' ? 10 : (StatusBar.currentHeight || 0) + 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.card, // Match card background
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600', // Semibold for iOS header title
      color: colors.textPrimary,
      textAlign: 'center',
      flex: 1, // Allow title to center itself
    },
    headerButton: {
        paddingHorizontal: 8, // Padding for touch area
        paddingVertical: 5,
        minWidth: 50, // Ensure minimum width for tap target
        height: 30, // Explicit height for alignment
        justifyContent: 'center', // Center vertically
        alignItems: 'center', // Center horizontally
    },
    headerButtonText: {
        fontSize: 17,
        fontWeight: '400', // Regular weight for save button text
        color: colors.accent, // Use accent color
    },
    // --- Profile Picture ---
    profilePicSection: {
      alignItems: 'center',
      paddingVertical: 30,
      backgroundColor: colors.card, // Section background
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    profilePicContainer: {
      width: 110, // Slightly larger
      height: 110,
      borderRadius: 55,
      marginBottom: 15,
      backgroundColor: colors.background, // Placeholder bg
      position: 'relative', // For overlays
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 1,
      borderColor: colors.border,
    },
    profilePic: {
      width: '100%',
      height: '100%',
      borderRadius: 55,
    },
    editIconOverlay: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 6,
      borderRadius: 15, // Make it circular
    },
    uploadingOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 55,
    },
    changePhotoText: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.accent, // Use accent color for the text button
        marginTop: 5,
    },
    // --- Input Fields ---
    inputGroup: {
      marginHorizontal: 16,
      marginTop: 30,
      backgroundColor: colors.card,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 1, // Add subtle border
      borderColor: colors.border,
    },
    inputContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10, // Adjusted padding
    },
    inputLabel: {
      fontSize: 13, // Smaller label size
      color: colors.textSecondary,
      marginBottom: 4, // Space between label and input
      fontWeight: '400',
    },
    textInput: {
      fontSize: 17, // Standard iOS input size
      color: colors.textPrimary,
      paddingVertical: 4, // Minimal vertical padding for input itself
      // Remove background color, rely on inputGroup background
    },
    textInputPlaceholder: {
        color: colors.textTertiary, // Use tertiary color for placeholder
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 16, // Indent separator line
    },
    // --- Image Selection Modal (Action Sheet Style) ---
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalBackdrop,
      justifyContent: 'flex-end', // Position modal at the bottom
    },
    modalContent: {
      backgroundColor: colors.modalCard, // Use semi-transparent card color
      marginHorizontal: 8, // Add horizontal margin
      borderRadius: 14, // Standard iOS action sheet radius
      overflow: 'hidden', // Clip options
      marginBottom: 8, // Margin before cancel button
    },
    modalTitle: {
      fontSize: 13, // Standard iOS action sheet title size
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 12, // Padding for title area
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center', // Center content horizontally
      paddingVertical: 15, // Standard iOS action sheet item height
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalOptionText: {
      fontSize: 20, // Standard iOS action sheet text size
      color: colors.accent, // Blue action text
      // marginLeft: 15, // Removed, text is centered
    },
    modalCancelOption: {
        borderBottomWidth: 0, // No border for cancel
        marginTop: 8, // Space between options and cancel
        backgroundColor: colors.card, // Use standard card background for cancel
        borderRadius: 14, // Match radius
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 8, // Match horizontal margin
        marginBottom: Platform.OS === 'ios' ? 30 : 15, // Bottom safe area padding
    },
    modalCancelText: {
        fontWeight: '600', // Bold cancel text
        color: colors.accent, // Blue cancel text
        fontSize: 20, // Match option text size
        // marginLeft: 0, // Removed
    },
    // --- Web Camera Modal ---
    webCameraContainer: { // Renamed for clarity
      flex: 1,
      backgroundColor: colors.background, // Match app background
    },
  });
};
