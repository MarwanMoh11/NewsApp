// ------------------------------------------------------
// components/BackButton.tsx
// ------------------------------------------------------
import React, { useContext } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { UserContext } from '../../app/UserContext'; // Import UserContext

interface BackButtonProps {
  topOffset?: number; // Optional prop to adjust the top position
  style?: StyleProp<ViewStyle>; // Optional prop to allow additional style overrides
}

const BackButton: React.FC<BackButtonProps> = ({ topOffset = 0, style }) => {
  const router = useRouter();
  const navigation = useNavigation();

  // Consume isDarkTheme from UserContext
  const { isDarkTheme } = useContext(UserContext);

  const handlePress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.push('/'); // Navigate to Home if no back history
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.backButton,
        { top: Platform.OS === 'web' ? 20 + topOffset : 60 + topOffset }, // Apply topOffset
        style, // Allow additional style overrides
        isDarkTheme ? styles.darkBackground : styles.lightBackground, // Apply background based on theme
      ]}
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Icon
        name="arrow-back"
        size={24}
        color={isDarkTheme ? '#F3F4F6' : '#000000'} // Dynamic icon color based on theme
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    padding: 8, // Increase touch area for better accessibility
    borderRadius: 20, // Rounded corners for better aesthetics
    // Optional: Add shadow for better visibility on light themes
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2, // For Android shadow
  },
  darkBackground: {
    backgroundColor: 'rgba(31, 41, 55, 0.7)', // Semi-transparent dark background
  },
  lightBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)', // Semi-transparent light background
  },
});

export default BackButton;
