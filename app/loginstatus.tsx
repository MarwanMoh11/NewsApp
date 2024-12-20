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

  const { code: nativeCode, error: nativeError } = useLocalSearchParams();

  useEffect(() => {
    let code: string | null = null;
    let error: string | null = null;

    if (Platform.OS === 'web') {
      // On web, get the code and error from the URL search params
      const urlParams = new URLSearchParams(window.location.search);
      code = urlParams.get('code');
      error = urlParams.get('error');
    } else {
      // On native, get them from local search params (passed via router.push)
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
        router.push('/mynews');
      })
      .catch((err) => {
        console.error('Error reactivating account:', err);
        setErrorMessage('Unable to reactivate account.');
      });
  };

  const handleUserRegistration = async (user: any) => {
    const { sub: token, nickname: Nickname, email: Email } = user;

    try {
      // Check if user is registered
      const checkResponse = await fetch(`${domaindynamo}/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: token, nickname: Nickname, email: Email }),
      });
      const checkData = await checkResponse.json();

      // Get JWT token by setting username
      const setUsernameResponse = await fetch(`${domaindynamo}/set-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: Nickname }),
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
          // Ask to reactivate
          if (Platform.OS === 'web') {
            const userConfirmed = window.confirm(
              'Account Reactivation\n\nYour account is currently deactivated. Would you like to reactivate it?'
            );
            if (userConfirmed) {
              handleReactivation(Nickname);
            } else {
              router.push('/');
            }
          } else {
            Alert.alert(
              'Account Reactivation',
              'Your account is currently deactivated. Would you like to reactivate it?',
              [
                { text: 'Cancel', onPress: () => router.push('/') },
                { text: 'Reactivate', onPress: () => handleReactivation(Nickname) },
              ],
              { cancelable: false }
            );
          }
        } else {
          router.push('/mynews');
        }
      } else {
        router.push('/preferences');
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

    // Use makeRedirectUri() to ensure a valid redirect URI on all platforms
    const redirectUri = Platform.OS === 'web'
      ? makeRedirectUri({ path: 'loginStatus', useProxy: false })
      : makeRedirectUri({ path: 'loginStatus' });

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