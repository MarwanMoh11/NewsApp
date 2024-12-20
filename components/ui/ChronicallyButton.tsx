// components/CustomButtonWithBar.tsx

import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface BarButton {
  iconName: keyof typeof FontAwesome.glyphMap; // Ensures only valid FontAwesome icons
  onPress: () => void;
}

interface CustomButtonWithBarProps {
  onMainButtonPress?: () => void;
  barButtons: BarButton[];
  isVisible: boolean; // Control visibility from parent
  buttonSize?: number;
  barHeight?: number;
  barBackgroundColor?: string;
}

const CustomButtonWithBar: React.FC<CustomButtonWithBarProps> = ({
  onMainButtonPress,
  barButtons,
  isVisible,
  buttonSize = 80,
  barHeight = 60,
  barBackgroundColor = '#F7B8D2',
}) => {
  // Animated values for opacity and position
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const barTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Show the button and bar with animation
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(barTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide the button and bar with animation
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(barTranslateY, {
          toValue: 100, // Moves the bar out of view
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, buttonOpacity, barTranslateY]);

  const handleMainButtonPress = () => {
    if (onMainButtonPress) {
      onMainButtonPress();
    }
    // Optionally, toggle the bar visibility here if needed
  };

  return (
    <View style={styles.container}>
      {/* Bar with additional buttons */}
      <Animated.View
        style={[
          styles.barContainer,
          {
            height: barHeight,
            backgroundColor: barBackgroundColor,
            transform: [{ translateY: barTranslateY }],
          },
        ]}
      >
        {barButtons.map((button, index) => (
          <TouchableOpacity key={index} onPress={button.onPress} style={styles.barButton}>
            <FontAwesome name={button.iconName} size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
    zIndex: 10, // Ensure the button is above other components
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '90%',
    paddingHorizontal: 20,
    borderRadius: 30,
    marginBottom: 10,
    elevation: 5, // For Android shadow
    shadowColor: '#000', // For iOS shadow
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  barButton: {
    padding: 10,
  },
  mainButton: {
    backgroundColor: '#8A7FDC',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5, // For Android shadow
    shadowColor: '#000', // For iOS shadow
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
  },
  mainButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default React.memo(CustomButtonWithBar);
