// ------------------------------------------------------
// components/FilterPicker.tsx
// ------------------------------------------------------
import React, { useState, useContext } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import RNPickerSelect from 'react-native-picker-select';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../app/UserContext'; // Access UserContext

interface FilterPickerProps {
  filterType: 'all' | 'articles' | 'tweets';
  setFilterType: (value: 'all' | 'articles' | 'tweets') => void;
}

const FilterPicker: React.FC<FilterPickerProps> = ({ filterType, setFilterType }) => {
  // Access isDarkTheme from UserContext
  const { isDarkTheme } = useContext(UserContext);

  // State for react-native-picker-select (only on mobile)
  const [items] = useState([
    { label: 'All', value: 'all' },
    { label: 'Articles', value: 'articles' },
    { label: 'Tweets', value: 'tweets' },
  ]);

  // Placeholder for react-native-picker-select
  const placeholder = {
    label: 'Filter',
    value: null,
    color: isDarkTheme ? '#D1D5DB' : '#A020F0', // Adjust placeholder color based on theme
  };

  if (Platform.OS === 'web') {
    return (
      <Picker
        selectedValue={filterType}
        onValueChange={(itemValue) => setFilterType(itemValue)}
        style={[
          styles.picker,
          {
            backgroundColor: isDarkTheme ? '#374151' : '#F9F9F9', // Adjust background color
            color: isDarkTheme ? '#F3F4F6' : '#A020F0', // Adjust text color
            borderColor: isDarkTheme ? '#6B7280' : '#A020F0', // Adjust border color
          },
        ]}
        dropdownIconColor={isDarkTheme ? '#F3F4F6' : '#A020F0'} // Adjust dropdown icon color
        mode="dropdown" // "dialog" for Android
        accessibilityLabel="Filter news by type"
        accessibilityHint="Select the type of content you want to filter by"
      >
        <Picker.Item label="All" value="all" />
        <Picker.Item label="Articles" value="articles" />
        <Picker.Item label="Tweets" value="tweets" />
      </Picker>
    );
  } else {
    return (
      <RNPickerSelect
        onValueChange={(value) => {
          if (value !== null) {
            setFilterType(value);
          }
        }}
        items={items}
        placeholder={placeholder}
        value={filterType}
        style={{
          ...pickerSelectStyles,
          iconContainer: {
            top: 12,
            right: 10,
          },
        }}
        useNativeAndroidPickerStyle={false}
        Icon={() => {
          return <Icon name="chevron-down" size={20} color={isDarkTheme ? '#D1D5DB' : '#A020F0'} />;
        }}
        accessibilityLabel="Filter news by type"
        accessibilityHint="Select the type of content you want to filter by"
        // Adjust background and border colors dynamically
        textInputProps={{
          style: {
            backgroundColor: isDarkTheme ? '#374151' : '#F9F9F9',
            borderColor: isDarkTheme ? '#6B7280' : '#A020F0',
          },
        }}
      />
    );
  }
};

const styles = StyleSheet.create({
  picker: {
    height: 40,
    width: 120, // Adjust width as needed
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 15,
    paddingRight: 30, // To ensure the text is never behind the icon
    // Additional dynamic styles will override these
  },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    height: 40,
    paddingLeft: 35, // Space for the search icon
    paddingRight: 30, // To ensure the text is never behind the icon
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    color: '#A020F0',
    backgroundColor: '#F9F9F9',
    paddingVertical: 8, // To vertically center the text
  },
  inputAndroid: {
    height: 40,
    paddingLeft: 35, // Space for the search icon
    paddingRight: 30, // To ensure the text is never behind the icon
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    color: '#A020F0',
    backgroundColor: '#F9F9F9',
    paddingVertical: 8, // To vertically center the text
  },
  iconContainer: {
    top: 12,
    right: 10,
  },
});

export default FilterPicker;
