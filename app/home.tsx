import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet , Platform, Alert} from 'react-native';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as Network from 'expo-network';

const domain = 'dev-1uzu6bsvrd2mj3og.us.auth0.com';
const clientId = 'CZHJxAwp7QDLyavDaTLRzoy9yLKea4A1';

const redirectUri = makeRedirectUri({
  scheme: 'expo',
  path: 'loginStatus',
});


if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

function base64URLEncode(str) {
  return str
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export const createVerifierChallenge = () => {
  return new Promise(async (resolve, reject) => {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const verifier = base64URLEncode(Buffer.from(randomBytes));

    const challengeBase64 = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    const challenge = challengeBase64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    resolve([verifier, challenge]);
  });
};




const domaindynamo = 'https://keen-alfajores-31c262.netlify.app/.netlify/functions/index'


const HomeScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleReactivation = (Nickname: string) => {
      // Send the reactivation request to the server
      fetch(`${domaindynamo}/reactivate-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: Nickname }),
      })
        .then(() => {
          router.push('/mynews');
        })
        .catch((error) => {
          console.error('Error reactivating account:', error);
        });
    };

  // Setup the Auth request
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'], // Adjust the scopes you need
      usePKCE: false,
      prompt: 'login'
    },
    { authorizationEndpoint: `https://${domain}/authorize` }
  );

  const handleUserRegistration = async (user) => {
    console.log('User Info:', user);
    const { sub: token, nickname: Nickname, email: Email } = user;
    console.log('Token:', token);
    console.log('Nickname:', Nickname);
    console.log('Email:', Email);
    const url = `${domaindynamo}/sign-up`;

    try {
      const checkResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: token, nickname: Nickname, email: Email }),
      });

      const checkData = await checkResponse.json();

      const setUsernameResponse = await fetch(`${domaindynamo}/set-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: Nickname }),
      });

      const setUsernameData = await setUsernameResponse.json();
      console.log('Username set successfully');
      router.push('/mynews');

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
            }
            else{
              router.push('/home');
            }
          } else {
            Alert.alert(
              'Account Reactivation',
              'Your account is currently deactivated. Would you like to reactivate it?',
              [
                { text: 'Cancel', onPress: () => router.push('/home') },
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
    } catch (error) {
      console.error('Error during user registration:', error);
      setErrorMessage('Failed to register user.');
    }
  };

  const exchangeToken = async (code: string) => {
    const tokenEndpoint = `https://${domain}/oauth/token`;
    console.log('TokenEndpoint: ', tokenEndpoint);

    // Log the request payload for debugging
    const requestBody = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
       redirect_uri: redirectUri,
    };
    console.log('Request Body:', requestBody);

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Log the response status and response body (if possible) for debugging
      console.log('Response Status:', response.status);
      const responseBody = await response.text(); // Read response body as text to log
      console.log('Response Body:', responseBody);

      if (!response.ok) {
        // If response is not ok, log the full error message
        throw new Error(`Token exchange failed with status ${response.status}: ${responseBody}`);
      }

      const data = JSON.parse(responseBody);
      console.log('Token Exchange Response:', data);

      const userInfoResponse = await fetch(`https://${domain}/userinfo`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });

      // Log the user info response status and body
      console.log('User Info Response Status:', userInfoResponse.status);
      const userInfoResponseBody = await userInfoResponse.text();
      console.log('User Info Response Body:', userInfoResponseBody);

      if (!userInfoResponse.ok) {
        throw new Error(`User info fetch failed with status ${userInfoResponse.status}: ${userInfoResponseBody}`);
      }

      const user = JSON.parse(userInfoResponseBody);
      console.log('User Info:', user);

      await handleUserRegistration(user);

    } catch (error) {
      console.error('Error during token exchange:', error);
      setErrorMessage('Failed to authenticate.');
      throw error;
    }
  };

  const handleLogin = async () => {
       setLoading(true);
       setErrorMessage('');
      if(Platform.OS == "web"){
          const authWindow = window.open(
                `https://${domain}/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid profile email&prompt=login`,
                'Auth0 Login',
                'width=500,height=600'
              );

              const interval = setInterval(() => {
                try {
                  if (authWindow && authWindow.closed) {
                    clearInterval(interval);
                    setLoading(false);
                  }

                  if (authWindow && authWindow.location.href.includes(redirectUri)) {
                    const params = new URL(authWindow.location.href).searchParams;
                    const code = params.get('code');

                    if (code) {
                      clearInterval(interval);
                      authWindow.close();

                      exchangeToken(code)
                        .catch((error) => {
                          setErrorMessage('Failed to complete login.');
                          console.error(error);
                        });
                    }
                  }
                } catch (error) {
                  // Ignore cross-origin errors
                }
              }, 500);
          }else{
                try {
                  if (request) {
                    //  const [verifier, challenge] = await createVerifierChallenge();
                    // future implementation of added security



                    const result = await promptAsync();

                    console.log('PromptAsync Result:', result);

                    if (result && result.params && result.params.code) {
                      console.log('Authorization Code:', result.params.code);

                      // Exchange token
                      await exchangeToken(result.params.code);
                      console.log('Token exchange completed');
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
    <View style={styles.container}>
      <Image source={require('../assets/images/logo.png')} style={styles.logoImage} />
      <View style={styles.bottomContainer}>
        <View style={styles.box}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.loginText}>Loading...</Text>
            ) : (
              <Text style={styles.loginText}>HEYYYYYYYYYYY</Text>
            )}
          </TouchableOpacity>
          {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}
        </View>
      </View>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8A7FDC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 300,
    height: 100,
  },
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
  },
  box: {
    backgroundColor: '#F7B8D2',
    paddingVertical: 40,
    paddingHorizontal: 40,
    borderRadius: 15,
    alignItems: 'center',
    width: '100%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  loginButton: {
    backgroundColor: '#8F80E0',
    paddingVertical: 12,
    paddingHorizontal: 50,
    borderRadius: 25,
    marginBottom: 10,
  },
  loginText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorMessage: {
    color: 'red',
    marginTop: 10,
  },
});
