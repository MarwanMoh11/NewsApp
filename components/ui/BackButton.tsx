// components/ui/BackButton.tsx
import React, { useContext } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  View, // Import View for potential layout adjustments if needed
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { UserContext } from '../../app/UserContext'; // Adjust path if necessary

interface BackButtonProps {
  style?: StyleProp<ViewStyle>; // Optional prop to allow additional style overrides
  // topOffset prop is removed as absolute positioning is removed
  onPress?: () => void; // Optional custom onPress handler
}

const BackButton: React.FC<BackButtonProps> = ({ style, onPress }) => {
  const router = useRouter();
  const navigation = useNavigation();

  // Consume isDarkTheme from UserContext
  const { isDarkTheme } = useContext(UserContext);

  const handlePress = () => {
    // If a custom onPress handler is provided, use it
    if (onPress) {
      onPress();
      return;
    }

    // Default navigation logic
    if (navigation.canGoBack()) {
      console.log('BackButton: Navigating back using navigation.goBack()');
      navigation.goBack();
    } else {
      console.log('BackButton: Cannot go back, navigating to "/" using router.push()');
      // Fallback to a specific route if navigation stack is empty (e.g., navigating from a deep link)
      router.push('/'); // Navigate to Home or another appropriate default route
    }
  };

  // Determine icon color based on theme
  const iconColor = isDarkTheme ? '#E5E7EB' : '#1F2937'; // Using common text colors

  return (
    <TouchableOpacity
      style={[
        styles.backButton, // Base styles
        style, // Allow additional style overrides from props
      ]}
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Icon
        name="arrow-back-outline" // Using outline variant for consistency
        size={24}
        color={iconColor}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    // Removed position: 'absolute', top, left, zIndex
    // Removed background colors and shadows - parent component should handle background if needed
    padding: 10, // Maintain a good touch area size
    borderRadius: 8, // Slightly less rounded, adjust as needed
    // Center the icon within the touchable area if needed, but usually padding is enough
    justifyContent: 'center',
    alignItems: 'center',
    // Add margin if needed when placed in a row/header
    // marginRight: 10, // Example margin
  },
  // Removed darkBackground and lightBackground styles
});

export default BackButton;
