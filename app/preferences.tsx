import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView, Alert, Image , Platform} from 'react-native';
import { useRouter } from 'expo-router';

type IndustryType = string;

export default function PreferencesScreen() {
  const [selectedOptions, setSelectedOptions] = useState<IndustryType[]>([]);
  const [username, setUsername] = useState<string>('Guest');
  const router = useRouter();

  const industriesByCategory: Record<string, string[]> = {
    "News": ['BREAKING NEWS', 'WORLDPOST', 'WORLD NEWS', 'POLITICS', 'U.S. NEWS'],
    "Health & Wellness": ['WELLNESS', 'HEALTHY LIVING', 'HEALTH'],
    "Sports": ['Football', 'Formula1', 'SPORTS'],
    "Technology & Gaming": ['TECH', 'Gaming'],
    "Lifestyle": ['STYLE & BEAUTY', 'STYLE', 'TRAVEL', 'HOME & LIVING', 'FOOD & DRINK'],
    "Arts & Entertainment": ['ENTERTAINMENT', 'CULTURE & ARTS', 'COMEDY', 'ARTS'],
    "Other": ['MONEY', 'SCIENCE', 'PARENTING', 'CRIME', 'DIVORCE', 'WOMEN'],
  };

const domaindynamo = 'https://keen-alfajores-31c262.netlify.app/.netlify/functions/index'



  // Fetch user data and preferences on mount
  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const response = await fetch(`${domaindynamo}/get-username`);
        const data = await response.json();
        if (data.username) {
          setUsername(data.username);
        } else {
          setUsername('Guest');
        }
      } catch (error) {
        console.error('Error fetching username:', error);
        setUsername('Guest');
      }
    };

    const fetchPreferences = async () => {
      try {
        if (username === 'Guest') return;

        const response = await fetch(`${domaindynamo}/check-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });

        const data = await response.json();

        if (data.status === 'Success' && Array.isArray(data.data)) {
          const preferences = data.data.map((item) => item.preference);
          setSelectedOptions(preferences.length ? preferences : []);
        } else {
          setSelectedOptions([]);
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
        setSelectedOptions([]);
      }
    };

    const initializePreferences = async () => {
      await fetchUsername();
      if (username !== 'Guest') {
        await fetchPreferences();
      }
    };

    initializePreferences();
  }, [username]);

  const toggleOption = (option: IndustryType) => {
    setSelectedOptions((prevSelected) =>
      prevSelected.includes(option)
        ? prevSelected.filter((item) => item !== option)
        : [...prevSelected, option]
    );
  };

  const handleResetPreferences = async () => {
    try {
      const response = await fetch(`${domaindynamo}/delete-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
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

  const handleViewClick = async () => {
    if (selectedOptions.length === 0) {
      Alert.alert('No Preferences', 'Please select at least one preference.');
      return;
    }

    try {
      const addPreferencePromises = selectedOptions.map(async (preference) => {
        const response = await fetch(`${domaindynamo}/add-preference`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, preference }),
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

  const renderOption = ({ item }: { item: IndustryType }) => {
    const isSelected = selectedOptions.includes(item);

    return (
      <TouchableOpacity
        style={[styles.optionButton, isSelected && styles.selectedOptionButton]}
        onPress={() => toggleOption(item)}
      >
        <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>{item}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.logoContainer}>
        </View>
        <TouchableOpacity style={styles.resetButton} onPress={handleResetPreferences}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Hi {username},</Text>
        <Text style={styles.subHeading}>What are your preferences from X and other News Sources?</Text>

        {Object.entries(industriesByCategory).map(([category, options]) => (
          <View style={styles.section} key={category}>
            <Text style={styles.sectionHeading}>{category}</Text>
            <FlatList
              data={options}
              keyExtractor={(item, index) => index.toString()}
              renderItem={renderOption}
              numColumns={3}
              columnWrapperStyle={styles.rowStyle}
              scrollEnabled={false}
            />
          </View>
        ))}

        <TouchableOpacity style={[styles.optionButton, styles.viewButton]} onPress={handleViewClick}>
          <Text style={[styles.optionText, styles.viewButtonText]}>VIEW</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
    padding: 20,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 150,
    height: 80,
  },
  resetButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#FF6F61',
    padding: 12,
    borderRadius: 30,
    zIndex: 10,
    elevation: 5,
  },
  resetButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  subHeading: {
    fontSize: 14,
    color: '#555555',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    paddingBottom: 5,
  },
  rowStyle: {
    justifyContent: 'space-evenly',
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D8E0',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    marginVertical: 10,
    width: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  selectedOptionButton: {
    backgroundColor: '#F7B8D2',
    borderColor: '#F7B8D2',
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.2,
  },
  optionText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  selectedOptionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  viewButton: {
    borderWidth: 1,
    borderColor: '#8A2BE2',
    marginTop: 20,
    alignSelf: 'center',
    width: '50%',
    backgroundColor: '#8A2BE2',
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});