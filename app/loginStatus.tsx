import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const SignInSuccess: React.FC = () => {
  const router = useRouter();

  // Navigate to /preferences after component mounts
  useEffect(() => {
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Sign-In Successful</Text>
        <Text style={styles.message}>Welcome back! You have successfully signed in.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f7fa',
  },
  card: {
    padding: 20,
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    width: '80%',
    maxWidth: 350,
    alignItems: 'center',
  },
  heading: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    color: '#555',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
});

export default SignInSuccess;
