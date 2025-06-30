// Index.tsx

import React, {memo, Suspense, useCallback, useContext, useEffect, useRef, useState,} from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    I18nManager,
    LayoutAnimation,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import {FlashList} from "@shopify/flash-list";
import {useLocalSearchParams, usePathname, useRouter} from 'expo-router';
import {makeRedirectUri, Prompt, useAuthRequest} from 'expo-auth-session';
import Icon from 'react-native-vector-icons/Ionicons';
import Constants from 'expo-constants';

// Import Contexts and Components (ADJUST PATHS AS NEEDED)
import {UserContext} from '@/app/UserContext';
import {ScrollContext} from './ScrollContext';
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
type BackendItemTypeFilter = 'all' | 'tweet' | 'article' | 'bluesky';
const { extra } = Constants.expoConfig ?? {};
if (!extra) {
    throw new Error("App config `extra` is not defined. Please check your app.config.js.");
}

const domain = extra.AUTH0_DOMAIN as string;
const clientId = extra.AUTH0_CLIENT_ID as string;
const domaindynamo = extra.API_URL as string;

if (!domain || !clientId || !domaindynamo) {
    throw new Error("One or more required environment variables (AUTH0_DOMAIN, AUTH0_CLIENT_ID, API_URL) are not set in your .env file or app.config.js.");
}
const redirectUri = makeRedirectUri({ path: 'loginstatus' });
const PAGE_LIMIT = 15;
const MAX_ITEMS_TO_KEEP = 150;
const ESTIMATED_ITEM_HEIGHT = 300;
const scrollY = useRef(new Animated.Value(0)).current;

// Modals (Lazy Loaded - Unchanged)
const ArticleModal = React.lazy(() => import('./articlepage'));
const TweetModal = React.lazy(() => import('./tweetpage'));

// --- Category Grouping Logic (Complete) ---
const preferenceToMainCategoryMap: Record<string, string> = {
  'Breaking News': 'Top Stories', 'Top': 'Top Stories', 'World': 'Top Stories',
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
   // Add this line back:
    const [loadingLogin, setLoadingLogin] = useState(false);
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
  const [activeContentTypeFilter, setActiveContentTypeFilter] = useState<'All' | 'Tweets' | 'Articles' | 'BlueSky'>('All');


  // UI Message State
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  // --- Refs ---
  const flashListRef = useRef<FlashList<any>>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);



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
            const fetchedPrefs: string[] = data.data
                .map((item: any) => item?.preference)
                .filter((pref: any): pref is string => typeof pref === 'string');
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
  const trackInteraction = useCallback((itemId: string | number, itemType: 'tweet' | 'article' | 'bluesky' | 'unknown', interactionType: string) => {
    if (!username || !userToken) return;
    const finalItemId = String(itemId);
    const payload = { username, itemId: finalItemId, itemType, interactionType, region: userRegion || undefined };
    fetch(`${domaindynamo}/track-interaction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(response => { if (!response.ok) { response.text().then(text => console.warn(`Interaction tracking failed: ${response.status}`, text)); } })
    .catch(error => { console.warn("Network error tracking interaction:", error); });
  }, [username, userToken, domaindynamo, userRegion]);

    const fetchContent = useCallback(async (page: number, isPaginating: boolean = false) => {
        const feedToFetch = activeFeed;
        // activeContentTypeFilter is accessed directly from the component's state scope within useCallback

        if (feedToFetch === 'trending') { return; }

        if (!isPaginating) { cancelOngoingFetch(); }
        const controller = new AbortController();
        fetchControllerRef.current = controller;

        if (isPaginating) { setIsLoadingMore(true); }
        else {
            setIsContentLoading(true);
            setContentErrorMessage('');
            if (page === 1) { setFeedData([]); /* setDisplayFeedData([]); // Handled by effect on feedData change */ }
            setHasMoreData(true);
        }
        // Updated log to show activeContentTypeFilter when relevant
        console.log(`[fetchContent] Fetching Page ${page} for Feed: ${feedToFetch}${feedToFetch === 'chronological' ? `, TypeFilter: ${activeContentTypeFilter}` : ''}`);

        try {
            let fetchedItems: any[] = [];
            let dataLength = 0;
            let endpoint = '';
            let bodyPayload: string; // Ensure bodyPayload is string for JSON.stringify output
            let headers: HeadersInit = { 'Content-Type': 'application/json' };

            if (feedToFetch === 'forYou') {
                if (!username || !userToken) { throw new Error("Log in required"); }
                endpoint = `${domaindynamo}/get-for-you-feed`;
                const payloadObject = { token: userToken, page: page, limit: PAGE_LIMIT };
                bodyPayload = JSON.stringify(payloadObject);
            }
            else if (feedToFetch === 'chronological') {
                let categoriesToQuery: string[] = [];
                if (typeof activeSubcategoryFilter === 'string') categoriesToQuery = [activeSubcategoryFilter];
                else if (Array.isArray(activeSubcategoryFilter)) categoriesToQuery = activeSubcategoryFilter;
                else categoriesToQuery = relevantSubcategories;

                // Skip fetch if no categories selected and not a search (search has its own handler)
                if (categoriesToQuery.length === 0 && !searchQuery) { // searchQuery check from original code
                    console.log("[fetchContent: Chrono] No relevant categories selected and not a search. Fetching nothing.");
                    if (!controller.signal.aborted) {
                        if (page === 1) { setFeedData([]); }
                        setHasMoreData(false);
                    }
                    setIsContentLoading(false); setIsLoadingMore(false);
                    return;
                }

                endpoint = `${domaindynamo}/get-chronological-feed`;

                // Map frontend filter state to backend expected value
                let backendItemType: string = 'all'; // Use string type here for BackendItemTypeFilter
                switch (activeContentTypeFilter) {
                    case 'Tweets': backendItemType = 'tweet'; break;
                    case 'Articles': backendItemType = 'article'; break;
                    case 'BlueSky': backendItemType = 'bluesky'; break;
                    case 'All': // Explicitly handle 'All'
                    default: backendItemType = 'all'; break;
                }

                const payloadObject: any = {
                    categories: categoriesToQuery,
                    page,
                    limit: PAGE_LIMIT,
                    itemTypeFilter: backendItemType, // ADDED THIS LINE
                };
                if (userRegion) payloadObject.region = userRegion;
                bodyPayload = JSON.stringify(payloadObject);
                console.log("[fetchContent: Chrono] Payload sent:", bodyPayload);
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
            console.log('[DEBUG] Raw data from backend (first item):', data.data && data.data.length > 0 ? data.data[0] : 'No data');

            const dataKey = data.data;
            const statusKey = data.status;
            if ((statusKey === 'Content found') && Array.isArray(dataKey)) {
                fetchedItems = dataKey.map((item: any) => ({
                    type: item.item_type,
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
                        return combined.length > MAX_ITEMS_TO_KEEP ? combined.slice(combined.length - MAX_ITEMS_TO_KEEP) : combined;
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
                    if (page === 1) { setFeedData([]); /* setDisplayFeedData([]); // Handled by effect */ }
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
        activeFeed,
        activeContentTypeFilter, // ADDED: activeContentTypeFilter as a dependency
        domaindynamo,
        username,
        userToken,
        userRegion,
        PAGE_LIMIT,
        MAX_ITEMS_TO_KEEP,
        selectedMainCategory,
        activeSubcategoryFilter,
        relevantSubcategories,
        searchQuery,
        cancelOngoingFetch,
        setUserToken
        // Note: State setters like setFeedData, setIsLoadingMore, etc., don't need to be in deps.
        // relevantSubcategories and selectedMainCategory are included as they affect categoriesToQuery logic.
    ]);

// Fetch Trending Content (This function remains unchanged as it doesn't use itemTypeFilter)
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
            if (page === 1) { setFeedData([]); /* setDisplayFeedData([]); // Handled by effect */ }
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
                    type: 'tweet', // Trending content is assumed to be tweets based on original mapping
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
                        return combined.length > MAX_ITEMS_TO_KEEP ? combined.slice(combined.length - MAX_ITEMS_TO_KEEP) : combined;
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
                    if (page === 1) { setFeedData([]); /* setDisplayFeedData([]); // Handled by effect */ }
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
    }, [
        activeFeed, // activeFeed is still needed to gate execution
        domaindynamo,
        userRegion,
        PAGE_LIMIT,
        MAX_ITEMS_TO_KEEP,
        cancelOngoingFetch
        // Other state variables like username, userToken are not used by trending
    ]);




// Add this back inside the Index component
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false,
      // NOTE: No extraParams/audience here like in the new hook
      prompt: Prompt.Login, // Add prompt: 'login' like the old version had
    },
    {
      authorizationEndpoint: `https://${domain}/authorize`
      // NOTE: No explicit tokenEndpoint here like in the new hook
    }
  );

  // Add this function back inside the Index component
    const handleLogin = async () => {
      setLoadingLogin(true);
      // setErrorMessage(''); // Uncomment if you added errorMessage state back

      if (Platform.OS === 'web') {
        // Use the same URL construction method as the old version
          window.location.href = `https://${domain}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20profile%20email&prompt=login`;
      } else {
        try {
          if (request) {
            const result = await promptAsync(); // Use promptAsync directly
            if (result.type === 'success' && result.params.code) {
              // Navigate to loginstatus like the old version
              router.push({ pathname: '/loginstatus', params: { code: result.params.code } });
            } else if (result.type === 'error') {
                // Basic error logging like the old version
                console.error('Auth Error:', result.params?.error, result.params?.error_description);
                // setErrorMessage(result.params?.error_description || 'Authorization failed'); // Use if added back
                Alert.alert('Login Error', result.params?.error_description || 'Authorization failed'); // Or keep Alert
            } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
                // Basic logging for other issues
                console.error('Auth Issue:', result);
                // setErrorMessage('Login failed'); // Use if added back
                Alert.alert('Login Error', 'An unexpected issue occurred during login.'); // Or keep Alert
            }
          } else {
             // Handle case where request is not ready
             console.error("Authentication request is not ready.");
             // setErrorMessage('Login setup failed.'); // Use if added back
             Alert.alert('Login Error', 'Authentication request could not be prepared.'); // Or keep Alert
          }
        } catch (error: any) {
          console.error('Error during login process:', error);
          // setErrorMessage(error.message || 'An unexpected error occurred.'); // Use if added back
          Alert.alert('Login Failed', error.message || 'An unexpected error occurred.'); // Or keep Alert
        }
      }
      // Make sure loading state is reset regardless of web/native or success/error
      setLoadingLogin(false);
    };


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
       let fetchedItems: any[] = []; let dataLength: number;
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
    // Inside Index.tsx

// *** Effect for Frontend Filtering (Display Logic) ***
    useEffect(() => {
        console.log(`[Display Logic Effect] Updating displayFeedData. ActiveFeed: ${activeFeed}, feedData length: ${feedData.length}`);
        // For chronological feed, if a specific type filter is active,
        // the backend has already filtered. If 'All' is active, backend sends all types.
        // In both these scenarios for chronological, feedData is what we want to display.
        // For other feeds ('forYou', 'trending'), we also display feedData directly
        // as no frontend type filtering is currently applied to them.
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDisplayFeedData(feedData);
    }, [feedData, activeFeed]); // activeContentTypeFilter is removed from dependencies here,
    // as its change now triggers a full refetch of feedData
    // which will already be correctly filtered by the backend.


  // Replace the existing main data fetch useEffect with this one

    // --- Main Data Fetch Trigger Effect (Corrected Sync Logic) ---
    // Inside Index.tsx

// --- Main Data Fetch Trigger Effect (Corrected Sync Logic) ---
    useEffect(() => {
        // *** Log dependencies at the start ***
        console.log(`[Effect Trigger - Deps Check] Path: ${pathname}, params.feed: ${params.feed}, activeFeed: ${activeFeed}, pageLoading: ${pageLoading}, username: ${username ? 'Exists' : 'Null'}, selectedMainCategory: ${selectedMainCategory}, activeSubcategoryFilter: ${activeSubcategoryFilter}, activeContentTypeFilter: ${activeContentTypeFilter}, searchQuery: ${searchQuery}`); // Added activeContentTypeFilter to log

        // ... (your existing logic for paramTargetFeed and setActiveFeed) ...
        const requestedFeedParam = params.feed;
        let paramTargetFeed: 'forYou' | 'trending' = 'forYou';
        if (requestedFeedParam === 'trending') {
            paramTargetFeed = 'trending';
        }
        if (pathname === '/' && paramTargetFeed !== activeFeed && activeFeed !== 'chronological') {
            setActiveFeed(paramTargetFeed);
            return;
        }

        console.log(`[Effect Trigger] State is sync'd or 'chronological'. Proceeding with activeFeed: ${activeFeed}`);

        if (pageLoading || (activeFeed === 'forYou' && !username)) {
            console.log(`[Effect Trigger] Skipping fetch: pageLoading=${pageLoading}, activeFeed=${activeFeed}, username=${username ? 'Exists' : 'None'}`);
            if (!pageLoading && (activeFeed === 'forYou' && !username)) {
                if (feedData.length > 0) setFeedData([]);
            }
            setIsContentLoading(false);
            setIsSearchLoading(false);
            return;
        }

        console.log(`[Effect Trigger] Conditions met, fetching page 1 for feed: ${activeFeed}, query: '${searchQuery}', typeFilter: ${activeFeed === 'chronological' ? activeContentTypeFilter : 'N/A'}`);
        setCurrentPage(1);
        setHasMoreData(true);

        const trimmedQuery = searchQuery.trim();
        if (activeFeed === 'chronological' && trimmedQuery !== '') {
            handleSearchQuery(trimmedQuery, 1, false);
        } else if (activeFeed === 'trending') {
            fetchTrendingContent(1, false);
        } else if (activeFeed === 'forYou' || activeFeed === 'chronological') {
            // Chronological with no search & now with type filter falls here
            fetchContent(1, false);
        } else {
            console.warn("[Effect Trigger] Unhandled feed type:", activeFeed);
        }

    }, [
        pathname,
        params.feed,
        activeFeed,
        pageLoading,
        username,
        selectedMainCategory,
        activeSubcategoryFilter,
        activeContentTypeFilter, // <-- ADD activeContentTypeFilter HERE
        searchQuery,
        fetchContent,           // fetchContent now depends on activeContentTypeFilter too
        handleSearchQuery,
        fetchTrendingContent
    ]);

  // --- Callback Handlers ---

  // Modal Openers (Complete)
  const handleTweetPress = useCallback((item: any) => {
    if (!userToken) { showLoginMessage(); return; }
    if (item && item.id && typeof item.id === 'string') {
        setSelectedTweetLink(item.id);
        setTweetModalVisible(true);
        trackInteraction(item.id, item.type, 'view');
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
    const handleFeedChange = useCallback((newFeed: 'forYou' | 'chronological' | 'trending') => { // Added 'trending'
        if (newFeed !== activeFeed) {
            console.log(`Switching feed to: ${newFeed}`);
            setActiveFeed(newFeed);
            setSearchQuery('');
            setIsSearchLoading(false);
            // Reset chronological specific filters only if switching AWAY from chronological or TO it
            if (activeFeed === 'chronological' || newFeed === 'chronological') {
                // If switching TO chronological, set a default main category if available
                if (newFeed === 'chronological' && availableMainCategories.length > 0 && !availableMainCategories.includes(selectedMainCategory)) {
                    const firstValidMainCat = availableMainCategories[0];
                    setSelectedMainCategory(firstValidMainCat);
                    setRelevantSubcategories(getPreferencesForMainCategory(firstValidMainCat).filter(sub => userPreferences.includes(sub)));
                } else if (newFeed === 'chronological' && selectedMainCategory) {
                    // Ensure relevant subcategories are up to date if main category is already set
                    setRelevantSubcategories(getPreferencesForMainCategory(selectedMainCategory).filter(sub => userPreferences.includes(sub)));
                }
                setActiveSubcategoryFilter(null);
                setActiveContentTypeFilter('All');
            }
            setContentErrorMessage('');
            flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
            // If switching to 'trending' or 'forYou' via HeaderTabs, update router to reflect this for consistency
            // Only do this if the current path is the home path.
            if (pathname === '/') {
                if (newFeed === 'trending') {
                    router.replace({ pathname: '/', params: { feed: 'trending' } });
                } else if (newFeed === 'forYou') {
                    router.replace({ pathname: '/', params: { feed: 'forYou' } }); // Or params: {}
                }
                // No router change for 'chronological' as it's a sub-state of "Home"
            }

        }
    }, [activeFeed, router, pathname, availableMainCategories, selectedMainCategory, userPreferences]); // Added router, pathname and chronological filter states

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
  const handleContentTypeFilterChange = useCallback((filter: 'All' | 'Tweets' | 'Articles' | 'BlueSky') => {
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
      const onPressHandler = item.type === 'article'  ? handleArticlePress : handleTweetPress;
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
    // Inside the Index component's return statement:
    return (
        <SafeAreaView style={[dynamicStyles.container, { backgroundColor: themeBackgroundColor }]}>
            <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />

            <HeaderTabs
                activeFeedType={activeFeed}
                onFeedTypeChange={handleFeedChange} // Pass the handler for For You/Chronological switching

                // Main Categories (only if chronological)
                categories={activeFeed === 'chronological' ? availableMainCategories : undefined}
                activeCategory={activeFeed === 'chronological' ? selectedMainCategory : undefined}
                onCategorySelect={activeFeed === 'chronological' ? handleMainCategorySelect : undefined}

                // ... (rest of the props for subcategories, filters, user, search as before)
                subcategories={
                    activeFeed === 'chronological' && selectedMainCategory
                        ? getPreferencesForMainCategory(selectedMainCategory)
                        : undefined
                }
                allUserPreferences={userPreferences}
                activeSubcategory={activeFeed === 'chronological' ? activeSubcategoryFilter : undefined}
                onSubcategorySelect={activeFeed === 'chronological' ? handleSubcategoryFilterChange : undefined}
                activeFilter={activeFeed === 'chronological' ? activeContentTypeFilter : undefined}
                onContentTypeFilterChange={activeFeed === 'chronological' ? handleContentTypeFilterChange : undefined}
                username={username}
                profilePictureUrl={profilePictureUrl}
                onSettingsPress={() => { if (!userToken) { showLoginMessage(); return; } router.push('/settings'); }}
                onLoginPress={handleLogin}
                isLoggedIn={!!userToken}
                onSearch={handleSearchChange}
                searchQuery={searchQuery}
                isLoading={loadingLogin}
                scrollY={scrollY}
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
                  <TouchableOpacity onPress={handleLogin} style={dynamicStyles.retryButton}>
                     <Text style={dynamicStyles.retryButtonText}>Log In</Text>
                  </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={dynamicStyles.listContentContainer}
        onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false } // Set to true if HeaderTabs animations allow for it (opacity yes, height no)
            // For your HeaderTabs, height animations are used, so keep it false for now.
        )}
        scrollEventThrottle={16}
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
        onExplorePress={() => router.push('/explore')}
        onProfilePress={!userToken ? showLoginMessage : () => router.push('/myprofile')}
        onArrowPress={handleScrollToTop}
        activeTab={
            pathname === '/explore' ? 'explore'
            : pathname === '/myprofile' ? 'profile'
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
// --- Final Export ---
export default Index;
