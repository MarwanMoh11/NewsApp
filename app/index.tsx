// Index.tsx

import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
  Suspense,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  TextInput,
  Keyboard,
  LayoutAnimation,
  UIManager,
  I18nManager,
  Dimensions,
  Animated, // Keep if used elsewhere
  // Modal, Button, FlatList removed (no longer needed for category selection here)
} from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { makeRedirectUri, useAuthRequest, AuthRequestPromptOptions } from 'expo-auth-session';
import Icon from 'react-native-vector-icons/Ionicons';

// Import Contexts and Components (ADJUST PATHS AS NEEDED)
import { UserContext } from '../app/UserContext';
import { ScrollContext } from './ScrollContext';
import HeaderTabs from '../components/HeaderTabs';
import MasterCard from '../components/MasterCard';
import ChronicallyButton from '../components/ui/ChronicallyButton';
import InAppMessage from '../components/ui/InAppMessage';

// Enable LayoutAnimation on Android (Keep this)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Config (Unchanged)
const domain = 'dev-1uzu6bsvrd2mj3og.us.auth0.com';
const clientId = 'CZHJxAwp7QDLyavDaTLRzoy9yLKea4A1';
const redirectUri = makeRedirectUri({ useProxy: Platform.OS !== 'web', path: 'loginstatus' });
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const PAGE_LIMIT = 15;
const MAX_ITEMS_TO_KEEP = 150;
const ESTIMATED_ITEM_HEIGHT = 300;

// Modals (Lazy Loaded - Unchanged)
const ArticleModal = React.lazy(() => import('./articlepage'));
const TweetModal = React.lazy(() => import('./tweetpage'));

// --- Category Grouping Logic (Complete) ---
const preferenceToMainCategoryMap: Record<string, string> = {
  'Breaking News': 'Top Stories', 'Politics': 'Top Stories', 'Top': 'Top Stories', 'World': 'Top Stories',
  'Business': 'Business', 'Technology': 'Business', 'Finance': 'Business',
  'Health': 'Health & Environment', 'Environment': 'Health & Environment', 'Food': 'Health & Environment', 'Science': 'Health & Environment',
  'Football': 'Sports', 'Formula1': 'Sports', 'Sports': 'Sports', 'Gaming': 'Sports', 'Cricket': 'Sports', 'Tennis': 'Sports',
  'Lifestyle': 'Lifestyle', 'Travel': 'Lifestyle', 'Education': 'Lifestyle', 'Tourism': 'Lifestyle',
  'Entertainment': 'Entertainment', 'Movies': 'Entertainment', 'Music': 'Entertainment',
  'Crime': 'Society', 'Domestic': 'Society', 'Other': 'Society', 'Odd': 'Society',
};
const displayMainCategories: string[] = [
  'Top Stories', 'Business', 'Sports', 'Entertainment', 'Health & Environment', 'Lifestyle', 'Society'
];
const getPreferencesForMainCategory = (mainCategory: string): string[] => {
  return Object.entries(preferenceToMainCategoryMap)
    .filter(([_, main]) => main === mainCategory)
    .map(([pref, _]) => pref);
};
const defaultUserPreferences: string[] = ['Breaking News', 'Business', 'Sports', 'Entertainment', 'Health'];


// --- Helper Function (Complete) ---
const areArraysEqual = (arr1: any[] | null | undefined, arr2: any[] | null | undefined): boolean => {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;
  const sortedArr1 = [...arr1].sort();
  const sortedArr2 = [...arr2].sort();
  return sortedArr1.every((value, index) => value === sortedArr2[index]);
};


// --- Custom Auth Hook (Complete) ---
function useAuth() {
  const router = useRouter();
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false,
      extraParams: {
        audience: 'chronically-backend-api'
      }
    },
    {
      authorizationEndpoint: `https://${domain}/authorize`,
      tokenEndpoint: `https://${domain}/oauth/token`,
    }
  );
  const authUrlWeb = `https://${domain}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20profile%20email&prompt=login`;

  const login = useCallback(async (options?: AuthRequestPromptOptions) => {
    setLoadingLogin(true);
    try {
      if (Platform.OS === 'web') {
        window.location.href = authUrlWeb;
      } else {
        if (request) {
          const result = await promptAsync(options);
          if (result.type === 'success' && result.params.code) {
            router.push({ pathname: '/loginstatus', params: { code: result.params.code } });
          } else if (result.type === 'error') {
            console.error('Auth Error:', result.params?.error, result.params?.error_description);
            throw new Error(result.params?.error_description || 'Authorization failed');
          } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
            console.error('Auth Issue:', result);
            Alert.alert('Login Error', 'An unexpected issue occurred during login.');
          }
        } else {
          Alert.alert('Login Error', 'Authentication request could not be prepared.');
        }
      }
    } catch (error: any) {
      console.error('Error during login process:', error);
      Alert.alert('Login Failed', error.message || 'An unexpected error occurred.');
    } finally {
      setLoadingLogin(false);
    }
  }, [router, request, promptAsync, authUrlWeb]);

  return { login, loadingLogin };
}


// --- Memoized Card Components (Complete) ---
const MemoizedMasterCard = memo(MasterCard);


// ================== Main Index Component ==================
const Index: React.FC = () => {
  // --- Contexts ---
  const { setScrollToTop } = useContext(ScrollContext);
  const { userToken, setUserToken, isDarkTheme } = useContext(UserContext);
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ feed?: 'forYou' | 'trending' | 'chronological' }>(); // Define expected param type


  // --- State ---
  // Feed and Content State
  const [activeFeed, setActiveFeed] = useState<'forYou' | 'chronological' | 'trending'>('forYou');
  const [feedData, setFeedData] = useState<any[]>([]); // Raw data from backend
  const [displayFeedData, setDisplayFeedData] = useState<any[]>([]); // Filtered data for FlashList
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentErrorMessage, setContentErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // Modal State (Article/Tweet Modals remain)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [tweetModalVisible, setTweetModalVisible] = useState(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  // REMOVED: isCategoryModalVisible state

  // User Profile and Preferences State
  const [userPreferences, setUserPreferences] = useState<string[]>(defaultUserPreferences);
  const [username, setUsername] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [userRegion, setUserRegion] = useState<string | null>(null);

  // Chronological Feed Filter State
  const [availableMainCategories, setAvailableMainCategories] = useState<string[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [relevantSubcategories, setRelevantSubcategories] = useState<string[]>([]);
  const [activeSubcategoryFilter, setActiveSubcategoryFilter] = useState<string | string[] | null>(null);
  const [activeContentTypeFilter, setActiveContentTypeFilter] = useState<'All' | 'Tweets' | 'Articles'>('All');


  // UI Message State
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  // --- Refs ---
  const flashListRef = useRef<FlashList<any>>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);

  // --- Custom Hooks ---
  const { login, loadingLogin } = useAuth();

  // --- Utility Functions (Complete) ---
  const showLoginMessage = useCallback((text: string = "Please log in to access this feature.", type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
  }, []);

  // --- Profile, Preferences & Region Fetching (Complete) ---
    const fetchProfilePicture = useCallback(async (uname: string) => {
        if (!uname) return;
        try {
        const response = await fetch(`${domaindynamo}/get-profile-picture?username=${encodeURIComponent(uname)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.status === 'Success' && data.profile_picture) { setProfilePictureUrl(data.profile_picture); }
        else { if (data.status !== 'Profile picture not found') { console.warn('Profile picture fetch issue:', data.message || 'No picture URL'); } setProfilePictureUrl(null); }
        } catch (error) { console.error('Error fetching profile picture:', error); setProfilePictureUrl(null); }
    }, [domaindynamo]);

    const fetchPreferences = useCallback(async (uname: string): Promise<string[]> => {
        if (!uname) { return defaultUserPreferences; }
        try {
        const response = await fetch(`${domaindynamo}/check-preferences`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.status === 'Success' && Array.isArray(data.data)) {
            const fetchedPrefs: string[] = data.data.map((item: any) => item?.preference).filter((pref): pref is string => typeof pref === 'string');
            return fetchedPrefs.length > 0 ? fetchedPrefs : defaultUserPreferences;
        } else {
            console.warn('Preference fetch issue:', data.message || 'No preferences found');
            return defaultUserPreferences;
        }
        } catch (error) {
        console.error('Error fetching preferences:', error);
        return defaultUserPreferences;
        }
    }, [domaindynamo]);

    const fetchUserRegion = useCallback(async (uname: string): Promise<string | null> => {
        if (!uname) { console.warn("fetchUserRegion: Username not provided."); return null; }
        try {
        const apiUrl = `${domaindynamo}/get-region?username=${encodeURIComponent(uname)}`;
        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'Success' && typeof data.region === 'string' && data.region.length > 0) {
            return data.region;
            } else { console.warn(`[fetchUserRegion] API OK but no valid region data for ${uname}. Response:`, data); return null; }
        } else { console.error(`[fetchUserRegion] Failed for ${uname}. Status: ${response.status}`); return null; }
        } catch (error) { console.error(`[fetchUserRegion] Network error for ${uname}:`, error); return null; }
    }, [domaindynamo]);


    const fetchUsernameAndRelatedData = useCallback(async () => {
        const resetToLoggedOutState = () => {
        console.log('[fetchUsernameAndRelatedData] Calling resetToLoggedOutState');
        setUsername(null); setProfilePictureUrl(null); setUserRegion(null); setUserPreferences(defaultUserPreferences);
        const derivedMainCats = displayMainCategories.filter(mainCat => getPreferencesForMainCategory(mainCat).some(pref => defaultUserPreferences.includes(pref)));
        const orderedMainCats = displayMainCategories.filter(cat => derivedMainCats.includes(cat));
        setAvailableMainCategories(orderedMainCats);
        const initialMainCategory = orderedMainCats[0] || '';
        setSelectedMainCategory(initialMainCategory);
        setActiveSubcategoryFilter(null);
        setRelevantSubcategories(getPreferencesForMainCategory(initialMainCategory).filter(sub => defaultUserPreferences.includes(sub)));
        setActiveContentTypeFilter('All');
        };

        if (!userToken) {
        console.log('[fetchUsernameAndRelatedData] No userToken found, resetting.');
        resetToLoggedOutState();
        setPageLoading(false);
        return;
        }

        console.log('[fetchUsernameAndRelatedData] START - Found userToken.');
        setPageLoading(true);

        try {
        console.log('[fetchUsernameAndRelatedData] Calling backend /get-username...');
        const response = await fetch(`${domaindynamo}/get-username`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: userToken })
        });

        console.log(`[fetchUsernameAndRelatedData] /get-username status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error text');
            console.error(`[fetchUsernameAndRelatedData] /get-username failed: ${response.status}`, errorText);
            if (response.status === 401 || response.status === 403) { setUserToken(null); }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('[fetchUsernameAndRelatedData] /get-username response data:', data);

        if (data.status === 'Success' && data.username) {
            const fetchedUsername = data.username;
            console.log('[fetchUsernameAndRelatedData] SUCCESS: Calling setUsername with:', fetchedUsername);
            setUsername(fetchedUsername);

            console.log('[fetchUsernameAndRelatedData] Fetching profile pic, region, prefs...');
            const [regionResult, prefsResult] = await Promise.all([
                fetchUserRegion(fetchedUsername),
                fetchPreferences(fetchedUsername)
            ]);
            fetchProfilePicture(fetchedUsername);
            console.log('[fetchUsernameAndRelatedData] Fetched related data complete.');

            setUserPreferences(prefsResult);
            setUserRegion(regionResult);

            const derivedMainCats = displayMainCategories.filter(mainCat => getPreferencesForMainCategory(mainCat).some(pref => prefsResult.includes(pref)));
            const orderedRelevantMainCategories = displayMainCategories.filter(cat => derivedMainCats.includes(cat));
            setAvailableMainCategories(orderedRelevantMainCategories);

            const currentSelectedIsValid = selectedMainCategory && orderedRelevantMainCategories.includes(selectedMainCategory);
            const initialMainCategory = currentSelectedIsValid ? selectedMainCategory : (orderedRelevantMainCategories[0] || '');

            setSelectedMainCategory(initialMainCategory);
            setRelevantSubcategories(getPreferencesForMainCategory(initialMainCategory).filter(sub => prefsResult.includes(sub)));
            setActiveSubcategoryFilter(null);
            setActiveContentTypeFilter('All');

        } else {
            console.warn('[fetchUsernameAndRelatedData] FAILED: Username fetch issue in response data. Resetting state.', data.message || data.error);
            resetToLoggedOutState();
            if (data.message === 'Invalid or expired token' || data.error === 'Invalid token') { setUserToken(null); }
        }
        } catch (error) {
        console.error('[fetchUsernameAndRelatedData] CATCH block error:', error);
        resetToLoggedOutState();
        } finally {
        console.log('[fetchUsernameAndRelatedData] FINALLY: Setting pageLoading false.');
        setPageLoading(false);
        }
    }, [userToken, setUserToken, fetchProfilePicture, fetchUserRegion, fetchPreferences, selectedMainCategory]);


    // --- Effect to run username/profile fetching on token change ---
    useEffect(() => {
        console.log(`Effect running: userToken change detected. Token: ${userToken ? 'Exists' : 'Null'}`);
        fetchUsernameAndRelatedData();
    }, [userToken, fetchUsernameAndRelatedData]);


  // --- Data Fetching Functions ---

  // Abort Controller Management (Complete)
  const cancelOngoingFetch = useCallback(() => {
    if (fetchControllerRef.current) {
      console.log("[CancelFetch] Aborting previous fetch controller.");
      fetchControllerRef.current.abort();
      fetchControllerRef.current = null;
    }
  }, []);

  // Interaction Tracking (Complete)
  const trackInteraction = useCallback((itemId: string | number, itemType: 'tweet' | 'article', interactionType: string) => {
    if (!username || !userToken) return;
    const finalItemId = String(itemId);
    const payload = { username, itemId: finalItemId, itemType, interactionType, region: userRegion || undefined };
    fetch(`${domaindynamo}/track-interaction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(response => { if (!response.ok) { response.text().then(text => console.warn(`Interaction tracking failed: ${response.status}`, text)); } })
    .catch(error => { console.warn("Network error tracking interaction:", error); });
  }, [username, userToken, domaindynamo, userRegion]);

  // Fetch ForYou/Chronological Content (Complete - uses frontend filtering)
  const fetchContent = useCallback(async (page: number, isPaginating: boolean = false) => {
    const feedToFetch = activeFeed;
    if (feedToFetch === 'trending') { return; }

    if (!isPaginating) { cancelOngoingFetch(); }
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    if (isPaginating) { setIsLoadingMore(true); }
    else {
      setIsContentLoading(true);
      setContentErrorMessage('');
      if (page === 1) { setFeedData([]); setDisplayFeedData([]); }
      setHasMoreData(true);
    }
    console.log(`[fetchContent] Fetching Page ${page} for Feed: ${feedToFetch}`);

    try {
      let fetchedItems: any[] = [];
      let dataLength = 0;
      let endpoint = '';
      let bodyPayload = '';
      let headers: HeadersInit = { 'Content-Type': 'application/json' };

      if (feedToFetch === 'forYou') {
        if (!username || !userToken) { throw new Error("Log in required"); }
        endpoint = `${domaindynamo}/get-for-you-feed`;
        bodyPayload = JSON.stringify({ token: userToken, page: page, limit: PAGE_LIMIT });
      }
      else if (feedToFetch === 'chronological') {
        let categoriesToQuery: string[] = [];
        if (typeof activeSubcategoryFilter === 'string') categoriesToQuery = [activeSubcategoryFilter];
        else if (Array.isArray(activeSubcategoryFilter)) categoriesToQuery = activeSubcategoryFilter;
        else categoriesToQuery = relevantSubcategories;

        if (categoriesToQuery.length === 0 && !searchQuery) {
             console.log("[fetchContent: Chrono] No relevant categories selected. Fetching nothing.");
             if (!controller.signal.aborted) {
                 if (page === 1) { setFeedData([]); setDisplayFeedData([]); }
                 setHasMoreData(false);
             }
             setIsContentLoading(false); setIsLoadingMore(false);
             return;
        }

        endpoint = `${domaindynamo}/get-chronological-feed`;
        const payloadObject: any = { categories: categoriesToQuery, page, limit: PAGE_LIMIT };
        if (userRegion) payloadObject.region = userRegion;
        bodyPayload = JSON.stringify(payloadObject);
        console.log("[fetchContent: Chrono] Payload sent (no contentType):", bodyPayload);
      }
      else { throw new Error("Invalid feed type selected for fetchContent"); }

      console.log(`[fetchContent] Making fetch to ${endpoint}`);
      const response = await fetch(endpoint, { method: 'POST', headers: headers, body: bodyPayload, signal: controller.signal });
      console.log(`[fetchContent] Response status for ${endpoint}: ${response.status}`);

      if (controller.signal.aborted) { console.log(`[fetchContent] Fetch aborted.`); return; }
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchContent] Error ${response.status} from ${endpoint}:`, errorText);
        let errorMsg = `HTTP error! status: ${response.status}`;
        try { const errorData = JSON.parse(errorText); errorMsg = errorData.error || errorData.message || `Server error ${response.status}`; } catch(e) {}
        if (feedToFetch === 'forYou' && (response.status === 401 || response.status === 403)) { setUserToken(null); errorMsg = "Session expired. Please log in again."; }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log(`[fetchContent] Raw data received for ${endpoint}:`, data.status, `(${data?.data?.length || 0} items)`);

      const dataKey = data.data;
      const statusKey = data.status;
      if ((statusKey === 'Content found') && Array.isArray(dataKey)) {
        fetchedItems = dataKey.map((item: any) => ({
          type: item.item_type, // 'tweet' or 'article' from backend
          id: item.item_id,
          dateTime: item.created_at,
          author: item.author,
          text_content: item.text_content,
          media_url: item.media_url,
          categories: item.categories,
          region: item.region,
          Retweets: item.Retweets,
          Favorites: item.Favorites,
          Explanation: item.Explanation,
        }));
        dataLength = fetchedItems.length;
        console.log(`[fetchContent] Processed ${dataLength} raw items.`);
      } else if (statusKey?.startsWith('No ')) {
          fetchedItems = []; dataLength = 0;
          console.log(`[fetchContent] No raw content found status: ${statusKey}`);
      } else {
          console.error(`[fetchContent] Unknown backend status/data format: ${statusKey}`, data);
          throw new Error(data.message || data.error || `Failed to load ${feedToFetch} feed.`);
      }

      if (!controller.signal.aborted) {
        console.log(`[fetchContent] Updating RAW feedData state. Page: ${page}, New raw items: ${fetchedItems.length}`);
        if (page === 1) {
          setFeedData(fetchedItems);
        } else {
          setFeedData(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const newUniqueItems = fetchedItems.filter(item => !existingIds.has(item.id));
            const combined = [...prev, ...newUniqueItems];
            const pruned = combined.length > MAX_ITEMS_TO_KEEP ? combined.slice(combined.length - MAX_ITEMS_TO_KEEP) : combined;
            return pruned;
          });
        }
        const potentiallyMore = dataLength >= PAGE_LIMIT;
        setHasMoreData(potentiallyMore);
        console.log(`[fetchContent] Setting hasMoreData to: ${potentiallyMore}`);
      } else { console.log("[fetchContent] State update skipped, fetch aborted."); }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(`[FetchContent Error: ${feedToFetch}]`, error);
        if (!controller.signal?.aborted) {
          setContentErrorMessage(error.message || 'Failed to load content.');
          if (page === 1) { setFeedData([]); setDisplayFeedData([]); }
          setHasMoreData(false);
        }
      } else { console.log(`[FetchContent: ${feedToFetch}] Aborted.`); }
    } finally {
      if (!controller.signal?.aborted) {
        setIsContentLoading(false);
        setIsLoadingMore(false);
      }
      if (fetchControllerRef.current === controller) { fetchControllerRef.current = null; }
    }
  }, [
    activeFeed, domaindynamo, username, userToken, userRegion, PAGE_LIMIT,
    MAX_ITEMS_TO_KEEP, selectedMainCategory, activeSubcategoryFilter,
    relevantSubcategories, searchQuery, cancelOngoingFetch, setUserToken
  ]);

    // Fetch Trending Content (Complete - populates feedData)
    const fetchTrendingContent = useCallback(async (page: number, isPaginating: boolean = false) => {
        const feedToFetch = 'trending';
        if (activeFeed !== feedToFetch) { return; }
        if (!isPaginating) { cancelOngoingFetch(); }
        const controller = new AbortController();
        fetchControllerRef.current = controller;

        if (isPaginating) { setIsLoadingMore(true); }
        else {
            setIsContentLoading(true);
            setContentErrorMessage('');
            if (page === 1) { setFeedData([]); setDisplayFeedData([]); }
            setHasMoreData(true);
        }
        console.log(`[fetchTrending] Fetching Page ${page}`);
        const endpoint = `${domaindynamo}/get_trending_tweets`;
        const payload: any = { page, limit: PAGE_LIMIT };
        if (userRegion) { payload.region = userRegion; }

        try {
            console.log(`[fetchTrending] Making fetch to ${endpoint} with payload:`, payload);
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
            console.log(`[fetchTrending] Response status: ${response.status}`);
            if (controller.signal.aborted) { console.log(`[fetchTrending] Fetch aborted.`); return; }
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[fetchTrending] Error ${response.status}:`, errorText);
                let errorMsg = `HTTP error! status: ${response.status}`;
                try { const errorData = JSON.parse(errorText); errorMsg = errorData.error || errorData.message || `Server error ${response.status}`; } catch(e) {}
                throw new Error(errorMsg);
            }
            const data = await response.json();
            console.log(`[fetchTrending] Raw data received:`, data.status, `(${data?.data?.length || 0} items)`);
            let fetchedItems: any[] = [];
            let dataLength = 0;
            if (data.status === 'Success' && Array.isArray(data.data)) {
                fetchedItems = data.data.map((item: any) => ({
                    type: 'tweet',
                    id: item.Tweet_Link,
                    dateTime: item.Created_At || item.created_at,
                    author: item.Username,
                    text_content: item.Tweet,
                    media_url: item.Media_URL,
                    categories: item.categories,
                    region: item.Region,
                    Retweets: item.Retweets,
                    Favorites: item.Favorites,
                    Explanation: item.Explanation,
                }));
                dataLength = fetchedItems.length;
                console.log(`[fetchTrending] Processed ${dataLength} raw items.`);
            } else if (data.status?.includes('No trending tweets found')) {
                fetchedItems = []; dataLength = 0;
                console.log(`[fetchTrending] No content found status: ${data.status}`);
            } else {
                console.error(`[fetchTrending] Unknown backend status/data format: ${data.status}`, data);
                throw new Error(data.message || data.error || 'Failed to load trending feed.');
            }
            if (!controller.signal.aborted) {
                console.log(`[fetchTrending] Updating RAW feedData state. Page: ${page}, New raw items: ${fetchedItems.length}`);
                if (page === 1) {
                    setFeedData(fetchedItems);
                } else {
                    setFeedData(prev => {
                        const existingIds = new Set(prev.map(item => item.id));
                        const newUniqueItems = fetchedItems.filter(item => !existingIds.has(item.id));
                        const combined = [...prev, ...newUniqueItems];
                        const pruned = combined.length > MAX_ITEMS_TO_KEEP ? combined.slice(combined.length - MAX_ITEMS_TO_KEEP) : combined;
                        return pruned;
                    });
                }
                const potentiallyMore = dataLength >= PAGE_LIMIT;
                setHasMoreData(potentiallyMore);
                console.log(`[fetchTrending] Setting hasMoreData to: ${potentiallyMore}`);
            } else { console.log("[fetchTrending] State update skipped, fetch aborted."); }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(`[fetchTrending Error]`, error);
                if (!controller.signal?.aborted) {
                    setContentErrorMessage(error.message || 'Failed to load trending content.');
                    if (page === 1) { setFeedData([]); setDisplayFeedData([]); }
                    setHasMoreData(false);
                }
            } else { console.log(`[fetchTrending] Aborted.`); }
        } finally {
            if (!controller.signal?.aborted) {
                setIsContentLoading(false);
                setIsLoadingMore(false);
            }
            if (fetchControllerRef.current === controller) { fetchControllerRef.current = null; }
        }
    }, [ activeFeed, domaindynamo, userRegion, PAGE_LIMIT, MAX_ITEMS_TO_KEEP, cancelOngoingFetch ]);


 // Inside Index.tsx

   // Search Function (Complete - populates feedData, uses CORRECTED mapping)
   const handleSearchQuery = useCallback(async (query: string, page: number, isPaginating: boolean = false) => {
     const trimmedQuery = query.trim();
     // Search only makes sense for chronological feed currently
     if (activeFeed !== 'chronological') {
       console.warn("[handleSearchQuery] Search called outside chronological feed.");
       // Don't reset query here, allow user to switch back
       setIsSearchLoading(false);
       return;
     }

     if (trimmedQuery === '') {
       if (!isPaginating) { console.log("[handleSearchQuery] Empty query, fetching chronological feed page 1"); fetchContent(1, false); setIsSearchLoading(false); }
       else { if (!isPaginating) setIsSearchLoading(false); } return;
     }
     if (!isPaginating) { cancelOngoingFetch(); setCurrentPage(1); setHasMoreData(true); setFeedData([]); setDisplayFeedData([]);}
     const controller = new AbortController(); fetchControllerRef.current = controller;
     if (isPaginating) { setIsLoadingMore(true); }
     else { setIsSearchLoading(true); setIsContentLoading(true); setContentErrorMessage(''); }
     const searchEndpoint = `${domaindynamo}/search_content`;
     console.log(`[handleSearchQuery] Fetching page ${page} for query: '${trimmedQuery}'`);
     try {
       const response = await fetch(searchEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ searchQuery: trimmedQuery, page: page, limit: PAGE_LIMIT }), signal: controller.signal });
       console.log(`[handleSearchQuery] Response status: ${response.status}`);
       if (controller.signal.aborted) { console.log("[handleSearchQuery] Search aborted."); return; }
       if (!response.ok) { const errorText = await response.text(); console.error(`[handleSearchQuery] Search Error ${response.status}:`, errorText); let errorMsg = `Search failed: ${response.status}`; try { const errorData = JSON.parse(errorText); errorMsg = errorData.error || errorData.message || errorMsg; } catch (e) {} throw new Error(errorMsg); }
       const data = await response.json(); console.log(`[handleSearchQuery] Raw data received:`, data.status, `(${data?.data?.length || 0} items)`);
       let fetchedItems: any[] = []; let dataLength = 0;
       if (data.status === 'Success' && Array.isArray(data.data)) {

         // *** CORRECTED MAPPING - Use direct field names from backend ***
         // Replace the previous complex mapping with this direct one:
         fetchedItems = data.data.map((item: any) => ({
             type: item.item_type,         // Direct from backend alias
             id: item.item_id,             // Direct from backend alias
             dateTime: item.created_at,    // Direct from backend alias
             author: item.author,          // Direct from backend alias
             text_content: item.text_content,  // Direct from backend alias
             media_url: item.media_url,      // Direct from backend alias
             categories: item.categories,    // Direct from backend alias
             region: item.region,          // Direct from backend alias (null for articles)
             Retweets: item.Retweets,      // Direct from backend alias (null for articles)
             Favorites: item.Favorites,    // Direct from backend alias (null for articles)
             Explanation: item.Explanation,  // Direct from backend alias
         }));
         // *** END OF CORRECTED MAPPING ***

         dataLength = fetchedItems.length; console.log(`[handleSearchQuery] Processed ${dataLength} raw search items.`);
       } else { console.log(`[handleSearchQuery] No results found or status not Success: ${data.status}`); fetchedItems = []; dataLength = 0; if (data.status !== 'No results found') { console.warn('[handleSearchQuery] Search issue:', data.message || data.status); } }
       if (!controller.signal.aborted) {
         console.log(`[handleSearchQuery] Updating RAW feedData. Page: ${page}, New: ${fetchedItems.length}`);
         if (page === 1) { setFeedData(fetchedItems); }
         else { setFeedData(prev => { const existingIds = new Set(prev.map(item => item.id)); const newUniqueItems = fetchedItems.filter(item => !existingIds.has(item.id)); const combined = [...prev, ...newUniqueItems]; const pruned = combined.length > MAX_ITEMS_TO_KEEP ? combined.slice(combined.length - MAX_ITEMS_TO_KEEP) : combined; return pruned; }); }
         const potentiallyMore = dataLength >= PAGE_LIMIT; setHasMoreData(potentiallyMore); console.log(`[handleSearchQuery] Setting hasMoreData: ${potentiallyMore}`);
       } else { console.log("[handleSearchQuery] State update skipped."); }
     } catch (error: any) { if (error.name !== 'AbortError') { console.error('[handleSearchQuery] Error searching:', error); if (!controller.signal?.aborted) { setContentErrorMessage(error.message || 'Search failed.'); if (page === 1) { setFeedData([]); setDisplayFeedData([]); } setHasMoreData(false); } } else { console.log("[handleSearchQuery] Aborted."); } }
     finally { if (!controller.signal?.aborted) { setIsContentLoading(false); setIsLoadingMore(false); setIsSearchLoading(false); } if (fetchControllerRef.current === controller) { fetchControllerRef.current = null; } }
   }, [domaindynamo, activeFeed, MAX_ITEMS_TO_KEEP, PAGE_LIMIT, cancelOngoingFetch, fetchContent]); // Keep dependencies as is


  // --- Effect for Setting up Chronological Filters Based on Preferences (Complete) ---
    useEffect(() => {
        if (!username || pageLoading) return;
        const relevantMain = displayMainCategories.filter(mainCat =>
            getPreferencesForMainCategory(mainCat).some(pref => userPreferences.includes(pref))
        );
        const orderedRelevant = displayMainCategories.filter(cat => relevantMain.includes(cat));
        if (!areArraysEqual(availableMainCategories, orderedRelevant)) {
             console.log("Updating available main categories:", orderedRelevant);
             setAvailableMainCategories(orderedRelevant);
        }
        const currentSelectedIsValid = selectedMainCategory && orderedRelevant.includes(selectedMainCategory);
        let newMainCat = selectedMainCategory;
        if (!currentSelectedIsValid && orderedRelevant.length > 0) {
            newMainCat = orderedRelevant[0];
            console.log("Selected main category invalid, switching to:", newMainCat);
            setSelectedMainCategory(newMainCat);
            setActiveSubcategoryFilter(null);
            setActiveContentTypeFilter('All');
        } else if (orderedRelevant.length === 0) {
            console.log("No relevant main categories based on preferences.");
            newMainCat = '';
            setSelectedMainCategory('');
            setRelevantSubcategories([]);
            setActiveSubcategoryFilter(null);
            setActiveContentTypeFilter('All');
        }
        if (newMainCat) {
             const newRelevantSubs = getPreferencesForMainCategory(newMainCat).filter(sub => userPreferences.includes(sub));
             if (!areArraysEqual(relevantSubcategories, newRelevantSubs)) {
                 console.log("Updating relevant subcategories for", newMainCat, ":", newRelevantSubs);
                 setRelevantSubcategories(newRelevantSubs);
                 if (activeSubcategoryFilter && typeof activeSubcategoryFilter === 'string' && !newRelevantSubs.includes(activeSubcategoryFilter)) {
                    setActiveSubcategoryFilter(null);
                 }
             }
        }
    }, [userPreferences, username, pageLoading, selectedMainCategory, availableMainCategories, relevantSubcategories, activeSubcategoryFilter]);




  // *** Effect for Frontend Filtering (Display Logic) ***
  useEffect(() => {
    console.log(`[Filtering Effect] Running. Filter: ${activeContentTypeFilter}, Raw data length: ${feedData.length}`);
    let newlyFilteredData = [];
    if (activeFeed === 'chronological') {
        if (activeContentTypeFilter === 'All') {
            newlyFilteredData = feedData;
        } else if (activeContentTypeFilter === 'Tweets') {
            newlyFilteredData = feedData.filter(item => item.type === 'tweet');
        } else if (activeContentTypeFilter === 'Articles') {
            newlyFilteredData = feedData.filter(item => item.type === 'article');
        } else {
             newlyFilteredData = feedData;
        }
    } else {
        newlyFilteredData = feedData;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDisplayFeedData(newlyFilteredData);
  }, [feedData, activeContentTypeFilter, activeFeed]);


  // Replace the existing main data fetch useEffect with this one

    // --- Main Data Fetch Trigger Effect (Corrected Sync Logic) ---
    useEffect(() => {
      // *** Log dependencies at the start ***
      console.log(`[Effect Trigger - Deps Check] Path: ${pathname}, params.feed: ${params.feed}, activeFeed: ${activeFeed}, pageLoading: ${pageLoading}, username: ${username ? 'Exists' : 'Null'}, selectedMainCategory: ${selectedMainCategory}, activeSubcategoryFilter: ${activeSubcategoryFilter}, searchQuery: ${searchQuery}`);

      // Determine target feed from route params (only 'forYou' or 'trending')
      const requestedFeedParam = params.feed;
      let paramTargetFeed: 'forYou' | 'trending' = 'forYou'; // Default for '/'
      if (requestedFeedParam === 'trending') {
          paramTargetFeed = 'trending';
      }
      console.log(`[Effect Trigger] Determined targetFeed from params: ${paramTargetFeed}`);

      // Sync internal state ONLY IF:
      // 1. We are on the home route ('/') where params primarily dictate ForYou/Trending state.
      // 2. The target derived from params ('forYou' or 'trending') is different from the current state.
      // 3. AND the current state is NOT 'chronological' (because 'chronological' is set locally via HeaderTabs, not params).
      if (pathname === '/' && paramTargetFeed !== activeFeed && activeFeed !== 'chronological') {
          console.log(`[Effect Trigger] SYNCING internal state (${activeFeed}) with param target (${paramTargetFeed}) because path is '/' and current state is not 'chronological'.`);
          setActiveFeed(paramTargetFeed); // Update state to match param ('forYou' or 'trending')
          return; // Exit this run; the effect will re-run with the updated activeFeed state.
      }

      // If we reach here, activeFeed is either:
      // - Already matching the relevant param target ('forYou' or 'trending' when path is '/')
      // - Set to 'chronological' (by handleFeedChange)
      // - Or not on the '/' route (currently this component likely only renders on '/')
      console.log(`[Effect Trigger] State is sync'd or 'chronological'. Proceeding with activeFeed: ${activeFeed}`);

      // --- Proceed with fetch logic ---

      // Conditions to SKIP fetching (using the now-correct activeFeed)
      if (pageLoading || (activeFeed === 'forYou' && !username)) {
        console.log(`[Effect Trigger] Skipping fetch: pageLoading=${pageLoading}, activeFeed=${activeFeed}, username=${username ? 'Exists' : 'None'}`);
         // Avoid clearing data if just briefly pageLoading during initial load/sync
        if (!pageLoading && (activeFeed === 'forYou' && !username)) {
            // Clear data if specifically skipping because user isn't logged in for 'For You'
             if (feedData.length > 0) setFeedData([]);
             if (displayFeedData.length > 0) setDisplayFeedData([]);
        }
        setIsContentLoading(false);
        setIsSearchLoading(false);
        return;
      }

      // Fetching Logic (uses the now-correct `activeFeed` state)
      console.log(`[Effect Trigger] Conditions met, fetching page 1 for feed: ${activeFeed}, query: '${searchQuery}'`);
      setCurrentPage(1);
      setHasMoreData(true); // Assume more data initially for a new fetch trigger

      const trimmedQuery = searchQuery.trim();
      if (activeFeed === 'chronological' && trimmedQuery !== '') {
          console.log('[Effect Trigger] Calling handleSearchQuery');
          handleSearchQuery(trimmedQuery, 1, false);
      } else if (activeFeed === 'trending') {
          console.log('[Effect Trigger] Calling fetchTrendingContent');
          fetchTrendingContent(1, false);
      } else if (activeFeed === 'forYou' || activeFeed === 'chronological') { // Chronological with no search falls here
          console.log('[Effect Trigger] Calling fetchContent');
          fetchContent(1, false);
      } else {
          console.warn("[Effect Trigger] Unhandled feed type:", activeFeed);
      }

    }, [
      // Dependencies
      pathname, // Need pathname to know if param logic applies
      params.feed, // React to param changes
      activeFeed, // React to internal state changes
      pageLoading, // React when loading finishes
      username, // React when username appears (for 'For You')
      // Filters that trigger refetch for the *current* feed
      selectedMainCategory,
      activeSubcategoryFilter,
      searchQuery,
      // Fetch functions (stable callbacks - include to satisfy eslint)
      fetchContent,
      handleSearchQuery,
      fetchTrendingContent
    ]); // Make sure ALL dependencies are listed

  // --- Callback Handlers ---

  // Modal Openers (Complete)
  const handleTweetPress = useCallback((item: any) => {
    if (!userToken) { showLoginMessage(); return; }
    if (item && item.id && typeof item.id === 'string') {
        setSelectedTweetLink(item.id);
        setTweetModalVisible(true);
        trackInteraction(item.id, 'tweet', 'view');
    } else {
        console.warn("Tweet item/link (item.id) missing or not string", item);
        showLoginMessage("Could not open tweet details.", 'error');
    }
  }, [userToken, showLoginMessage, trackInteraction]);

  const handleArticlePress = useCallback((item: any) => {
    if (!userToken) { showLoginMessage(); return; }
    if (item && item.id) {
        const articleIdString = String(item.id);
        setSelectedArticleId(articleIdString);
        setModalVisible(true);
        trackInteraction(articleIdString, 'article', 'view');
    } else {
        console.warn("Article item/ID (item.id) missing", item);
        showLoginMessage("Could not open article details.", 'error');
    }
  }, [userToken, showLoginMessage, trackInteraction]);

  // Feed Change Handler (Complete)
  const handleFeedChange = useCallback((newFeed: 'forYou' | 'chronological') => {
    if (newFeed !== activeFeed) {
        console.log(`Switching feed to: ${newFeed}`);
        setActiveFeed(newFeed);
        setSearchQuery('');
        setIsSearchLoading(false);
        setActiveSubcategoryFilter(null);
        setActiveContentTypeFilter('All');
        setContentErrorMessage('');
        flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [activeFeed]);

  // *** NEW Main Category Select Handler (replaces modal logic) ***
  const handleMainCategorySelect = useCallback((category: string) => {
    // This is called by HeaderTabs when a category is chosen from its internal dropdown
    if (category !== selectedMainCategory) {
        console.log("[Index] Main category selected:", category);
        setSelectedMainCategory(category);
        // Recalculate relevant subcategories based on the new main category and user prefs
        const subs = getPreferencesForMainCategory(category).filter(pref =>
            userPreferences.includes(pref)
        );
        setRelevantSubcategories(subs);
        // Reset filters below main category
        setActiveSubcategoryFilter(null);
        setActiveContentTypeFilter('All');
        // Scroll list to top (optional, but good UX)
        flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
        // Data fetch triggered by useEffect dependency change [selectedMainCategory]
    }
  }, [selectedMainCategory, userPreferences]); // Dependencies needed for comparison and calculation

  // Subcategory Filter Change Handler (Complete)
  const handleSubcategoryFilterChange = useCallback((filter: string | string[] | null) => {
      if (filter !== activeSubcategoryFilter) {
          setActiveSubcategoryFilter(filter);
          flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
          // Data fetch triggered by useEffect
      }
  }, [activeSubcategoryFilter]);

  // Content Type Filter Change Handler (Complete - Updates state for filtering effect)
  const handleContentTypeFilterChange = useCallback((filter: 'All' | 'Tweets' | 'Articles') => {
    console.log(`[handleContentTypeFilterChange] Filter selected: ${filter}`);
    if (filter !== activeContentTypeFilter) {
        console.log(`[handleContentTypeFilterChange] Updating filter state from ${activeContentTypeFilter} to ${filter}`);
        setActiveContentTypeFilter(filter);
        flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
    } else {
        console.log(`[handleContentTypeFilterChange] Filter is already ${filter}, no state change.`);
    }
  }, [activeContentTypeFilter]);

  // Search Input Handler (Complete)
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Scroll to Top Handler (Complete)
  const handleScrollToTop = useCallback(() => { if (flashListRef.current) { flashListRef.current.scrollToOffset({ offset: 0, animated: true }); } }, []);
  useEffect(() => { setScrollToTop(() => handleScrollToTop); return () => setScrollToTop(() => () => {}); }, [setScrollToTop, handleScrollToTop]);

  // Pagination Handler (Complete - Fetches raw data)
  const loadMoreContent = useCallback(() => {
    if (isLoadingMore || !hasMoreData || isContentLoading || pageLoading) { return; }
    const nextPage = currentPage + 1;
    console.log(`[loadMoreContent] Attempting to load page ${nextPage} for feed: ${activeFeed}`);

    const trimmedQuery = searchQuery.trim();
    if (activeFeed === 'chronological' && trimmedQuery !== '') {
      console.log(`[loadMoreContent] Loading MORE RAW page ${nextPage} for SEARCH query: ${trimmedQuery}`);
      setCurrentPage(nextPage);
      handleSearchQuery(trimmedQuery, nextPage, true);
    } else if (activeFeed === 'trending') {
      console.log(`[loadMoreContent] Loading MORE RAW page ${nextPage} for TRENDING feed`);
      setCurrentPage(nextPage);
      fetchTrendingContent(nextPage, true);
    } else if (activeFeed === 'forYou' || activeFeed === 'chronological') {
      console.log(`[loadMoreContent] Loading MORE RAW page ${nextPage} for FEED: ${activeFeed}`);
      setCurrentPage(nextPage);
      fetchContent(nextPage, true);
    } else {
        console.warn("[loadMoreContent] No fetch action defined for feed:", activeFeed);
    }
  }, [isLoadingMore, hasMoreData, isContentLoading, pageLoading, currentPage, activeFeed, searchQuery, handleSearchQuery, fetchContent, fetchTrendingContent]);


  // Render Item function & Key Extractor (Complete)
  const renderContentCard = useCallback(({ item }: { item: any }) => {
      if (!item || !item.type || !item.id) {
      console.warn("Skipping render for item missing type or id:", item);
      return null;
      }
      const onPressHandler = item.type === 'tweet' ? handleTweetPress : handleArticlePress;
      return <MemoizedMasterCard item={item} onPress={onPressHandler} />;
  }, [handleTweetPress, handleArticlePress]);

  const keyExtractor = useCallback((item: any, index: number) => {
      return `${item?.type || 'unknown'}-${item?.id || `index-${index}`}`;
  }, []);

  // Render Footer (Complete)
  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return ( <View style={dynamicStyles.footerLoading}> <ActivityIndicator size="small" color={isDarkTheme ? '#9067C6' : '#007AFF'} /> </View> );
  };

  // Retry Fetch Handler (Complete)
  const handleRetryFetch = useCallback(() => {
    console.log("[handleRetryFetch] Retrying fetch...");
    setContentErrorMessage('');
    const trimmedQuery = searchQuery.trim();
    if (activeFeed === 'chronological' && trimmedQuery !== '') {
      handleSearchQuery(trimmedQuery, 1, false);
    } else if (activeFeed === 'trending') {
        fetchTrendingContent(1, false);
    } else if (activeFeed === 'forYou' || activeFeed === 'chronological') {
      fetchContent(1, false);
    }
  }, [searchQuery, activeFeed, fetchContent, handleSearchQuery, fetchTrendingContent]);


  // --- Theme and Styles (Complete) ---
  const dynamicStyles = getStyles(isDarkTheme);
  const themeStatusBar = isDarkTheme ? 'light-content' : 'dark-content';
  const themeBackgroundColor = isDarkTheme ? '#0A0A0A' : '#F8F9FA';

  // --- Initial Loading State (Complete) ---
  if (pageLoading) {
    return (
      <SafeAreaView style={[dynamicStyles.loadingContainer, { backgroundColor: themeBackgroundColor }]}>
        <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />
        <ActivityIndicator size="large" color={isDarkTheme ? '#9067C6' : '#007AFF'} />
        <Text style={[dynamicStyles.loadingText, { color: isDarkTheme ? '#A0A0A0' : '#6C6C6E' }]}>Loading Feed...</Text>
      </SafeAreaView>
    );
  }

  // --- Main Render ---
  return (
    <SafeAreaView style={[dynamicStyles.container, { backgroundColor: themeBackgroundColor }]}>
      <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />

      <HeaderTabs
        // Feed Management
        activeFeed={activeFeed}
        onFeedChange={handleFeedChange}

        // Chronological Filters
        availableMainCategories={activeFeed === 'chronological' ? availableMainCategories : undefined}
        selectedMainCategory={activeFeed === 'chronological' ? selectedMainCategory : undefined}
        onMainCategorySelect={activeFeed === 'chronological' ? handleMainCategorySelect : undefined} // Pass the selection handler
        subcategories={activeFeed === 'chronological' ? relevantSubcategories : undefined}
        activeSubcategoryFilter={activeFeed === 'chronological' ? activeSubcategoryFilter : undefined}
        onSubcategoryFilterChange={activeFeed === 'chronological' ? handleSubcategoryFilterChange : undefined}
        activeContentTypeFilter={activeFeed === 'chronological' ? activeContentTypeFilter : undefined}
        onContentTypeFilterChange={activeFeed === 'chronological' ? handleContentTypeFilterChange : undefined}


        // User & Search
        username={username}
        profilePictureUrl={profilePictureUrl}
        onSettingsPress={() => { if (!userToken) { showLoginMessage(); return; } router.push('/settings'); }}
        onLoginPress={login}
        isLoggedIn={!!userToken}
        onSearch={handleSearchChange}
        searchQuery={searchQuery}
        isLoading={loadingLogin}
        isSearchLoading={isSearchLoading}
      />

      {/* FlashList uses displayFeedData */}
      <FlashList
        ref={flashListRef}
        data={displayFeedData} // USE FILTERED DATA
        renderItem={renderContentCard}
        keyExtractor={keyExtractor}
        estimatedItemSize={ESTIMATED_ITEM_HEIGHT}
        onEndReached={loadMoreContent}
        onEndReachedThreshold={0.8}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          isContentLoading ? (
            <View style={dynamicStyles.listFeedbackContainer}>
              <ActivityIndicator size="large" color={isDarkTheme ? '#9067C6' : '#007AFF'} />
            </View>
          ) : contentErrorMessage ? (
             <View style={dynamicStyles.listFeedbackContainer}>
               <Icon name="cloud-offline-outline" size={60} color={isDarkTheme ? '#555' : '#AAA'} />
               <Text style={[dynamicStyles.emptyText, { color: isDarkTheme ? '#A0A0A0' : '#6C6C6E' }]}>{contentErrorMessage}</Text>
               <TouchableOpacity onPress={handleRetryFetch} style={dynamicStyles.retryButton}>
                 <Text style={dynamicStyles.retryButtonText}>Try Again</Text>
               </TouchableOpacity>
             </View>
          ) : displayFeedData.length === 0 ? (
            <View style={dynamicStyles.listFeedbackContainer}>
              <Icon name="file-tray-outline" size={60} color={isDarkTheme ? '#555' : '#AAA'} />
              <Text style={[dynamicStyles.emptyText, { color: isDarkTheme ? '#A0A0A0' : '#6C6C6E' }]}>
                { // Refined empty messages
                   searchQuery && activeFeed === 'chronological' ? 'No results found for your search.'
                  : activeFeed === 'forYou' ? (username ? 'Nothing new for you right now. Check back later!' : 'Log in to see your personalized feed.')
                  : activeFeed === 'trending' ? 'No trending content found right now.'
                  : activeFeed === 'chronological' ?
                    (activeContentTypeFilter !== 'All' && feedData.length > 0) ? `No ${activeContentTypeFilter} found matching the other filters.`
                    : (relevantSubcategories.length === 0 && selectedMainCategory && !searchQuery) ? `No relevant subcategories found for ${selectedMainCategory} based on your preferences.`
                    : 'No recent content found for the selected filters.'
                  : 'No content available.'
                }
              </Text>
              {activeFeed === 'forYou' && !username && (
                  <TouchableOpacity onPress={login} style={dynamicStyles.retryButton}>
                     <Text style={dynamicStyles.retryButtonText}>Log In</Text>
                  </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={dynamicStyles.listContentContainer}
      />

      {/* Modals (Complete) */}
      <Suspense fallback={<View style={StyleSheet.absoluteFillObject} pointerEvents="none" />}>
        <ArticleModal visible={modalVisible} onClose={() => setModalVisible(false)} articleId={selectedArticleId} />
        <TweetModal visible={tweetModalVisible} onClose={() => setTweetModalVisible(false)} tweetLink={selectedTweetLink} />
      </Suspense>

      {/* Category Selection Modal REMOVED */}

      {/* Bottom Navigation (Complete) */}
      <ChronicallyButton
        onHomePress={() => {
            if (activeFeed !== 'forYou') { handleFeedChange('forYou'); }
            else { handleScrollToTop(); }
        }}
        onTrendingPress={() => {
            if (activeFeed !== 'trending') { handleFeedChange('trending'); }
             else { handleScrollToTop(); }
        }}
        onBookmarkPress={!userToken ? showLoginMessage : () => router.push('/savedarticles')}
        onFeedPress={!userToken ? showLoginMessage : () => router.push('/repostfeed')}
        onFriendsPress={!userToken ? showLoginMessage : () => router.push('/followingpage')}
        onArrowPress={handleScrollToTop}
        activeTab={
            pathname === '/repostfeed' ? 'feed'
            : pathname === '/followingpage' ? 'friends'
            : pathname === '/savedarticles' ? 'saved'
            : activeFeed === 'trending' ? 'trending'
            : activeFeed === 'forYou' || activeFeed === 'chronological' ? 'home'
            : 'home'
        }
        isDarkTheme={isDarkTheme}
      />

      {/* In-App Message (Complete) */}
      <InAppMessage visible={messageVisible} message={messageText} type={messageType} onClose={() => setMessageVisible(false)} />

    </SafeAreaView>
  );
};

// --- Styling (Complete) ---
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
  button: getResponsiveSize(15),
};

const getStyles = (isDarkTheme: boolean) => {
  const colors = {
    background: isDarkTheme ? '#0A0A0A' : '#F8F9FA',
    card: isDarkTheme ? '#1A1A1A' : '#FFFFFF',
    text: isDarkTheme ? '#EAEAEA' : '#1C1C1E',
    textSecondary: isDarkTheme ? '#A0A0A0' : '#6C6C6E',
    accent: isDarkTheme ? '#9067C6' : '#007AFF',
    border: isDarkTheme ? '#2C2C2E' : '#E5E5E5',
    error: isDarkTheme ? '#FF6B6B' : '#D93025',
    success: isDarkTheme ? '#4ADE80' : '#16A34A',
    info: isDarkTheme ? '#60A5FA' : '#2563EB',
    buttonText: '#FFFFFF',
    buttonBackground: isDarkTheme ? '#3A3A3C' : '#007AFF',
    retryButtonText: isDarkTheme ? '#9067C6' : '#007AFF',
    placeholder: isDarkTheme ? '#666' : '#AAA',
    // Modal styles removed as modal is gone
  };

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 15,
      fontSize: fontSizes.medium,
    },
    listContentContainer: {
      paddingHorizontal: 0,
      paddingTop: 10,
      paddingBottom: 100, // Space for bottom nav
    },
    listFeedbackContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 50,
      minHeight: 300,
      paddingHorizontal: 30,
    },
    emptyText: {
      marginTop: 15,
      fontSize: fontSizes.medium,
      textAlign: 'center',
      lineHeight: fontSizes.medium * 1.5,
    },
    retryButton: {
      marginTop: 25,
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 25,
      borderWidth: 1.5,
      borderColor: colors.retryButtonText,
      alignItems: 'center',
    },
    retryButtonText: {
      color: colors.retryButtonText,
      fontSize: fontSizes.button,
      fontWeight: '600',
    },
    footerLoading: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    // Modal styles removed
  });
};


// --- Error Boundary (Complete) ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error: Error) { return { hasError: true, error: error }; }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error('ErrorBoundary caught an error:', error, errorInfo); /* Log to error reporting service */ }
    render() {
        if (this.state.hasError) {
        const styles = getStyles(false);
        const themeBackgroundColor = '#F8F9FA';
        const colors = { error: '#D93025', text: '#1C1C1E', textSecondary: '#6C6C6E' };

        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: themeBackgroundColor }]}>
            <StatusBar barStyle="dark-content" backgroundColor={themeBackgroundColor} />
            <Icon name="alert-circle-outline" size={60} color={colors.error} />
            <Text style={{ fontSize: fontSizes.large, color: colors.text, marginTop: 15, textAlign: 'center', paddingHorizontal: 20, fontWeight: '600' }}>
                Oops! Something went wrong.
            </Text>
            <Text style={{ fontSize: fontSizes.base, color: colors.textSecondary, marginTop: 10, textAlign: 'center', paddingHorizontal: 20 }}>
                Please try restarting the app. {__DEV__ && this.state.error && `\n\n${this.state.error.toString()}`}
            </Text>
            </SafeAreaView>
        );
        }
        return this.props.children;
    }
}


// --- Final Export ---
export default Index;