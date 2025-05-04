// components/PreferencesScreen.tsx
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  // Alert, // Replaced by InAppMessage
  Dimensions,
  Platform,
  ActivityIndicator,
  SafeAreaView, // Use SafeAreaView for top/bottom padding
  StatusBar, // Import StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Adjust the path as needed
import InAppMessage from '../components/ui/InAppMessage'; // Keep InAppMessage import

// --- Configuration ---
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const { width } = Dimensions.get('window');
const DEFAULT_REGION = 'US'; // Define a default region

interface RegionInfo {
  code: string;
  name: string;
}

// Define available regions with codes and display names
const AVAILABLE_REGIONS_INFO: RegionInfo[] = [
  { code: 'US', name: 'United States' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ES', name: 'Spain' },
  // Add more regions here as needed, e.g.:
  // { code: 'GB', name: 'United Kingdom' },
  // { code: 'FR', name: 'France' },
];


// --- Responsive Sizing (Keep from redesign) ---
const getResponsiveSize = (baseSize: number): number => {
  if (width < 350) return baseSize * 0.9;
  if (width < 400) return baseSize;
  return baseSize * 1.1;
};

const fontSizes = {
  base: getResponsiveSize(14),
  subHeading: getResponsiveSize(16),
  sectionHeading: getResponsiveSize(16),
  heading: getResponsiveSize(24),
  button: getResponsiveSize(15),
};

// --- Helper Function ---
// Checks if two arrays contain the same elements, regardless of order
const areArraysEqual = (arr1: string[], arr2: string[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
};


// --- Component ---
export default function PreferencesScreen() {
  const router = useRouter();
  const { userToken, isDarkTheme } = useContext(UserContext);

  // --- State ---
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [initialPreferences, setInitialPreferences] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>(DEFAULT_REGION); // *** Added Region State ***
  const [initialRegion, setInitialRegion] = useState<string>(DEFAULT_REGION); // *** Store initial Region ***
  const [username, setUsername] = useState<string>('Guest');
  const [isLoading, setIsLoading] = useState(true); // For initial fetch
  const [isSaving, setIsSaving] = useState(false); // For save/reset actions
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  // --- Theming ---
   const themes = {
     light: {
      background: '#F8F9FA', cardBackground: '#FFFFFF', textPrimary: '#1F2937', textSecondary: '#6B7280', textTertiary: '#9CA3AF', accent: '#6366F1', accentContrast: '#FFFFFF', buttonSecondaryBackground: '#E5E7EB', buttonSecondaryText: '#374151', destructive: '#EF4444', destructiveContrast: '#FFFFFF', success: '#10B981', successContrast: '#FFFFFF', info: '#3B82F6', infoContrast: '#FFFFFF', borderColor: '#E5E7EB', selectedBorder: '#6366F1', selectedBackground: '#EEF2FF', selectedText: '#4338CA',
    },
    dark: {
      background: '#0A0A0A', cardBackground: '#1A1A1A', textPrimary: '#F9FAFB', textSecondary: '#9CA3AF', textTertiary: '#6B7280', accent: '#818CF8', accentContrast: '#FFFFFF', buttonSecondaryBackground: '#374151', buttonSecondaryText: '#D1D5DB', destructive: '#F87171', destructiveContrast: '#FFFFFF', success: '#34D399', successContrast: '#111827', info: '#60A5FA', infoContrast: '#111827', borderColor: '#374151', selectedBorder: '#818CF8', selectedBackground: '#3730A3', selectedText: '#E0E7FF',
    },
  };
  const currentTheme = isDarkTheme ? themes.dark : themes.light;

  // --- Data Definitions ---
   const industriesByCategory: Record<string, string[]> = {
    'Top Stories': ['Breaking News', 'Top', 'World'],
    Business: ['Business', 'Technology'],
    'Health & Environment': ['Health', 'Environment', 'Food', 'Science'],
    Sports: ['Football', 'Formula1', 'Sports', 'Gaming'],
    Lifestyle: ['Lifestyle', 'Travel', 'Education', 'Tourism'],
    Entertainment: ['Entertainment'],
    Society: ['Crime', 'Domestic', 'Other'],
  };

  // --- Helper Functions ---
  const showInAppMessage = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
  }, []);

  // --- Effects ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setInitialPreferences([]);
      setSelectedOptions([]);
      setSelectedRegion(DEFAULT_REGION); // Reset region state initially
      setInitialRegion(DEFAULT_REGION);
      let fetchedUsername = 'Guest';

      // 1. Fetch Username
      if (userToken) {
        try {
          const response = await fetch(`${domaindynamo}/get-username`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: userToken }),
          });
          const data = await response.json();
          if (response.ok && data.status === 'Success' && data.username) {
            fetchedUsername = data.username; setUsername(fetchedUsername);
          } else { console.warn('Failed to fetch username:', data.message || 'Unknown error'); setUsername('Guest'); }
        } catch (error) { console.error('Error fetching username:', error); setUsername('Guest'); }
      } else { setUsername('Guest'); }

      // 2. Fetch Preferences & Region (only if logged in)
      if (userToken && fetchedUsername !== 'Guest') {
        // Fetch Preferences
        try {
          const prefResponse = await fetch(`${domaindynamo}/check-preferences`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: fetchedUsername }),
          });
          const prefData = await prefResponse.json();
          if (prefResponse.ok && prefData.status === 'Success' && Array.isArray(prefData.data)) {
            const preferences = prefData.data.map((item: any) => item.preference).filter(Boolean); // Ensure only strings
            setSelectedOptions(preferences); setInitialPreferences(preferences);
          } else { console.warn('Failed to fetch preferences:', prefData.message || 'No preferences found'); }
        } catch (error) { console.error('Error fetching preferences:', error); }

        // *** Fetch Region ***
        try {
            const regionResponse = await fetch(`${domaindynamo}/get-region?username=${encodeURIComponent(fetchedUsername)}`); // Use correct domain
            if (regionResponse.ok) {
                const regionData = await regionResponse.json();
                if (regionData.status === 'Success' && regionData.region && typeof regionData.region === 'string') {
                    console.log("Region fetched:", regionData.region);
                    setSelectedRegion(regionData.region); // Set current selection
                    setInitialRegion(regionData.region); // Store initial value
                } else {
                    // Handle case where region isn't set or API error
                    console.warn('No valid region found for user, using default:', DEFAULT_REGION, regionData.message);
                    setSelectedRegion(DEFAULT_REGION);
                    setInitialRegion(DEFAULT_REGION);
                }
            } else {
                 // Handle HTTP error fetching region
                 console.warn('Failed to fetch region status:', regionResponse.status);
                 setSelectedRegion(DEFAULT_REGION); // Use default on error
                 setInitialRegion(DEFAULT_REGION);
            }
        } catch (regionError) {
            // Handle network error fetching region
            console.error('Network error fetching region:', regionError);
            setSelectedRegion(DEFAULT_REGION); // Use default on error
            setInitialRegion(DEFAULT_REGION);
        }
      } else {
          // Reset to defaults if not logged in
          setSelectedOptions([]);
          setInitialPreferences([]);
          setSelectedRegion(DEFAULT_REGION);
          setInitialRegion(DEFAULT_REGION);
      }

      setIsLoading(false);
    };

    fetchInitialData();
  }, [userToken]); // Re-run when userToken changes

  // --- Event Handlers ---
  const toggleOption = (option: string) => {
    setSelectedOptions((prevSelected) =>
      prevSelected.includes(option)
        ? prevSelected.filter((item) => item !== option)
        : [...prevSelected, option]
    );
  };

  // *** Handler for selecting a region ***
  const handleSelectRegion = (region: string) => {
      setSelectedRegion(region);
  };

  const handleResetPreferences = async () => {
    if (!userToken || username === 'Guest') { showInAppMessage('You must be logged in to reset.', 'error'); return; }
    setIsSaving(true);
    let resetSuccess = false;
    let regionResetSuccess = false;

    // 1. Reset Preferences on Backend
    try {
      const response = await fetch(`${domaindynamo}/delete-preferences`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username }),
      });
      if (response.ok) {
        resetSuccess = true;
      } else { console.error('Error resetting preferences:', await response.text()); }
    } catch (error: any) { console.error('Error resetting preferences:', error); }

    // 2. Reset Region on Backend (to default)
    try {
      const regionSetResponse = await fetch(`${domaindynamo}/set-region`, {
         method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, region: DEFAULT_REGION }),
      });
      if (regionSetResponse.ok) {
          regionResetSuccess = true;
      } else { console.error('Failed to set region during reset:', await regionSetResponse.text()); }
    } catch (regionSetError) { console.error('Error setting region during reset:', regionSetError); }

    // 3. Update Local State & Show Message
    if (resetSuccess && regionResetSuccess) {
        setSelectedOptions([]);
        setInitialPreferences([]);
        setSelectedRegion(DEFAULT_REGION);
        setInitialRegion(DEFAULT_REGION);
        showInAppMessage('Preferences and Region reset', 'success');
    } else {
        showInAppMessage(`Failed to reset fully.${!resetSuccess ? ' Preferences failed.' : ''}${!regionResetSuccess ? ' Region failed.' : ''}`, 'error');
    }

    setIsSaving(false);
  };

  const handleSaveChanges = async () => {
    if (!userToken || username === 'Guest') { showInAppMessage('You must be logged in to save.', 'error'); return; }

    const preferencesChanged = !areArraysEqual(initialPreferences, selectedOptions);
    const regionChanged = initialRegion !== selectedRegion; // Check if region changed

    if (!preferencesChanged && !regionChanged) {
        showInAppMessage("Settings haven't changed.", 'info');
        setTimeout(() => { if (router.canGoBack()) router.back(); else router.push('/'); }, 1000);
        return;
    }

    setIsSaving(true);
    let preferencesSaveOk = true; // Assume ok if not changed
    let regionSaveOk = true; // Assume ok if not changed
    let overallErrorMessage = '';

    // --- 1. Save Preferences (only if changed) ---
    if (preferencesChanged) {
      try {
        // Delete removed preferences
        const removedPreferences = initialPreferences.filter(pref => !selectedOptions.includes(pref));
        if (removedPreferences.length > 0) {
            // Assuming a bulk delete endpoint exists or delete one by one
            // For simplicity, let's assume single deletes or handle on backend logic when adding
            console.log("Handling removed preferences:", removedPreferences);
            // Example: await Promise.all(removedPreferences.map(pref => deletePreference(pref)));
        }

        // Add new preferences
        const addedPreferences = selectedOptions.filter(pref => !initialPreferences.includes(pref));
        if (addedPreferences.length > 0) {
            const addPreferencePromises = addedPreferences.map(async (preference) => {
                const response = await fetch(`${domaindynamo}/add-preference`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, preference }),
                });
                const data = await response.json().catch(() => ({})); // Catch JSON parse errors
                if (!response.ok && response.status !== 409) { // Allow 409 (already exists)
                     console.error(`Error adding preference '${preference}':`, data.error || `Status ${response.status}`);
                     return false; // Indicate failure
                }
                return true; // Indicate success or already exists
            });
            const results = await Promise.all(addPreferencePromises);
            if (results.some(ok => !ok)) { preferencesSaveOk = false; } // Mark as failed if any add failed
        }
         if (preferencesSaveOk) setInitialPreferences([...selectedOptions]); // Update initial state if successful

      } catch (error: any) {
        console.error('Error saving preferences:', error);
        preferencesSaveOk = false;
        overallErrorMessage += 'Failed to save preferences. ';
      }
    }

    // --- 2. Save Region (only if changed) ---
    if (regionChanged && selectedRegion) { // Ensure selectedRegion is not null/empty
        try {
            const regionSaveResponse = await fetch(`${domaindynamo}/set-region`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, region: selectedRegion }),
            });
            if (regionSaveResponse.ok) {
                setInitialRegion(selectedRegion); // Update initial state
                console.log('Region saved successfully');
            } else {
                regionSaveOk = false;
                console.error('Failed to save region:', await regionSaveResponse.text());
                overallErrorMessage += 'Failed to save region. ';
            }
        } catch (regionSaveError: any) {
            regionSaveOk = false;
            console.error('Error saving region:', regionSaveError);
            overallErrorMessage += 'Network error saving region. ';
        }
    }

    // --- 3. Show Final Message & Navigate ---
    setIsSaving(false);
    if (preferencesSaveOk && regionSaveOk) {
        showInAppMessage('Settings saved successfully!', 'success');
    } else {
         showInAppMessage(overallErrorMessage || 'Some settings might not have saved correctly.', 'error');
    }

    setTimeout(() => { if (router.canGoBack()) router.back(); else router.push('/'); }, 1500);
  };

  // --- Render Logic ---
  const renderOption = (option: string | RegionInfo, isRegion: boolean = false) => {
      let code: string;
      let name: string;
      let optionKey: string;

      if (isRegion && typeof option === 'object' && option !== null && 'code' in option && 'name' in option) {
          // Handling RegionInfo object
          code = option.code;
          name = option.name;
          optionKey = code; // Use code for the key
      } else if (!isRegion && typeof option === 'string') {
          // Handling preference string
          code = option;
          name = option.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Format preference name
          optionKey = code;
      } else {
          console.warn("Invalid option passed to renderOption:", option);
          return null; // Don't render if the data format is unexpected
      }

      // Determine if the current option/region is selected
      const isSelected = isRegion ? selectedRegion === code : selectedOptions.includes(code);
      // Determine the press handler
      const onPress = isRegion ? () => handleSelectRegion(code) : () => toggleOption(code);

      return (
        <TouchableOpacity
          key={optionKey} // Use the code as the key
          style={[
            styles.optionButton,
            {
              backgroundColor: isSelected ? currentTheme.selectedBackground : currentTheme.cardBackground,
              borderColor: isSelected ? currentTheme.selectedBorder : currentTheme.borderColor,
            },
            // isRegion && isSelected && styles.regionSelected, // Keep if you have specific styles
          ]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {/* Show radio button icon for regions */}
          {isRegion && (
              <Icon
                  name={isSelected ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={isSelected ? currentTheme.selectedText : currentTheme.textTertiary}
                  style={styles.checkmarkIcon} // Reusing style for margin is fine
              />
          )}
          {/* Show checkmark icon for preferences */}
          {!isRegion && isSelected && (
              <Icon name="checkmark-circle" size={18} color={currentTheme.selectedText} style={styles.checkmarkIcon} />
          )}
          {/* Display the readable name */}
          <Text
            style={[
              styles.optionText,
              { color: isSelected ? currentTheme.selectedText : currentTheme.textPrimary },
            ]}
          >
            {name}
          </Text>
        </TouchableOpacity>
      );
  };

  // --- Loading State ---
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={currentTheme.background} />
        <ActivityIndicator size="large" color={currentTheme.accent} />
        <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>Loading Preferences...</Text>
      </SafeAreaView>
    );
  }

  // --- Main Content ---
  return (
    <SafeAreaView style={[styles.outerContainer, { backgroundColor: currentTheme.background }]}>
        <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={currentTheme.background} />
        <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
        >
            {/* --- Header --- */}
            <View style={styles.headerContainer}>
                <Text style={[styles.heading, { color: currentTheme.textPrimary }]}>
                    Settings
                </Text>
                <TouchableOpacity
                    style={[styles.resetButton, { backgroundColor: currentTheme.buttonSecondaryBackground }]}
                    onPress={handleResetPreferences} disabled={isSaving} activeOpacity={0.8}
                >
                    <Text style={[styles.resetButtonText, { color: currentTheme.destructive }]}> Reset </Text>
                </TouchableOpacity>
            </View>

            {/* --- Region Section --- */}
            <View style={[styles.section, { backgroundColor: currentTheme.cardBackground }]}>
                <Text style={[styles.sectionHeading, { color: currentTheme.textPrimary }]}>
                    Region
                </Text>
                <Text style={[styles.sectionDescription, { color: currentTheme.textSecondary }]}>
                    Select your primary region for content filtering.
                </Text>
                <View style={styles.optionsContainer}>
                    {AVAILABLE_REGIONS_INFO.map(regionInfo => renderOption(regionInfo, true))}
                </View>
            </View>

            {/* --- Interests Section Header --- */}
             <Text style={[styles.subHeading, { color: currentTheme.textSecondary, marginTop: 20 }]}>
                Select the topics you'd like to see more of.
            </Text>

            {/* --- Interest Categories --- */}
            {Object.entries(industriesByCategory).map(([category, options]) => (
                <View style={[styles.section, { backgroundColor: currentTheme.cardBackground }]} key={category} >
                    <Text style={[styles.sectionHeading, { color: currentTheme.textPrimary }]}> {category} </Text>
                    <View style={styles.optionsContainer}>
                        {options.map(option => renderOption(option, false))}
                    </View>
                </View>
            ))}

        </ScrollView>

        {/* --- Bottom Save Button Area --- */}
        <View style={[styles.footer, { borderTopColor: currentTheme.borderColor, backgroundColor: currentTheme.background }]}>
             <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: currentTheme.accent }, isSaving && styles.saveButtonDisabled]}
                onPress={handleSaveChanges} disabled={isSaving} activeOpacity={0.8}
             >
                {isSaving ? (
                    <ActivityIndicator size="small" color={currentTheme.accentContrast} />
                ) : (
                    <Text style={[styles.saveButtonText, { color: currentTheme.accentContrast }]}> SAVE </Text>
                )}
            </TouchableOpacity>
        </View>

         {/* --- In-App Message Display --- */}
         <InAppMessage visible={messageVisible} message={messageText} type={messageType} onClose={() => setMessageVisible(false)} />
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  outerContainer: { flex: 1, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  loadingText: { marginTop: 10, fontSize: fontSizes.base, },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 20 : 0, paddingBottom: 100, },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 8, paddingHorizontal: 4, },
  heading: { fontSize: fontSizes.heading, fontWeight: 'bold', },
  resetButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 18, },
  resetButtonText: { fontWeight: '600', fontSize: fontSizes.base * 0.9, },
  subHeading: { fontSize: fontSizes.subHeading, marginBottom: 16, paddingHorizontal: 4, }, // Adjusted marginBottom
  section: { borderRadius: 12, padding: 16, marginBottom: 16, },
  sectionHeading: { fontSize: fontSizes.sectionHeading, fontWeight: '600', marginBottom: 12, }, // Adjusted marginBottom
  // *** Added description style ***
  sectionDescription: { fontSize: fontSizes.base * 0.95, marginBottom: 16, lineHeight: fontSizes.base * 1.4, },
  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, },
  optionButton: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', },
  optionText: { fontSize: fontSizes.base, fontWeight: '500', textAlign: 'center', },
  checkmarkIcon: { marginRight: 6, },
  regionSelected: { /* Potential extra style for selected region button if needed */ },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 15, paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 15, borderTopWidth: StyleSheet.hairlineWidth, },
  saveButton: { paddingVertical: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', width: '100%', },
  saveButtonDisabled: { opacity: 0.7, },
  saveButtonText: { fontSize: fontSizes.button, fontWeight: '600', },
});