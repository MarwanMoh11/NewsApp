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
    Modal,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    ScrollView,
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
        if (error.message.includes('Failed to register user') || error.message.includes('Failed to update your profile') || error.message.includes('Failed to set username')) {
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
    // Username clash & modal state
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [proposedUsername, setProposedUsername] = useState('');
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [isChoosingUsername, setIsChoosingUsername] = useState(false);
    const pendingAuthInfoRef = useRef<{ authToken: string; email?: string; fullName?: string; profilePicture?: string } | null>(null);

    // Ref to prevent processing the same code multiple times if component re-renders quickly
    const codeProcessedRef = useRef(false);
    const initialTimeRef = useRef<number>(Date.now()); // Record time when component instance is created

    const { code: nativeCode, error: nativeError, error_description: nativeErrorDescription } = useLocalSearchParams();

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
            console.error(`[${Date.now() - initialTimeRef.current}ms] processAuthorizationCode: Error during authentication process:`);
            console.error(error);
            const friendlyMessage = getFriendlyErrorMessage(error);
            setErrorMessage(friendlyMessage);
            setShowRetry(true);
            setIsLoading(false);
        }
    }, [setUserToken]);

    // --- Effect to Trigger Processing ---
    useEffect(() => {
        const effectStartTime = Date.now();
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nativeCode, nativeError, nativeErrorDescription, processAuthorizationCode]); // Dependencies

    // --- Step 1: Exchange Code for Tokens ---
    const exchangeCodeForToken = async (authCode: string): Promise<Auth0TokenResponse> => {
        const exchangeStartTime = Date.now();
        const tokenEndpoint = `https://${AUTH0_DOMAIN}/oauth/token`;

        const redirectUri = makeRedirectUri({ path: REDIRECT_PATH });

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
            console.error(`[${Date.now() - initialTimeRef.current}ms] exchangeCodeForToken: Network or unexpected error:`);
            console.error(error);
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
            console.log(`[${Date.now() - initialTimeRef.current}ms] fetchUserInfo: raw response body:`, responseBodyText);
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
            console.error(`[${Date.now() - initialTimeRef.current}ms] fetchUserInfo: Network or unexpected error:`);
            console.error(error);
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

            // read raw body text for better debugging (log it, then parse if possible)
            const rawBodyText = await response.text().catch(() => '');
            console.log(`[${Date.now() - initialTimeRef.current}ms] /process-login raw response text:`, rawBodyText);

            let data: any = {};
            try {
                data = rawBodyText ? JSON.parse(rawBodyText) : {};
            } catch (parseErr) {
                console.warn(`[${Date.now() - initialTimeRef.current}ms] /process-login: Failed to parse JSON body; proceeding with raw text check.`, parseErr);
            }

            console.log(`[${Date.now() - initialTimeRef.current}ms] /process-login parsed body:`, data);

            // Handle username clash explicitly — be tolerant: some backends return 409 without a specific `code` field
            const is409 = response.status === 409;
            const messageText = (data && data.message) ? String(data.message) : String(rawBodyText || '');
            const messageIndicatesTaken = /taken/i.test(messageText) || /already taken/i.test(messageText);

            if (is409 || messageIndicatesTaken) {
                console.warn(`[${Date.now() - initialTimeRef.current}ms] Username clash detected by status or message. status=${response.status}, message='${messageText}'`);

                // Try to extract the username mentioned in the backend message if present
                let detectedUsername: string | null = null;
                try {
                    const m = messageText.match(/'([^']+)' is already taken/i) || messageText.match(/username\s*([^\s]+)\s*is already taken/i);
                    if (m && m[1]) detectedUsername = m[1];
                } catch (e) { /* ignore */ }

                // Store auth context for the follow-up call
                pendingAuthInfoRef.current = { authToken: Auth0Token, email: Email, fullName: FullName, profilePicture: ProfilePicture };

                // Seed an initial proposal (append random digits). Prefer detectedUsername -> Nickname
                const base = (detectedUsername || Nickname || 'user').toString().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15) || 'user';
                const seed = `${base}${Math.floor(Math.random() * 900 + 100)}`;
                console.log(`[${Date.now() - initialTimeRef.current}ms] Username clash: proposing seed='${seed}' (base='${base}').`);

                setProposedUsername(seed);
                setUsernameError(null);
                setShowUsernameModal(true);
                setIsLoading(false);
                return; // stop normal flow here; modal will handle the rest
            }

            // 2. Check if the backend call itself was successful
            if (!response.ok || data.status !== 'Success') {
                // include rawBodyText in thrown error for maximum debug visibility
                const errMsg = data.message || rawBodyText || `Backend process failed with status ${response.status}`;
                console.error(`[${Date.now() - initialTimeRef.current}ms] handleUserRegistrationOrLogin: Backend returned error: ${errMsg}`);
                throw new Error(errMsg);
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
            console.error(`[${Date.now() - initialTimeRef.current}ms] handleUserRegistrationOrLogin: Error during backend interaction:`);
            console.error(error);
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
            console.error(`[${Date.now() - initialTimeRef.current}ms] handleReactivation: Error:`);
            console.error(error);
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
            router.replace(navigationTarget as any);
            // Let router handle state - do not clear navigationTarget immediately
        }
    }, [navigationTarget, router]);


    // --- Retry / Go Back Logic ---
    const validateUsername = (name: string): string | null => {
        const trimmed = name.trim();
        if (trimmed.length < 3 || trimmed.length > 20) return 'Username must be 3-20 characters.';
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Only letters, numbers, and underscores are allowed.';
        return null;
    };

    // --- Submit chosen username to /choose-username endpoint ---
    const submitChosenUsername = async () => {
        if (isChoosingUsername) return;
        const err = validateUsername(proposedUsername);
        if (err) { setUsernameError(err); return; }
        setUsernameError(null);
        setIsChoosingUsername(true);
        setErrorMessage(null);
        setShowRetry(false);

        try {
            const authInfo = pendingAuthInfoRef.current;
            if (!authInfo) { throw new Error('Missing auth context for setting username.'); }
            console.log(`[${Date.now() - initialTimeRef.current}ms] submitChosenUsername: Calling POST ${API_BASE_URL}/choose-username with new_username='${proposedUsername.trim()}'`);
            const response = await fetch(`${API_BASE_URL}/choose-username`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth_token: authInfo.authToken,
                    new_username: proposedUsername.trim(),
                    email: authInfo.email,
                    full_name: authInfo.fullName,
                    profile_picture: authInfo.profilePicture,
                })
            });

            const rawText = await response.text().catch(() => '');
            console.log(`[${Date.now() - initialTimeRef.current}ms] choose-username raw response:`, rawText);
            let data: any = {};
            try { data = rawText ? JSON.parse(rawText) : {}; } catch(e) { console.warn(`[${Date.now() - initialTimeRef.current}ms] choose-username: failed to JSON.parse response`); }
            console.log(`[${Date.now() - initialTimeRef.current}ms] choose-username parsed response:`, data, 'status:', response.status);

            if (!response.ok || data.status !== 'Success') {
                if (response.status === 409 || (data && data.code === 'USERNAME_TAKEN') || /taken/i.test(rawText || '')) {
                    setUsernameError('That username is taken. Please try another.');
                    return;
                }
                throw new Error(data.message || rawText || `Failed to set username (status ${response.status})`);
            }

            // Success
            if (data.needsReactivation) {
                setShowUsernameModal(false);
                promptForReactivation(proposedUsername.trim());
                return;
            }

            if (!data.token) {
                throw new Error('Username set succeeded but token missing.');
            }

            setUserToken(data.token);
            setShowUsernameModal(false);
            setNavigationTarget('/preferences');

        } catch (error) {
            console.error(`[${Date.now() - initialTimeRef.current}ms] submitChosenUsername: Error:`);
            console.error(error);
            setErrorMessage(getFriendlyErrorMessage(error));
            setShowRetry(true);
        } finally {
            setIsChoosingUsername(false);
            setIsLoading(false);
        }
    };

    const handleCancelChooseUsername = () => {
        console.log(`[${Date.now() - initialTimeRef.current}ms] handleCancelChooseUsername: User cancelled username selection.`);
        pendingAuthInfoRef.current = null;
        setShowUsernameModal(false);
        setUserToken(null);
        router.replace('/'); // send them back to start/login
    };

    const handleRetry = () => {
        console.log(`[${Date.now() - initialTimeRef.current}ms] handleRetry: Navigating back to /`);
        router.replace('/'); // Go back to login start
    };


    // --- Render Logic ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    {isLoading ? (
                        <>
                            <Text style={styles.heading}>Processing Login...</Text>
                            <ActivityIndicator size="large" color="#3498DB" style={{ marginTop: 12 }} />
                            <Text style={styles.statusText}>Please wait...</Text>
                        </>
                    ) : errorMessage ? (
                        <>
                            <Text style={styles.errorHeading}>Login Problem</Text>
                            <Text style={styles.errorText} selectable={Platform.OS !== 'web'}>
                                {errorMessage}
                            </Text>
                            {showRetry && (
                                <TouchableOpacity style={styles.retryButton} onPress={handleRetry} accessibilityRole="button">
                                    <Text style={styles.retryButtonText}>Try Again / Go Back</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <ActivityIndicator size="large" color="#3498DB" />
                    )}

                    {/* Username Modal */}
                    <Modal
                        visible={showUsernameModal}
                        animationType="fade"
                        transparent
                        onRequestClose={handleCancelChooseUsername}
                    >
                        <View style={styles.modalBackdrop}>
                            <View style={styles.modalContainer}>
                                <Text style={styles.modalTitle}>Choose a username</Text>
                                <Text style={styles.modalSubtitle}>
                                    The username suggested is already taken. Pick a unique handle so others can find you.
                                </Text>

                                <Text style={styles.inputLabel}>Username</Text>
                                <TextInput
                                    value={proposedUsername}
                                    onChangeText={(t) => {
                                        setProposedUsername(t);
                                        if (usernameError) setUsernameError(null);
                                    }}
                                    style={[styles.input, usernameError ? styles.inputError : null]}
                                    placeholder="your_username"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    maxLength={20}
                                    accessibilityLabel="Choose username"
                                />
                                {usernameError ? <Text style={styles.fieldError}>{usernameError}</Text> : null}

                                <View style={styles.modalButtonsRow}>
                                    <Pressable
                                        style={[styles.modalButton, styles.cancelButton]}
                                        onPress={handleCancelChooseUsername}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </Pressable>

                                    <Pressable
                                        style={[styles.modalButton, styles.saveButton]}
                                        onPress={submitChosenUsername}
                                        accessibilityRole="button"
                                        disabled={isChoosingUsername}
                                    >
                                        {isChoosingUsername ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.saveButtonText}>Save & Continue</Text>
                                        )}
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </Modal>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F0F4F8',
    },
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#F0F4F8',
    },
    heading: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A2B48',
        marginBottom: 20,
        textAlign: 'center',
    },
    statusText: {
        fontSize: 16,
        color: '#5A6A8A',
        marginTop: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    loadingIndicator: {
        color: '#3498DB',
    },
    errorHeading: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#E74C3C',
        marginBottom: 15,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#C0392B',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    retryButton: {
        backgroundColor: '#3498DB',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        marginTop: 10,
        elevation: 2,
        shadowColor: '#000',
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

    // Modal styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(10,12,18,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 520,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 22,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F1724',
        marginBottom: 6,
        textAlign: 'left',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#475569',
        marginBottom: 14,
    },
    inputLabel: {
        fontSize: 12,
        color: '#374151',
        marginBottom: 6,
        marginTop: 6,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E6E9EE',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        fontSize: 16,
        backgroundColor: '#FCFEFF',
    },
    inputError: {
        borderColor: '#F87171',
    },
    fieldError: {
        color: '#E11D48',
        marginTop: 8,
        marginBottom: 4,
        fontSize: 13,
    },
    modalButtonsRow: {
        marginTop: 16,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    modalButton: {
        minWidth: 120,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
    },
    cancelButtonText: {
        color: '#111827',
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#2563EB',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
});

export default LoginStatus;
