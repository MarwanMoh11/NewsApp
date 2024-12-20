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
  Platform
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

export default function PreferencesScreen() {
  const [selectedOptions, setSelectedOptions] = useState<IndustryType[]>([]);
  const [username, setUsername] = useState<string>('Guest');
  const router = useRouter();
  const { userToken } = useContext(UserContext);

  const industriesByCategory: Record<string, string[]> = {
    "News": ['BREAKING NEWS', 'WORLDPOST', 'WORLD NEWS', 'POLITICS', 'U.S. NEWS'],
    "Health & Wellness": ['WELLNESS', 'HEALTHY LIVING', 'HEALTH'],
    "Sports": ['Football', 'Formula1', 'SPORTS'],
    "Technology & Gaming": ['TECH', 'Gaming'],
    "Lifestyle": ['STYLE & BEAUTY', 'Business', 'Travel', 'HOME & LIVING', 'FOOD & DRINK', 'Health'],
    "Arts & Entertainment": ['Entertainment', 'CULTURE & ARTS', 'COMEDY', 'ARTS'],
    "Other": ['MONEY', 'Science', 'PARENTING', 'CRIME', 'DIVORCE', 'WOMEN'],
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
          body: JSON.stringify({ token: userToken })
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
          body: JSON.stringify({ username: username })
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
        body: JSON.stringify({ username: username })
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
          body: JSON.stringify({ username: username, preference })
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
      router.push('/mynews');
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
        style={[styles.optionButton, isSelected && styles.selectedOptionButton]}
        onPress={() => toggleOption(item)}
        activeOpacity={0.7}
      >
        <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>{item}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => handleResetPreferences(username)}
          activeOpacity={0.8}
        >
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Hi {username},</Text>
        <Text style={styles.subHeading}>What are your preferences?</Text>

        {Object.entries(industriesByCategory).map(([category, options]) => (
          <View style={styles.section} key={category}>
            <Text style={styles.sectionHeading}>{category}</Text>
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
          style={[styles.optionButton, styles.viewButton]}
          onPress={() => handleViewClick(username)}
          activeOpacity={0.8}
        >
          <Text style={[styles.optionText, styles.viewButtonText]}>VIEW</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const primaryColor = '#8A2BE2';
const backgroundColor = '#F7F9FC';
const cardColor = '#FFFFFF';
const selectedColor = '#F7B8D2';
const textColor = '#333333';
const headingColor = '#000000';
const subHeadingColor = '#555555';

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    backgroundColor,
    paddingTop: 60,
    paddingBottom: 40,
  },
  resetButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    backgroundColor: '#FF6F61',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 10,
    elevation: 5,
  },
  resetButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: baseFontSize,
  },
  heading: {
    fontSize: headingFontSize,
    fontWeight: 'bold',
    color: headingColor,
    marginBottom: 10,
  },
  subHeading: {
    fontSize: subHeadingFontSize,
    color: subHeadingColor,
    marginBottom: 20,
  },
  section: {
    backgroundColor: cardColor,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeading: {
    fontSize: sectionHeadingFontSize,
    fontWeight: 'bold',
    color: textColor,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    paddingBottom: 5,
  },
  rowStyle: {
    justifyContent: 'flex-start',
  },
  optionButton: {
    backgroundColor: cardColor,
    borderWidth: 1,
    borderColor: '#D1D8E0',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 10,
    marginBottom: 10,
    justifyContent: 'center',
    elevation: 2,
    minWidth: width < 400 ? (width / 3) - 30 : 100,
  },
  selectedOptionButton: {
    backgroundColor: selectedColor,
    borderColor: selectedColor,
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.2,
  },
  optionText: {
    color: textColor,
    fontSize: baseFontSize,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  selectedOptionText: {
    color: '#FFF',
  },
  viewButton: {
    borderWidth: 1,
    borderColor: primaryColor,
    marginTop: 20,
    alignSelf: 'center',
    width: '50%',
    backgroundColor: primaryColor,
    paddingVertical: 12,
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: baseFontSize,
    fontWeight: 'bold',
  },
});
