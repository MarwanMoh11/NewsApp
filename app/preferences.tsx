// ------------------------------------------------------
// components/PreferencesScreen.tsx
// ------------------------------------------------------
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserContext } from '../app/UserContext'; // Adjust the path as needed

const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 350;

// Adjust font sizes based on screen width for responsiveness
const baseFontSize = isSmallScreen ? 12 : 14;
const headingFontSize = isSmallScreen ? 20 : 22;
const sectionHeadingFontSize = isSmallScreen ? 14 : 16;
const subHeadingFontSize = isSmallScreen ? 12 : 14;

type IndustryType = string;

// Define Theme Colors
const themes = {
  light: {
    background: '#F7F9FC',
    containerBackground: '#FFFFFF',
    resetButtonBackground: '#FF6F61',
    resetButtonText: '#FFFFFF',
    headingText: '#000000',
    subHeadingText: '#555555',
    sectionBackground: '#FFFFFF',
    sectionHeadingText: '#333333',
    optionButtonBackground: {
      selected: '#F7B8D2',
      unselected: '#FFFFFF',
    },
    optionButtonBorderColor: '#D1D8E0',
    optionTextColor: '#333333',
    selectedOptionTextColor: '#FFFFFF',
    viewButtonBackground: '#8A2BE2',
    viewButtonTextColor: '#FFFFFF',
    resetButtonShadow: '#000000',
    optionButtonShadow: '#000000',
    selectedOptionButtonShadow: '#000000',
    viewButtonShadow: '#000000',
    noRelatedText: '#777777',
    noCommentsText: '#777777',
  },
  dark: {
    background: '#1F2937',
    containerBackground: '#374151',
    resetButtonBackground: '#EF4444',
    resetButtonText: '#FFFFFF',
    headingText: '#F3F4F6',
    subHeadingText: '#D1D5DB',
    sectionBackground: '#374151',
    sectionHeadingText: '#F3F4F6',
    optionButtonBackground: {
      selected: '#6C63FF',
      unselected: '#374151',
    },
    optionButtonBorderColor: '#6C63FF',
    optionTextColor: '#FFFFFF',
    selectedOptionTextColor: '#FFFFFF',
    viewButtonBackground: '#6C63FF',
    viewButtonTextColor: '#FFFFFF',
    resetButtonShadow: '#000000',
    optionButtonShadow: '#000000',
    selectedOptionButtonShadow: '#000000',
    viewButtonShadow: '#000000',
    noRelatedText: '#D1D5DB',
    noCommentsText: '#D1D5DB',
  },
};

export default function PreferencesScreen() {
  const [selectedOptions, setSelectedOptions] = useState<IndustryType[]>([]);
  const [username, setUsername] = useState<string>('Guest');
  const router = useRouter();
  const { userToken, isDarkTheme } = useContext(UserContext); // Consume isDarkTheme

  const currentTheme = isDarkTheme ? themes.dark : themes.light;

  const industriesByCategory: Record<string, string[]> = {
    News: ['BREAKING NEWS', 'POLITICS', 'Top'],
    'Health & Wellness': ['HEALTH', 'Environment', 'Food'],
    Sports: ['Football', 'Formula1', 'SPORTS'],
    'Technology & Gaming': ['Technology', 'Gaming'],
    Lifestyle: [
      'Business',
      'Travel',
      'Health',
      'Education',
      'Lifestyle',
      'Tourism',
      'World',
    ],
    'Arts & Entertainment': ['Entertainment'],
    Other: ['Science', 'CRIME', 'Domestic', 'Other'],
  };

  useEffect(() => {
    const fetchUsername = async () => {
      if (!userToken) {
        setUsername('Guest');
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
        } else {
          setUsername('Guest');
        }
      } catch (error) {
        console.error('Error fetching username:', error);
        setUsername('Guest');
      }
    };

    fetchUsername();
  }, [userToken]);

  useEffect(() => {
    const fetchPreferences = async (username: string) => {
      if (!userToken || username === 'Guest') return;

      try {
        const response = await fetch(`${domaindynamo}/check-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username }),
        });

        const data = await response.json();

        if (data.status === 'Success' && Array.isArray(data.data)) {
          const preferences = data.data.map((item: any) => item.preference);
          setSelectedOptions(preferences.length ? preferences : []);
        } else {
          setSelectedOptions([]);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
        setSelectedOptions([]);
      }
    };

    if (username !== 'Guest') {
      fetchPreferences(username);
    }
  }, [username, userToken]);

  const toggleOption = (option: IndustryType) => {
    setSelectedOptions((prevSelected) =>
      prevSelected.includes(option)
        ? prevSelected.filter((item) => item !== option)
        : [...prevSelected, option]
    );
  };

  const handleResetPreferences = async (username: string) => {
    if (!userToken || username === 'Guest') return;

    try {
      const response = await fetch(`${domaindynamo}/delete-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username }),
      });

      if (response.ok) {
        setSelectedOptions([]);
      } else {
        console.error('Error resetting preferences:', await response.json());
      }
    } catch (error) {
      console.error('Error resetting preferences:', error);
    }
  };

  const handleViewClick = async (username: string) => {
    if (!userToken || username === 'Guest') {
      Alert.alert('Error', 'You must be logged in to save preferences.');
      return;
    }

    if (selectedOptions.length === 0) {
      Alert.alert('No Preferences', 'Please select at least one preference.');
      return;
    }

    try {
      const addPreferencePromises = selectedOptions.map(async (preference) => {
        const response = await fetch(`${domaindynamo}/add-preference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, preference }),
        });

        const data = await response.json();
        if (response.status === 409) {
          console.warn(data.message);
        } else if (response.status !== 200) {
          console.error('Error adding preference:', data.error);
        }
      });

      await Promise.all(addPreferencePromises);

      Alert.alert('Success', 'Your preferences have been saved.');
      router.push('/');
    } catch (error) {
      console.error('Error handling view click:', error);
      Alert.alert('Error', 'Failed to save preferences.');
    }
  };

  const numColumns = width < 400 ? 2 : 3;

  const renderOption = ({ item }: { item: IndustryType }) => {
    const isSelected = selectedOptions.includes(item);

    return (
      <TouchableOpacity
        style={[
          styles.optionButton,
          isSelected && styles.selectedOptionButton,
          {
            backgroundColor: isDarkTheme
              ? isSelected
                ? themes.dark.optionButtonBackground.selected
                : themes.dark.optionButtonBackground.unselected
              : isSelected
              ? themes.light.optionButtonBackground.selected
              : themes.light.optionButtonBackground.unselected,
            borderColor: isDarkTheme
              ? themes.dark.optionButtonBorderColor
              : themes.light.optionButtonBorderColor,
            shadowColor: currentTheme.optionButtonShadow,
          },
        ]}
        onPress={() => toggleOption(item)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.optionText,
            isSelected && styles.selectedOptionText,
            { color: isDarkTheme ? themes.dark.optionTextColor : themes.light.optionTextColor },
          ]}
        >
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContainer,
        { backgroundColor: currentTheme.background },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.container, { backgroundColor: currentTheme.containerBackground }]}>
        <TouchableOpacity
          style={[
            styles.resetButton,
            {
              backgroundColor: currentTheme.resetButtonBackground,
              shadowColor: currentTheme.resetButtonShadow,
            },
          ]}
          onPress={() => handleResetPreferences(username)}
          activeOpacity={0.8}
          accessibilityLabel="Reset Preferences"
          accessibilityRole="button"
        >
          <Text style={[styles.resetButtonText, { color: currentTheme.resetButtonText }]}>
            Reset
          </Text>
        </TouchableOpacity>
        <Text style={[styles.heading, { color: currentTheme.headingText }]}>
          Hi {username},
        </Text>
        <Text style={[styles.subHeading, { color: currentTheme.subHeadingText }]}>
          What are your preferences?
        </Text>

        {Object.entries(industriesByCategory).map(([category, options]) => (
          <View
            style={[styles.section, { backgroundColor: currentTheme.sectionBackground }]}
            key={category}
          >
            <Text style={[styles.sectionHeading, { color: currentTheme.sectionHeadingText }]}>
              {category}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(item, index) => `${category}-${index}`}
              renderItem={renderOption}
              numColumns={numColumns}
              columnWrapperStyle={styles.rowStyle}
              scrollEnabled={false}
              contentContainerStyle={{ paddingVertical: 5 }}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.viewButton,
            {
              backgroundColor: currentTheme.viewButtonBackground,
              shadowColor: currentTheme.viewButtonShadow,
            },
          ]}
          onPress={() => handleViewClick(username)}
          activeOpacity={0.8}
          accessibilityLabel="Save Preferences and View"
          accessibilityRole="button"
        >
          <Text style={[styles.viewButtonText, { color: currentTheme.viewButtonTextColor }]}>
            VIEW
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const primaryColor = '#8A2BE2'; // Accent color for light mode
const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  resetButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 10,
    elevation: 5,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  resetButtonText: {
    fontWeight: 'bold',
    fontSize: baseFontSize,
  },
  heading: {
    fontSize: headingFontSize,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subHeading: {
    fontSize: subHeadingFontSize,
    marginBottom: 20,
  },
  section: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeading: {
    fontSize: sectionHeadingFontSize,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    paddingBottom: 5,
  },
  rowStyle: {
    justifyContent: 'flex-start',
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 10,
    marginBottom: 10,
    justifyContent: 'center',
    elevation: 2,
    minWidth: width < 400 ? width / 3 - 30 : 100,
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  selectedOptionButton: {
    transform: [{ scale: 1.05 }],
  },
  optionText: {
    fontSize: baseFontSize,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  selectedOptionText: {
    color: '#FFFFFF',
  },
  viewButton: {
    borderWidth: 1,
    borderColor: primaryColor,
    marginTop: 20,
    alignSelf: 'center',
    width: '50%',
    paddingVertical: 12,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  viewButtonText: {
    fontSize: baseFontSize,
    fontWeight: 'bold',
  },
});
