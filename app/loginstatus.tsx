// ------------------------------------------------------
// LoginStatus.tsx
// ------------------------------------------------------
import React, { useEffect, useContext, useState } from 'react';
import { View, Text, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { UserContext } from '../app/UserContext';
import { makeRedirectUri } from 'expo-auth-session';

const domain = 'dev-1uzu6bsvrd2mj3og.us.auth0.com';
const clientId = 'CZHJxAwp7QDLyavDaTLRzoy9yLKea4A1';
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';

const LoginStatus: React.FC = () => {
  const router = useRouter();
  const { setUserToken } = useContext(UserContext);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);

  const { code: nativeCode, error: nativeError } = useLocalSearchParams();

  useEffect(() => {
    let code: string | null = null;
    let error: string | null = null;

    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      code = urlParams.get('code');
      error = urlParams.get('error');
    } else {
      code = nativeCode ? String(nativeCode) : null;
      error = nativeError ? String(nativeError) : null;
    }

    if (error) {
      setErrorMessage('Login failed. Please try again.');
      setLoading(false);
    } else if (code) {
      exchangeToken(code)
        .catch((err) => {
          console.error('Error exchanging token:', err);
          setErrorMessage('Failed to authenticate.');
          setLoading(false);
        });
    } else {
      setErrorMessage('No authorization code provided.');
      setLoading(false);
    }
  }, [nativeCode, nativeError]);

  const handleReactivation = (Nickname: string) => {
    fetch(`${domaindynamo}/reactivate-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: Nickname }),
    })
      .then(() => {
        setNavigationTarget('/'); // Navigate to Home after reactivation
      })
      .catch((err) => {
        console.error('Error reactivating account:', err);
        setErrorMessage('Unable to reactivate account.');
      });
  };

  const handleUserRegistration = async (user: any) => {
    const { sub: token, nickname: Nickname, email: Email, name: FullName, picture: ProfilePicture } = user;
    console.log("Auth0 object: ", user);

    try {
      // Register or check user
      const checkResponse = await fetch(`${domaindynamo}/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: token,
          nickname: Nickname,
          email: Email,
          full_name: FullName,
          profile_picture: ProfilePicture,
        }),
      });
      const checkData = await checkResponse.json();

      // Get JWT token by setting username
      const setUsernameResponse = await fetch(`${domaindynamo}/set-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: token }),
      });
      const setUsernameData = await setUsernameResponse.json();

      if (setUsernameData.status === 'Success' && setUsernameData.token) {
        setUserToken(setUsernameData.token);
      } else {
        console.warn('No token received from set-username response.');
      }

      if (checkData.message === 'Username or email is already registered') {
        const activationstatus = await fetch(`${domaindynamo}/check-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: Nickname, auth_token: token }),
        });

        const activationstatusData = await activationstatus.json();

        if (activationstatusData.message === 'Account is deactivated') {
          if (Platform.OS === 'web') {
            const userConfirmed = window.confirm(
              'Account Reactivation\n\nYour account is currently deactivated. Would you like to reactivate it?'
            );
            if (userConfirmed) {
              handleReactivation(Nickname);
            } else {
              setUserToken(null);
              setNavigationTarget('/'); // Navigate to Home
            }
          } else {
            Alert.alert(
              'Account Reactivation',
              'Your account is currently deactivated. Would you like to reactivate it?',
              [
                { text: 'Cancel', onPress: () => { setUserToken(null); setNavigationTarget('/') } },
                { text: 'Reactivate', onPress: () => handleReactivation(Nickname) },
              ],
              { cancelable: false }
            );
          }
        } else {
          setNavigationTarget('/'); // Navigate to Home
        }
      } else {
        setNavigationTarget('/preferences'); // Navigate to Preferences
      }
    } catch (err) {
      console.error('Error during user registration:', err);
      setErrorMessage('Failed to register user.');
    } finally {
      setLoading(false);
    }
  };

  const exchangeToken = async (authCode: string) => {
    const tokenEndpoint = `https://${domain}/oauth/token`;

    const redirectUri = Platform.OS === 'web'
      ? makeRedirectUri({ path: 'loginstatus', useProxy: false })
      : makeRedirectUri({ path: 'loginstatus' });

    const requestBody = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code: authCode,
      redirect_uri: redirectUri,
    };

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new Error(`Token exchange failed with status ${response.status}: ${responseBody}`);
    }

    const data = JSON.parse(responseBody);

    const userInfoResponse = await fetch(`https://${domain}/userinfo`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    const userInfoResponseBody = await userInfoResponse.text();
    if (!userInfoResponse.ok) {
      throw new Error(`User info fetch failed with status ${userInfoResponse.status}: ${userInfoResponseBody}`);
    }

    const user = JSON.parse(userInfoResponseBody);
    await handleUserRegistration(user);
  };

  // Handle navigation when navigationTarget is set
  useEffect(() => {
    if (navigationTarget) {
      router.replace(navigationTarget);
      setNavigationTarget(null); // Reset after navigation
    }
  }, [navigationTarget]);

  return (
    <View style={styles.container}>
      {loading && !errorMessage ? (
        <>
          <Text style={styles.heading}>Processing...</Text>
          <ActivityIndicator size="large" color="#4CAF50" />
        </>
      ) : errorMessage ? (
        <Text style={styles.error}>{errorMessage}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  heading: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  error: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center'
  }
});

export default LoginStatus;
