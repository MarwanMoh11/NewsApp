import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserContext } from '../app/UserContext';

const domain = 'dev-1uzu6bsvrd2mj3og.us.auth0.com';
const clientId = 'CZHJxAwp7QDLyavDaTLRzoy9yLKea4A1';

// Dynamically set redirectUri based on platform and environment
const redirectUri = makeRedirectUri({
  useProxy: Platform.OS !== 'web',
  path: 'loginstatus', // this should match the route where login logic is handled
});

const HomeScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { setUserToken } = useContext(UserContext);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false,
      prompt: 'login',
    },
    { authorizationEndpoint: `https://${domain}/authorize` }
  );

  const handleLogin = async () => {
    setLoading(true);
    setErrorMessage('');

    if (Platform.OS === 'web') {
      // Web: Redirect the user directly to the Auth0 login page
      const authUrl = `https://${domain}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=openid%20profile%20email&prompt=login`;
      window.location.href = authUrl;
    } else {
      // Native platforms
      try {
        if (request) {
          const result = await promptAsync();
          if (result.type === 'success' && result.params && result.params.code) {
            // On native, the loginStatus page will also handle this code via deep linking
            // but since we're already there, we can just navigate.
            router.push({ pathname: '/loginStatus', params: { code: result.params.code } });
          } else {
            throw new Error('Authorization code not found in result');
          }
        }
      } catch (error) {
        setLoading(false);
        console.error('Error during login process:', error);
        setErrorMessage('Login failed');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topContainer}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.subtext}>Real-time news gathering, simplified.</Text>
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.box}>
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginText}>Login</Text>
            )}
          </TouchableOpacity>
          {errorMessage ? (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6C63FF',
    justifyContent: 'space-between',
  },
  topContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  logoImage: {
    width: 400,
    height: 160,
    marginBottom: 20,
  },
  subtext: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
  },
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: '#F7B8D2',
    paddingVertical: 40,
    paddingHorizontal: 40,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  loginButton: {
    backgroundColor: '#8F80E0',
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 30,
    marginBottom: 10,
    shadowColor: '#8F80E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.8,
  },
  loginText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  errorMessage: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
