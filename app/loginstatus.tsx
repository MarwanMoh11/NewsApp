import React, {
    useEffect,
    useContext,
    useState,
    useCallback,
    useRef // Import useRef
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { UserContext } from '../app/UserContext'; // Adjust path if needed
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';

// --- Configuration ---
const { extra } = Constants.expoConfig ?? {};
if (!extra) {
    throw new Error("App config `extra` is not defined. Please check app.config.js.");
}
const AUTH0_DOMAIN = extra.AUTH0_DOMAIN as string;
const AUTH0_CLIENT_ID = extra.AUTH0_CLIENT_ID as string;
const API_BASE_URL = extra.API_URL as string;
if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !API_BASE_URL) {
    throw new Error("Required environment variables (AUTH0_DOMAIN, AUTH0_CLIENT_ID, API_URL) are not set.");
}
const REDIRECT_PATH = 'loginstatus'; // The path used in redirects

// --- Types ---
interface Auth0TokenResponse {
  access_token: string;
  id_token?: string; // Optional, depending on scope
}
interface Auth0User {
  sub: string; // The unique Auth0 user ID (subject)
  nickname?: string;
  name?: string; // Full name
  picture?: string; // Profile picture URL
  email?: string;
  email_verified?: boolean;
}

// --- Helper Functions ---
const getFriendlyErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      // Check for the new backend error first
      if (error.message.includes('Body not allowed for GET or HEAD requests')) {
          return `Could not complete profile setup: A configuration error occurred on the server. Please try again later or contact support. (Details: ${error.message})`;
      }
      if (error.message === 'Invalid or expired authorization code.') {
           return 'Login session timed out or code was invalid. Please try logging in again.';
      }
      if (error.message.includes('Network request failed')) {
        return 'Network error. Please check your connection and try again.';
      }
      if (error.message.includes('Token exchange failed')) {
         return `Authentication failed: ${error.message.split(': ')[1] || 'Invalid credentials or configuration issue.'}`;
      }
       if (error.message.includes('User info fetch failed')) {
         return 'Could not retrieve user profile details. Please try again.';
      }
       if (error.message.includes('Failed to register user') || error.message.includes('Failed to update your profile')) {
           return `Could not complete profile setup: ${error.message}. Please try again later.`;
       }
      return error.message; // Default to the error message
    }
    return 'An unknown error occurred. Please try again.';
  };


// --- Component ---
const LoginStatus: React.FC = () => {
  const router = useRouter();
  const { setUserToken } = useContext(UserContext);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);

  // Ref to prevent processing the same code multiple times if component re-renders quickly
  const codeProcessedRef = useRef(false);
  const initialTimeRef = useRef<number>(Date.now()); // Record time when component instance is created

  const { code: nativeCode, error: nativeError, error_description: nativeErrorDescription } = useLocalSearchParams();

  // Log mount time
  if (initialTimeRef.current === null) { // Check ref value directly
       initialTimeRef.current = Date.now(); // Assign value if null
       console.log(`[${0}ms] LoginStatus Component Mounted`);
  }


  // --- Main Logic Orchestrator ---
  const processAuthorizationCode = useCallback(async (code: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setShowRetry(false);
    const processStartTime = Date.now();
    console.log(`[${processStartTime - initialTimeRef.current}ms] processAuthorizationCode: Starting.`);

    try {
      console.log(`[${Date.now() - initialTimeRef.current}ms] processAuthorizationCode: Exchanging code for token...`);
      const tokenData = await exchangeCodeForToken(code);

      console.log(`[${Date.now() - initialTimeRef.current}ms] processAuthorizationCode: Fetching user info...`);
      const user = await fetchUserInfo(tokenData.access_token);

      console.log(`[${Date.now() - initialTimeRef.current}ms] processAuthorizationCode: Handling user registration/login...`);
      await handleUserRegistrationOrLogin(user); // This function now contains the detailed logging for backend calls

      console.log(`[${Date.now() - initialTimeRef.current}ms] processAuthorizationCode: Process completed successfully.`);

    } catch (error) {
      console.error(`[${Date.now() - initialTimeRef.current}ms] processAuthorizationCode: Error during authentication process:`, error);
      const friendlyMessage = getFriendlyErrorMessage(error);
      setErrorMessage(friendlyMessage);
      setShowRetry(true);
      setIsLoading(false);
    }
  }, [setUserToken]);

  // --- Effect to Trigger Processing ---
  useEffect(() => {
    const effectStartTime = Date.now();
    // Use a default value for initialTimeRef.current if it somehow hasn't been set
    const elapsedTime = effectStartTime - (initialTimeRef.current || effectStartTime);
    console.log(`[${elapsedTime}ms] LoginStatus useEffect: Running.`);


    let authorizationCode: string | null = null;
    let authError: string | null = null;
    let authErrorDescription: string | null = null;

    // Extract code/error (Platform specific)
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      authorizationCode = urlParams.get('code');
      authError = urlParams.get('error');
      authErrorDescription = urlParams.get('error_description');
    } else {
      authorizationCode = nativeCode ? String(nativeCode) : null;
      authError = nativeError ? String(nativeError) : null;
      authErrorDescription = nativeErrorDescription ? String(nativeErrorDescription) : null;
    }

    console.log(`[${Date.now() - initialTimeRef.current}ms] LoginStatus useEffect: Received - Code: ${authorizationCode ? 'Yes' : 'No'}, Error: ${authError || 'None'}, ProcessedRef: ${codeProcessedRef.current}`);


    if (authError) {
      const description = authErrorDescription ? `: ${authErrorDescription}` : '';
      console.error(`[${Date.now() - initialTimeRef.current}ms] LoginStatus useEffect: Auth0 returned error: ${authError}${description}`);
      setErrorMessage(`Login failed${description}. Please try again.`);
      setIsLoading(false);
      setShowRetry(true);
    } else if (authorizationCode) {
      // **Guard against multiple processing attempts**
      if (!codeProcessedRef.current) {
        codeProcessedRef.current = true; // Mark as processing initiated for this instance
        console.log(`[${Date.now() - initialTimeRef.current}ms] LoginStatus useEffect: Code found and not processed yet. Calling processAuthorizationCode.`);
        processAuthorizationCode(authorizationCode);
      } else {
        console.warn(`[${Date.now() - initialTimeRef.current}ms] LoginStatus useEffect: Code found but already processed in this instance. Skipping.`);
      }
    } else {
       console.warn(`[${Date.now() - initialTimeRef.current}ms] LoginStatus useEffect: No authorization code or error found.`);
      setErrorMessage('Invalid login attempt. No authorization code received.');
      setIsLoading(false);
      setShowRetry(true);
    }
  }, [nativeCode, nativeError, nativeErrorDescription, processAuthorizationCode]); // Dependencies


  // --- Step 1: Exchange Code for Tokens ---
  const exchangeCodeForToken = async (authCode: string): Promise<Auth0TokenResponse> => {
    const exchangeStartTime = Date.now();
    const tokenEndpoint = `https://${AUTH0_DOMAIN}/oauth/token`;

    const redirectUri = Platform.OS === 'web'
      ? makeRedirectUri({ path: REDIRECT_PATH, useProxy: false })
      : makeRedirectUri({ path: REDIRECT_PATH, useProxy: true });

    console.log(`[${Date.now() - initialTimeRef.current}ms] exchangeCodeForToken: Using redirectUri: ${redirectUri}`);

    const requestBody = {
      grant_type: 'authorization_code',
      client_id: AUTH0_CLIENT_ID,
      code: authCode,
      redirect_uri: redirectUri,
    };

    console.log(`[${Date.now() - initialTimeRef.current}ms] exchangeCodeForToken: Fetching /oauth/token...`);
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const fetchEndTime = Date.now();
      const duration = fetchEndTime - exchangeStartTime;
      console.log(`[${Date.now() - initialTimeRef.current}ms] exchangeCodeForToken: /oauth/token fetch completed in ${duration}ms. Status: ${response.status}`);

      const responseBodyText = await response.text(); // Get body text regardless of status

      if (!response.ok) {
        console.error(`[${Date.now() - initialTimeRef.current}ms] exchangeCodeForToken: Token exchange failed! Status: ${response.status}, Body: ${responseBodyText}`);
        let errorDetail = `Status ${response.status}`;
        try {
          const errorJson = JSON.parse(responseBodyText);
          // ** Check specifically for invalid_authorization_code or invalid_grant **
          if (errorJson.error === 'invalid_grant' && errorJson.error_description?.includes('Invalid authorization code')) {
             errorDetail = "Invalid or expired authorization code.";
          } else if (errorJson.error === 'invalid_grant') {
              errorDetail = `Invalid grant: ${errorJson.error_description || 'Check configuration.'}`;
          } else {
             errorDetail = errorJson.error_description || errorJson.error || responseBodyText;
          }
        } catch (e) { /* Ignore JSON parsing error */ }

        // Throw the specific standardized error if identified
        if (errorDetail === "Invalid or expired authorization code.") {
             throw new Error(errorDetail);
        }
        throw new Error(`Token exchange failed: ${errorDetail}`);
      }

      const tokenData = JSON.parse(responseBodyText) as Auth0TokenResponse;
      if (!tokenData.access_token) {
          console.error(`[${Date.now() - initialTimeRef.current}ms] exchangeCodeForToken: Token exchange success, but no access_token in response.`);
          throw new Error("Token exchange successful, but no access_token received.");
      }
      console.log(`[${Date.now() - initialTimeRef.current}ms] exchangeCodeForToken: Success.`);
      return tokenData;

    } catch (error) {
       // Catch fetch errors or errors thrown above
       if (error instanceof Error && (error.message === "Invalid or expired authorization code." || error.message.startsWith('Token exchange failed:'))) {
           throw error; // Re-throw specific identified errors
       }
       console.error(`[${Date.now() - initialTimeRef.current}ms] exchangeCodeForToken: Network or unexpected error:`, error);
       throw new Error('Network error during authentication. Please try again.');
    }
  };


  // --- Step 2: Fetch User Information ---
  const fetchUserInfo = async (accessToken: string): Promise<Auth0User> => {
      const fetchStartTime = Date.now();
      const userInfoEndpoint = `https://${AUTH0_DOMAIN}/userinfo`;
      console.log(`[${Date.now() - initialTimeRef.current}ms] fetchUserInfo: Fetching ${userInfoEndpoint}...`);
      try {
          const response = await fetch(userInfoEndpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
          const duration = Date.now() - fetchStartTime;
          console.log(`[${Date.now() - initialTimeRef.current}ms] fetchUserInfo: Fetch completed in ${duration}ms. Status: ${response.status}`);
          const responseBodyText = await response.text();
          if (!response.ok) {
              console.error(`[${Date.now() - initialTimeRef.current}ms] fetchUserInfo: Failed! Status: ${response.status}, Body: ${responseBodyText}`);
              throw new Error(`User info fetch failed with status ${response.status}`);
          }
          const user = JSON.parse(responseBodyText) as Auth0User;
          if (!user || !user.sub) { throw new Error("User info fetched, but data is incomplete or invalid."); }
          console.log(`[${Date.now() - initialTimeRef.current}ms] fetchUserInfo: Success.`);
          return user;
      } catch (error) {
           if (error instanceof Error && error.message.startsWith('User info fetch failed')) { throw error; }
           console.error(`[${Date.now() - initialTimeRef.current}ms] fetchUserInfo: Network or unexpected error:`, error);
           throw new Error('Network error retrieving profile. Please try again.');
      }
  };


  // --- Step 3: Handle Backend Registration / Login / Activation ---
    const handleUserRegistrationOrLogin = async (user: Auth0User) => {
        const regStartTime = Date.now();
        console.log(`[${Date.now() - initialTimeRef.current}ms] handleUserRegistrationOrLogin: Starting...`);
        const Nickname = user.nickname || user.name?.split(' ')[0] || 'User';
        const Email = user.email;
        const FullName = user.name;
        const ProfilePicture = user.picture;
        const Auth0Token = user.sub;

        try {
            // 1. Make a SINGLE call to our new, intelligent backend endpoint
            console.log(`[${Date.now() - initialTimeRef.current}ms] Calling POST ${API_BASE_URL}/process-login...`);
            const response = await fetch(`${API_BASE_URL}/process-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth_token: Auth0Token,
                    nickname: Nickname,
                    email: Email,
                    full_name: FullName,
                    profile_picture: ProfilePicture,
                }),
            });

            console.log(`[${Date.now() - initialTimeRef.current}ms] /process-login responded status ${response.status}`);
            const data = await response.json();
            console.log(`[${Date.now() - initialTimeRef.current}ms] /process-login response body:`, data);

            // 2. Check if the backend call itself was successful
            if (!response.ok || data.status !== 'Success') {
                throw new Error(data.message || `Backend process failed with status ${response.status}`);
            }

            // 3. Handle the different success scenarios
            if (data.needsReactivation) {
                // User exists but is deactivated
                console.log(`[${Date.now() - initialTimeRef.current}ms] Account is deactivated. Prompting for reactivation.`);
                promptForReactivation(data.username); // Use the username returned from backend
                return; // Stop processing, the prompt will handle navigation
            }

            if (!data.token) {
                throw new Error("Login process succeeded but did not return a token.");
            }

            // User is active, set the token
            setUserToken(data.token);
            console.log(`[${Date.now() - initialTimeRef.current}ms] App JWT token set.`);

            // 4. Determine where to navigate
            if (data.isNewUser) {
                console.log(`[${Date.now() - initialTimeRef.current}ms] New user registered. Navigating to preferences.`);
                setNavigationTarget('/preferences');
            } else {
                console.log(`[${Date.now() - initialTimeRef.current}ms] Existing active user. Navigating home.`);
                setNavigationTarget('/');
            }

        } catch (error) {
            // Log the specific error before re-throwing
            console.error(`[${Date.now() - initialTimeRef.current}ms] handleUserRegistrationOrLogin: Error during backend interaction:`, error);
            throw new Error(`Failed to update your profile: ${error instanceof Error ? error.message : 'Unknown backend error'}`);
        } finally {
            // Set loading false *only if* not waiting for reactivation prompt
            if (navigationTarget !== null) {
                console.log(`[${Date.now() - initialTimeRef.current}ms] handleUserRegistrationOrLogin: Setting loading false (navigation target set).`);
                setIsLoading(false);
            } else {
                console.log(`[${Date.now() - initialTimeRef.current}ms] handleUserRegistrationOrLogin: Finished, but navigationTarget not set (likely waiting for prompt).`);
            }
        }
    };

   // --- Handle Reactivation Prompt ---
   const promptForReactivation = (nickname: string) => {
       setIsLoading(false); // Stop loading indicator while Alert/Confirm is visible
       console.log(`[${Date.now() - initialTimeRef.current}ms] promptForReactivation: Displaying prompt for ${nickname}.`);
       const title = 'Account Reactivation';
       const message = 'Your account is currently deactivated. Would you like to reactivate it?';

       if (Platform.OS === 'web') {
         const userConfirmed = window.confirm(`${title}\n\n${message}`);
         if (userConfirmed) {
           handleReactivation(nickname);
         } else {
           console.log(`[${Date.now() - initialTimeRef.current}ms] promptForReactivation: User cancelled. Logging out and navigating home.`);
           setUserToken(null); // Log out if they cancel
           setNavigationTarget('/'); // Go home (logged out)
           setIsLoading(false); // Ensure loading stops if cancelled
         }
       } else {
         Alert.alert(
           title,
           message,
           [
             {
               text: 'Cancel',
               style: 'cancel',
               onPress: () => {
                 console.log(`[${Date.now() - initialTimeRef.current}ms] promptForReactivation: User cancelled. Logging out and navigating home.`);
                 setUserToken(null); // Log out if they cancel
                 setNavigationTarget('/'); // Go home (logged out)
                 setIsLoading(false); // Ensure loading stops if cancelled
               },
             },
             {
               text: 'Reactivate',
               style: 'default',
               onPress: () => handleReactivation(nickname),
             },
           ],
           { cancelable: false }
         );
       }
   };

  // --- Handle Reactivation API Call ---
  const handleReactivation = async (nickname: string) => {
    setIsLoading(true); // Show loading during API call
    setErrorMessage(null);
    setShowRetry(false);
    const reactivateStartTime = Date.now();
     console.log(`[${Date.now() - initialTimeRef.current}ms] handleReactivation: Calling POST /reactivate-user for ${nickname}...`);
    try {
       const response = await fetch(`${API_BASE_URL}/reactivate-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: nickname })
       });
        const duration = Date.now() - reactivateStartTime;
        console.log(`[${Date.now() - initialTimeRef.current}ms] handleReactivation: /reactivate-user completed in ${duration}ms. Status: ${response.status}`);
        let responseData : any = {};
         try {
             responseData = await response.json();
             console.log(`[${Date.now() - initialTimeRef.current}ms] handleReactivation: /reactivate-user response body:`, responseData);
         } catch(jsonError) {
              console.error(`[${Date.now() - initialTimeRef.current}ms] handleReactivation: Failed to parse /reactivate-user JSON response:`, jsonError);
              if (response.ok) { throw new Error("Backend reactivate-user responded ok, but with invalid JSON."); }
         }

        if (!response.ok || responseData.status !== 'Success') {
            throw new Error(responseData.message || `Failed to reactivate account (status ${response.status})`);
        }
        console.log(`[${Date.now() - initialTimeRef.current}ms] handleReactivation: Reactivation successful. Navigating home.`);
        setNavigationTarget('/'); // Navigate to Home after successful reactivation
    } catch (error) {
         console.error(`[${Date.now() - initialTimeRef.current}ms] handleReactivation: Error:`, error);
         setErrorMessage(getFriendlyErrorMessage(error) || 'Unable to reactivate account.');
         setShowRetry(true);
    } finally {
      setIsLoading(false);
    }
  };


  // --- Effect for Navigation ---
  useEffect(() => {
    if (navigationTarget) {
      console.log(`[${Date.now() - initialTimeRef.current}ms] Navigation useEffect: Navigating to ${navigationTarget}`);
      router.replace(navigationTarget);
      // Setting target to null after replace might cause issues if effect runs again quickly.
      // Let Expo Router handle the state after replace.
      // setNavigationTarget(null);
    }
  }, [navigationTarget, router]);


  // --- Retry / Go Back Logic ---
  const handleRetry = () => {
    console.log(`[${Date.now() - initialTimeRef.current}ms] handleRetry: Navigating back to /`);
    router.replace('/'); // Go back to login start
  };


  // --- Render Logic ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {isLoading ? (
          <>
            <Text style={styles.heading}>Processing Login...</Text>
            <ActivityIndicator size="large" color={styles.loadingIndicator.color} />
            <Text style={styles.statusText}>Please wait...</Text>
          </>
        ) : errorMessage ? (
          <>
            <Text style={styles.errorHeading}>Login Problem</Text>
            {/* Make error text selectable on native if possible, useful for users reporting issues */}
            <Text style={styles.errorText} selectable={Platform.OS !== 'web'}>
                {errorMessage}
            </Text>
            {showRetry && (
               <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                 <Text style={styles.retryButtonText}>Try Again / Go Back</Text>
               </TouchableOpacity>
            )}
          </>
        ) : (
           // Avoid showing success message if navigation is immediate
           // Or keep it very brief
           // <Text style={styles.statusText}>Login successful, redirecting...</Text>
           // It's often better to just show nothing or the loading indicator briefly again
           // until navigation actually happens
           <ActivityIndicator size="large" color={styles.loadingIndicator.color} /> // Show loader until navigation
        )}
      </View>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
      flex: 1,
      backgroundColor: '#F0F4F8', // Light background for the safe area
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F0F4F8', // Light, clean background
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A2B48', // Dark blue
    marginBottom: 20,
    textAlign: 'center',
  },
  statusText: {
      fontSize: 16,
      color: '#5A6A8A', // Medium gray-blue
      marginTop: 15,
      textAlign: 'center',
      lineHeight: 22,
  },
  loadingIndicator: {
      // color property used directly in ActivityIndicator component
      color: '#3498DB', // Professional blue
  },
  errorHeading: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#E74C3C', // Error red
      marginBottom: 15,
      textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#C0392B', // Darker red
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  retryButton: {
      backgroundColor: '#3498DB', // Blue button
      paddingVertical: 12,
      paddingHorizontal: 30,
      borderRadius: 25,
      marginTop: 10,
      elevation: 2, // Android shadow
      shadowColor: '#000', // iOS shadow
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.5,
  },
  retryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
  },
});
// test
export default LoginStatus;