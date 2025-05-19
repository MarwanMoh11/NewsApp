// explore.tsx - Placeholder page for the Explore feature

import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { UserContext } from './UserContext';

const ExplorePage: React.FC = () => {
  // Get theme from context
  const { isDarkTheme } = useContext(UserContext);
  
  // Dynamic styles based on theme
  const dynamicStyles = getStyles(isDarkTheme);
  const themeStatusBar = isDarkTheme ? 'light-content' : 'dark-content';
  const themeBackgroundColor = isDarkTheme ? '#0A0A0A' : '#F8F9FA';
  
  return (
    <SafeAreaView style={[dynamicStyles.container, { backgroundColor: themeBackgroundColor }]}>
      <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />
      
      <View style={dynamicStyles.contentContainer}>
        <Icon 
          name="construct-outline" 
          size={80} 
          color={isDarkTheme ? '#9067C6' : '#007AFF'} 
        />
        
        <Text style={dynamicStyles.title}>
          Explore Coming Soon
        </Text>
        
        <Text style={dynamicStyles.description}>
          We're working hard to build an amazing explore experience for you.
          Check back soon to discover new content tailored to your interests.
        </Text>
        
        <View style={dynamicStyles.divider} />
        
        <Text style={dynamicStyles.subtext}>
          The explore page will allow you to discover new topics, trending articles,
          and content from sources you might not follow yet.
        </Text>
      </View>
    </SafeAreaView>
  );
};

// --- Styling ---
const { width } = Dimensions.get('window');

const getResponsiveSize = (baseSize: number): number => {
  if (width < 350) return baseSize * 0.9;
  if (width < 400) return baseSize;
  return baseSize * 1.1;
};

const fontSizes = {
  small: getResponsiveSize(12),
  base: getResponsiveSize(14),
  medium: getResponsiveSize(16),
  large: getResponsiveSize(18),
  xlarge: getResponsiveSize(24),
};

const getStyles = (isDarkTheme: boolean) => {
  const colors = {
    background: isDarkTheme ? '#0A0A0A' : '#F8F9FA',
    text: isDarkTheme ? '#EAEAEA' : '#1C1C1E',
    textSecondary: isDarkTheme ? '#A0A0A0' : '#6C6C6E',
    accent: isDarkTheme ? '#9067C6' : '#007AFF',
    border: isDarkTheme ? '#2C2C2E' : '#E5E5E5',
  };

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 30,
    },
    title: {
      fontSize: fontSizes.xlarge,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 20,
      marginBottom: 10,
      textAlign: 'center',
    },
    description: {
      fontSize: fontSizes.medium,
      color: colors.text,
      textAlign: 'center',
      lineHeight: fontSizes.medium * 1.5,
      marginBottom: 30,
    },
    divider: {
      width: '60%',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 20,
    },
    subtext: {
      fontSize: fontSizes.base,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: fontSizes.base * 1.5,
      marginTop: 10,
    },
  });
};

export default ExplorePage;