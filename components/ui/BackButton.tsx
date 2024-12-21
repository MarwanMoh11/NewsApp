// components/BackButton.tsx

import React from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRouter } from 'expo-router';

const BackButton: React.FC = () => {
  const router = useRouter();

  const handlePress = () => {
    router.push('/');
  };

  return (
    <TouchableOpacity style={styles.backButton} onPress={handlePress} accessible={true} accessibilityRole="button" accessibilityLabel="Go back to My News">
      <Icon name="arrow-back" size={24} color="#000" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    left: 20,
    top: 60, // Adjust based on platform and status bar
    zIndex: 10,
  },
});

export default BackButton;
