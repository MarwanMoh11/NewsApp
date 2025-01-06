// app/_layout.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { UserProvider } from './UserContext'; // Adjust the path if necessary

const Layout: React.FC = () => {
  return (
    <UserProvider>
      <View style={styles.container}>
        <Slot />
      </View>
    </UserProvider>
  );
};

export default Layout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9D5FF', // Match your app's background color
  },
});
