// app/settings.tsx
import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Switch,
  // Alert, // No longer needed for confirmations
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { UserContext } from './UserContext';
import BackButton from '../components/ui/BackButton';
import InAppMessage from '../components/ui/InAppMessage';
import ConfirmationModal from '../components/ui/ConfirmationModal'; // Import the custom modal

// Configuration
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const defaultProfilePic = require('../assets/images/logo.png');

// SettingsScreen Component
export default function SettingsScreen() {
  const router = useRouter();
  const { userToken, setUserToken, isDarkTheme, toggleTheme } = useContext(UserContext);

  // --- State ---
  const [pageLoading, setPageLoading] = useState(true);
  const [username, setUsername] = useState<string>('Guest');
  const [fullName, setFullName] = useState<string>('Guest');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isPushNotificationsEnabled, setIsPushNotificationsEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Used for modal confirm button loading state

  // --- InAppMessage State ---
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  // --- Confirmation Modal State ---
  const [modalInfo, setModalInfo] = useState<{
      visible: boolean;
      type: 'delete' | 'deactivate' | null; // Track which action is being confirmed
      title: string;
      message: string;
  }>({ visible: false, type: null, title: '', message: '' });

  // --- Styles ---
  const dynamicStyles = getStyles(isDarkTheme);
  const themeStatusBar = isDarkTheme ? 'light-content' : 'dark-content';
  const themeBackgroundColor = dynamicStyles.container.backgroundColor;

  // --- Helper: Show InAppMessage ---
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
  }, []);


  // --- Fetch User Data ---
  const fetchUsernameAndProfile = useCallback(async () => {
    // ... (fetch logic remains the same) ...
    if (!userToken) {
      setUsername('Guest'); setFullName('Guest'); setProfilePicture(null); setPageLoading(false); return;
    }
    setPageLoading(true);
    try {
      const userRes = await fetch(`${domaindynamo}/get-username`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: userToken }) });
      const userData = await userRes.json();
      if (userData.status === 'Success' && userData.username) {
        const fetchedUsername = userData.username; setUsername(fetchedUsername);
        const [fullNameData, pfpData] = await Promise.all([ fetch(`${domaindynamo}/get-full-name?username=${encodeURIComponent(fetchedUsername)}`).then(res => res.json()), fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(fetchedUsername)}`).then(res => res.json()) ]);
        setFullName(fullNameData.status === 'Success' ? fullNameData.full_name || 'Unknown' : 'Unknown');
        setProfilePicture(pfpData.status === 'Success' ? pfpData.profile_picture : null);
      } else {
        console.warn("Username fetch failed or user not found, resetting state."); setUsername('Guest'); setFullName('Guest'); setProfilePicture(null);
      }
    } catch (error) {
      console.error('Error fetching username or profile:', error); setUsername('Guest'); setFullName('Guest'); setProfilePicture(null); showInAppMessage('Unable to fetch user profile. Please check your connection.', 'error');
    } finally {
      setPageLoading(false);
    }
  }, [userToken, setUserToken, showInAppMessage]);

  useEffect(() => {
    fetchUsernameAndProfile();
  }, [fetchUsernameAndProfile]);

  // --- Handle Navigation on userToken Change ---
  useEffect(() => {
    if (!pageLoading && userToken === null) {
      console.log("User token is null, redirecting to home."); router.replace('/');
    }
  }, [userToken, pageLoading, router]);

  // --- Logout ---
  const handleLogout = useCallback(() => {
    setIsProcessing(true); // Show loading on the button itself
    console.log("Logging out..."); setUserToken(null);
  }, [setUserToken]);

  // --- Delete Account (Called by Modal) ---
  const handleDeleteAccount = useCallback(async (): Promise<boolean> => {
    if (!userToken || !username || username === 'Guest') {
      // Error should ideally be caught before showing modal, but double-check
      showInAppMessage('Authentication error. Please log in again.', 'error');
      return false;
    }
    // Loading state (isProcessing) is handled by the modal confirm button
    try {
      console.log(`Attempting to delete account for: ${username}`);
      const response = await fetch(`${domaindynamo}/delete-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      if (response.ok) {
        console.log(`Account deleted successfully for: ${username}`);
        setModalInfo({ visible: false, type: null, title: '', message: '' }); // Close modal first
        setUserToken(null); // Then trigger logout/redirect
        return true;
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
        console.error('Deletion failed:', response.status, errorData.message);
        showInAppMessage(errorData.message || 'Failed to delete account.', 'error');
        return false; // Indicate failure to stop modal loading
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      showInAppMessage('An unexpected network error occurred during deletion.', 'error');
      return false; // Indicate failure to stop modal loading
    }
  }, [userToken, username, setUserToken, showInAppMessage]);

  // --- Deactivate Account (Called by Modal) ---
  const handleDeactivateAccount = useCallback(async (): Promise<boolean> => {
    if (!userToken || !username || username === 'Guest') {
      showInAppMessage('Authentication error. Please log in again.', 'error');
      return false;
    }
    // Loading state handled by modal confirm button
    try {
      console.log(`Attempting to deactivate account for: ${username}`);
      const response = await fetch(`${domaindynamo}/deactivate-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      if (response.ok) {
        console.log(`Account deactivated successfully for: ${username}`);
        setModalInfo({ visible: false, type: null, title: '', message: '' }); // Close modal first
        setUserToken(null); // Then trigger logout/redirect
        return true;
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
        console.error('Deactivation failed:', response.status, errorData.message);
        showInAppMessage(errorData.message || 'Failed to deactivate account.', 'error');
        return false; // Indicate failure
      }
    } catch (error) {
      console.error('Error deactivating account:', error);
      showInAppMessage('An unexpected network error occurred during deactivation.', 'error');
      return false; // Indicate failure
    }
  }, [userToken, username, setUserToken, showInAppMessage]);

  // --- Show Confirmation Modals ---
  const showDeleteConfirmation = useCallback(() => {
    if (!username || username === 'Guest') {
        showInAppMessage('You must be logged in to perform this action.', 'info');
        return;
    };
    setModalInfo({
        visible: true,
        type: 'delete',
        title: 'Delete Account',
        message: 'Are you sure you want to permanently delete your account? All your data will be lost. This action cannot be undone.'
    });
  }, [username, showInAppMessage]);

  const showDeactivateConfirmation = useCallback(() => {
     if (!username || username === 'Guest') {
        showInAppMessage('You must be logged in to perform this action.', 'info');
        return;
    };
     setModalInfo({
        visible: true,
        type: 'deactivate',
        title: 'Deactivate Account',
        message: 'Are you sure you want to deactivate your account? You can reactivate it by logging in again.'
    });
  }, [username, showInAppMessage]);

  // --- Modal Action Handlers ---
  const handleModalConfirm = async () => {
    setIsProcessing(true); // Start loading on modal confirm button
    let success = false;
    if (modalInfo.type === 'delete') {
        success = await handleDeleteAccount();
    } else if (modalInfo.type === 'deactivate') {
        success = await handleDeactivateAccount();
    }
    // Only stop loading if the action failed (otherwise component unmounts/redirects)
    if (!success) {
        setIsProcessing(false);
        // Keep the modal open on failure so the user sees the InAppMessage error
        // setModalInfo({ visible: false, type: null, title: '', message: '' }); // Don't close on failure
    }
  };

  const handleModalCancel = () => {
    setModalInfo({ visible: false, type: null, title: '', message: '' });
    setIsProcessing(false); // Ensure processing stops if modal is cancelled
  };


  // --- Navigation ---
  const handleEditProfile = useCallback(() => router.push('/editprofile'), [router]);
  const handleEditPreferences = useCallback(() => router.push('/preferences'), [router]);

  // --- Loading State ---
  if (pageLoading) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer}>
        <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />
        <ActivityIndicator size="large" color={dynamicStyles.loadingIndicator.color} />
      </SafeAreaView>
    );
  }

  // --- Render ---
  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />
      <View style={dynamicStyles.headerContainer}>
         <BackButton />
         <Text style={dynamicStyles.headerTitle}>Settings</Text>
         <View style={{ width: 50 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerStyle={dynamicStyles.scrollContentContainer}>
        {/* Profile Section */}
        <View style={dynamicStyles.profileSection}>
          <Image
            style={dynamicStyles.profilePic}
            source={profilePicture ? { uri: profilePicture } : defaultProfilePic}
            defaultSource={defaultProfilePic}
          />
          <Text style={dynamicStyles.fullNameText}>{fullName}</Text>
          <Text style={dynamicStyles.usernameText}>@{username}</Text>
        </View>

        {/* Settings Groups */}
        <View style={dynamicStyles.settingsGroup}>
          <Text style={dynamicStyles.groupHeader}>Account</Text>
          <SettingItem
            icon="person-outline"
            label="Edit Profile"
            onPress={handleEditProfile}
            isDarkTheme={isDarkTheme}
            showChevron
          />
          <SettingItem
            icon="options-outline"
            label="Edit Preferences"
            onPress={handleEditPreferences}
            isDarkTheme={isDarkTheme}
            showChevron
            isLast
          />
        </View>

        <View style={dynamicStyles.settingsGroup}>
          <Text style={dynamicStyles.groupHeader}>Appearance</Text>
          <SettingItem
            icon="moon-outline"
            label="Dark Mode"
            isDarkTheme={isDarkTheme}
            isLast
          >
            <Switch
              value={isDarkTheme}
              onValueChange={toggleTheme}
              thumbColor={Platform.OS === 'android' ? dynamicStyles.switchThumb.color : undefined}
              trackColor={{
                  false: dynamicStyles.switchTrackOff.backgroundColor,
                  true: dynamicStyles.switchTrackOnGreen.backgroundColor
              }}
              ios_backgroundColor={dynamicStyles.switchTrackOff.backgroundColor}
            />
          </SettingItem>
        </View>

        <View style={dynamicStyles.settingsGroup}>
          <Text style={dynamicStyles.groupHeader}>Notifications</Text>
          <SettingItem
            icon="notifications-outline"
            label="Push Notifications"
            isDarkTheme={isDarkTheme}
            isLast
          >
            <Switch
              value={isPushNotificationsEnabled}
              onValueChange={() => setIsPushNotificationsEnabled(!isPushNotificationsEnabled)}
              thumbColor={Platform.OS === 'android' ? dynamicStyles.switchThumb.color : undefined}
               trackColor={{
                  false: dynamicStyles.switchTrackOff.backgroundColor,
                  true: dynamicStyles.switchTrackOnGreen.backgroundColor
              }}
              ios_backgroundColor={dynamicStyles.switchTrackOff.backgroundColor}
            />
          </SettingItem>
        </View>

        {/* Account Management Section */}
        <View style={dynamicStyles.settingsGroup}>
           <SettingItem
            icon="log-out-outline"
            label="Logout"
            onPress={handleLogout} // Direct logout, no confirmation needed usually
            isDarkTheme={isDarkTheme}
            labelColor={dynamicStyles.actionLabelBlue.color}
            hideChevron
            isLoading={isProcessing && modalInfo.type === null} // Show loader only if logout is processing
            isLast={false}
          />
           <SettingItem
            icon="pause-circle-outline"
            label="Deactivate Account"
            onPress={showDeactivateConfirmation} // Show modal instead of direct action
            isDarkTheme={isDarkTheme}
            labelColor={dynamicStyles.actionLabelDestructive.color}
            hideChevron
            // isLoading prop removed from here, handled by modal
            isLast={false}
          />
          <SettingItem
            icon="trash-outline"
            label="Delete Account"
            onPress={showDeleteConfirmation} // Show modal instead of direct action
            isDarkTheme={isDarkTheme}
            labelColor={dynamicStyles.actionLabelDestructive.color}
            hideChevron
             // isLoading prop removed from here, handled by modal
            isLast
          />
        </View>
      </ScrollView>

      {/* Render InAppMessage */}
      <InAppMessage
          visible={messageVisible}
          message={messageText}
          type={messageType}
          onClose={() => setMessageVisible(false)}
      />

      {/* Render ConfirmationModal */}
      <ConfirmationModal
          visible={modalInfo.visible}
          title={modalInfo.title}
          message={modalInfo.message}
          confirmText={modalInfo.type === 'delete' ? 'Delete' : 'Deactivate'}
          cancelText="Cancel"
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          isConfirming={isProcessing} // Link modal loading state
          isDestructive={true} // Both actions are destructive
      />
    </SafeAreaView>
  );
}

// --- Setting Item Component ---
// [SettingItem component code remains the same]
interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; children?: React.ReactNode; isDarkTheme: boolean; showChevron?: boolean; isLast?: boolean; labelColor?: string; hideChevron?: boolean; isLoading?: boolean;
}
const SettingItem: React.FC<SettingItemProps> = ({ icon, label, onPress, children, isDarkTheme, showChevron = false, isLast = false, labelColor, hideChevron = false, isLoading = false, }) => {
  const dynamicStyles = getStyles(isDarkTheme); const finalLabelColor = labelColor || dynamicStyles.settingItemLabel.color; const iconColor = labelColor || dynamicStyles.settingItemIcon.color;
  const content = ( <View style={[dynamicStyles.settingItemContainer, isLast && dynamicStyles.settingItemContainerLast]}> <View style={dynamicStyles.settingItemContent}> <Ionicons name={icon} size={dynamicStyles.settingItemIcon.fontSize} color={iconColor} style={dynamicStyles.settingItemIcon} /> <Text style={[dynamicStyles.settingItemLabel, { color: finalLabelColor }]}> {label} </Text> </View> <View style={dynamicStyles.settingItemControl}> {isLoading ? ( <ActivityIndicator size="small" color={dynamicStyles.loadingIndicatorSmall.color} /> ) : children ? ( children ) : showChevron && onPress && !hideChevron ? ( <Ionicons name="chevron-forward-outline" size={20} color={dynamicStyles.chevron.color} /> ) : null} </View> </View> );
  return onPress ? ( <TouchableOpacity onPress={onPress} disabled={isLoading}> {content} </TouchableOpacity> ) : ( content );
};


// --- Styles ---
// [AppColors definition remains the same]
const AppColors = {
  lightBackground: '#F7F7F7', lightCard: '#FFFFFF', lightTextPrimary: '#000000', lightTextSecondary: '#6D6D72', lightTextTertiary: '#BCBBC1', lightBorder: '#E5E5E5', lightAccent: '#007AFF', lightDestructive: '#FF3B30', lightSwitchTrackOff: '#E9E9EA', lightSwitchThumb: '#FFFFFF', lightSystemGreen: '#34C759',
  darkBackground: '#000000', darkCard: '#1C1C1E', darkTextPrimary: '#FFFFFF', darkTextSecondary: '#8E8E93', darkTextTertiary: '#48484A', darkBorder: '#38383A', darkAccent: '#0A84FF', darkDestructive: '#FF453A', darkSwitchTrackOff: '#333333', darkSwitchThumb: '#FFFFFF', darkSystemGreen: '#30D158',
  appAccentPurple: '#9067C6',
};

const getStyles = (isDarkTheme: boolean) => {
  const colors = {
    background: isDarkTheme ? AppColors.darkBackground : AppColors.lightBackground, card: isDarkTheme ? AppColors.darkCard : AppColors.lightCard, textPrimary: isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightTextPrimary, textSecondary: isDarkTheme ? AppColors.darkTextSecondary : AppColors.lightTextSecondary, textTertiary: isDarkTheme ? AppColors.darkTextTertiary : AppColors.lightTextTertiary, border: isDarkTheme ? AppColors.darkBorder : AppColors.lightBorder, accent: AppColors.appAccentPurple, destructive: isDarkTheme ? AppColors.darkDestructive : AppColors.lightDestructive, switchTrackOn: isDarkTheme ? AppColors.darkSystemGreen : AppColors.lightSystemGreen, switchTrackOff: isDarkTheme ? AppColors.darkSwitchTrackOff : AppColors.lightSwitchTrackOff, switchThumb: isDarkTheme ? AppColors.darkSwitchThumb : AppColors.lightSwitchThumb, iconDefault: isDarkTheme ? AppColors.darkTextSecondary : AppColors.lightTextSecondary, actionBlue: isDarkTheme ? AppColors.darkAccent : AppColors.lightAccent,
  };
  // [StyleSheet definition remains the same]
  return StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, }, loadingIndicator: { color: isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightTextSecondary, }, loadingIndicatorSmall: { color: colors.textSecondary, }, container: { flex: 1, backgroundColor: colors.background, }, headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, paddingTop: Platform.OS === 'ios' ? 10 : (StatusBar.currentHeight || 0) + 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card, }, headerTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, }, scrollContentContainer: { paddingBottom: 40, }, profileSection: { alignItems: 'center', paddingVertical: 30, backgroundColor: colors.card, marginBottom: 20, }, profilePic: { width: 100, height: 100, borderRadius: 50, marginBottom: 15, backgroundColor: colors.background, borderWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 1, borderColor: colors.border, }, fullNameText: { fontSize: 22, fontWeight: '600', color: colors.textPrimary, marginBottom: 4, }, usernameText: { fontSize: 16, color: colors.textSecondary, }, settingsGroup: { marginHorizontal: 16, marginBottom: 25, backgroundColor: colors.card, borderRadius: 10, overflow: 'hidden', }, groupHeader: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 15, paddingBottom: 8, }, settingItemContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: 'transparent', }, settingItemContainerLast: { borderBottomWidth: 0, }, settingItemContent: { flexDirection: 'row', alignItems: 'center', flex: 1, }, settingItemIcon: { marginRight: 15, width: 24, textAlign: 'center', fontSize: 22, color: colors.iconDefault, }, settingItemLabel: { fontSize: 16, flexShrink: 1, color: colors.textPrimary, }, settingItemControl: { marginLeft: 10, }, chevron: { color: colors.textTertiary, }, actionLabelBlue: { color: colors.actionBlue, }, actionLabelDestructive: { color: colors.destructive, }, switchTrackOnGreen: { backgroundColor: colors.switchTrackOn, }, switchTrackOff: { backgroundColor: colors.switchTrackOff, }, switchThumb: { color: colors.switchThumb, },
  });
};
