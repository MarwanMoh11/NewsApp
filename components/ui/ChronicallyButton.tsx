import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Animated, ScrollView } from 'react-native'; // Import Animated and ScrollView
import { FontAwesome } from '@expo/vector-icons'; // Import FontAwesome icons

interface BarButton {
  iconName: keyof typeof FontAwesome.glyphMap; // Ensures only valid FontAwesome icons
  onPress: () => void;
}

interface CustomButtonWithBarProps {
  onMainButtonPress?: () => void;
  barButtons: BarButton[];
  buttonSize?: number;
  barHeight?: number;
  barBackgroundColor?: string;
}

const CustomButtonWithBar: React.FC<CustomButtonWithBarProps> = ({
  onMainButtonPress,
  barButtons,
  buttonSize = 80,
  barHeight = 60,
  barBackgroundColor = '#F7B8D2',
}) => {
  const [isBarVisible, setIsBarVisible] = useState(false);
  const [lastOffset, setLastOffset] = useState(0);
  const [isButtonVisible, setIsButtonVisible] = useState(true);
  const buttonYPosition = useRef(new Animated.Value(0)).current;

  const handleMainButtonPress = () => {
    setIsBarVisible(!isBarVisible);
    if (onMainButtonPress) {
      onMainButtonPress();
    }
  };

  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;

    if (currentOffset > lastOffset && isButtonVisible) {
      Animated.timing(buttonYPosition, {
        toValue: buttonSize + 20,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setIsButtonVisible(false);
    } else if (currentOffset < lastOffset && !isButtonVisible) {
      Animated.timing(buttonYPosition, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setIsButtonVisible(true);
    }

    setLastOffset(currentOffset);
  };

  return (
    <View style={styles.container}>
      <ScrollView onScroll={handleScroll} scrollEventThrottle={16}>
      </ScrollView>

      {isBarVisible && (
        <View style={[styles.barContainer, { height: barHeight, backgroundColor: barBackgroundColor }]}>
          {barButtons.slice(0, 2).map((button, index) => (
            <TouchableOpacity key={index} onPress={button.onPress} style={styles.barButton}>
              <FontAwesome name={button.iconName} size={30} color="#FFFFFF" />
            </TouchableOpacity>
          ))}
          <View style={{ width: buttonSize }} />
          {barButtons.slice(2).map((button, index) => (
            <TouchableOpacity key={index} onPress={button.onPress} style={styles.barButton}>
              <FontAwesome name={button.iconName} size={30} color="#FFFFFF" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Animated.View
        style={[
          styles.mainButton,
          { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2, transform: [{ translateY: buttonYPosition }] },
        ]}
      >
        <TouchableOpacity onPress={handleMainButtonPress} style={styles.mainButtonInner}>
          <Image
            source={require('../../assets/images/buttonLogo.png')}
            style={{ width: buttonSize / 2+15, height: buttonSize / 2 }}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '90%',
    paddingHorizontal: 20,
    position: 'absolute',
    bottom: 10,
    borderRadius: 30,
    overflow: 'hidden',
  },
  barButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  mainButton: {
    backgroundColor: '#8A7FDC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CustomButtonWithBar;