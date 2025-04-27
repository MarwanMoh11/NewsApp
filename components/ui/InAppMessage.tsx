// components/ui/InAppMessage.tsx
import React, { useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  SafeAreaView, // Use SafeAreaView for top positioning
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from '../../app/UserContext'; // Adjust path if necessary

interface InAppMessageProps {
  visible: boolean;
  message: string;
  type?: 'info' | 'error' | 'success'; // Message type for styling
  duration?: number; // How long the message stays visible (ms)
  onClose: () => void; // Function to call when message should hide
}

const InAppMessage: React.FC<InAppMessageProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3500, // Default duration 3.5 seconds
  onClose,
}) => {
  const { isDarkTheme } = useContext(UserContext);
  const translateY = useRef(new Animated.Value(-100)).current; // Start off-screen top

  // Theme and type-based colors
  const colors = {
    infoBg: isDarkTheme ? '#2E72A1' : '#D1ECF1',
    infoText: isDarkTheme ? '#D1ECF1' : '#0C5460',
    infoIcon: isDarkTheme ? '#D1ECF1' : '#0C5460',
    errorBg: isDarkTheme ? '#721C24' : '#F8D7DA',
    errorText: isDarkTheme ? '#F8D7DA' : '#721C24',
    errorIcon: isDarkTheme ? '#F8D7DA' : '#721C24',
    successBg: isDarkTheme ? '#155724' : '#D4EDDA',
    successText: isDarkTheme ? '#D4EDDA' : '#155724',
    successIcon: isDarkTheme ? '#D4EDDA' : '#155724',
  };

  const bgColor = colors[`${type}Bg`];
  const textColor = colors[`${type}Text`];
  const iconColor = colors[`${type}Icon`];
  const iconName =
    type === 'error'
      ? 'alert-circle-outline'
      : type === 'success'
      ? 'checkmark-circle-outline'
      : 'information-circle-outline';

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (visible) {
      // Animate in
      Animated.spring(translateY, {
        toValue: 0, // Animate to top edge
        useNativeDriver: true,
        tension: 80, // Adjust animation feel
        friction: 15,
      }).start();

      // Set timer to automatically close
      timer = setTimeout(() => {
        handleClose();
      }, duration);

    } else {
      // Animate out
      Animated.timing(translateY, {
        toValue: -150, // Animate off-screen top
        duration: 250,
        useNativeDriver: true,
      }).start();
    }

    // Cleanup timer on unmount or when visibility changes
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [visible, duration]); // Rerun effect when visibility or duration changes

  const handleClose = () => {
    // Animate out first, then call onClose after animation completes
    Animated.timing(translateY, {
      toValue: -150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose(); // Call the parent's close handler
    });
  };

  // Don't render anything if message is empty (prevents empty banner flash)
  if (!message && !visible) {
      return null;
  }

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Use SafeAreaView to push content below status bar/notch */}
      <SafeAreaView style={{ backgroundColor: bgColor }}>
         <View style={[styles.innerContainer]}>
            <Icon name={iconName} size={22} color={iconColor} style={styles.icon} />
            <Text style={[styles.messageText, { color: textColor }]}>{message}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Icon name="close-outline" size={24} color={iconColor} />
            </TouchableOpacity>
         </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000, // Ensure it's above other content
    // Shadow for elevation effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  innerContainer: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50, // Minimum height for the banner
  },
  icon: {
    marginRight: 10,
  },
  messageText: {
    flex: 1, // Take available space
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    marginLeft: 10,
    padding: 5, // Increase tap area
  },
});

export default InAppMessage;
