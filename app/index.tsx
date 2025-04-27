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
  Animated,
  StyleSheet,
  ActivityIndicator,
  Alert, // Keep for useAuth hook
  Platform,
  TouchableOpacity,
  SafeAreaView,
  // FlatList, // Removed FlatList import
  StatusBar,
} from 'react-native';
// *** Import FlashList ***
import { FlashList } from "@shopify/flash-list";
import { useRouter, usePathname } from 'expo-router';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import Icon from 'react-native-vector-icons/Ionicons';

// Import Contexts and Components
import { UserContext } from '../app/UserContext';
import { ContentChoiceContext } from './contentchoice';
import { ScrollContext } from './ScrollContext';
import HeaderTabs from '../components/HeaderTabs';
import TweetCard from '../components/TweetCard';
import ArticleCard from '../components/ArticleCard';
import ChronicallyButton from '../components/ui/ChronicallyButton';
import InAppMessage from '../components/ui/InAppMessage';

// Config
const domain = 'dev-1uzu6bsvrd2mj3og.us.auth0.com';
const clientId = 'CZHJxAwp7QDLyavDaTLRzoy9yLKea4A1';
const redirectUri = makeRedirectUri({ useProxy: Platform.OS !== 'web', path: 'loginstatus' });
const domaindynamo = 'https://chronically.netlify.app/.netlify/functions/index';
const PAGE_LIMIT = 12; // Number of items to fetch per page
const MAX_ITEMS_TO_KEEP = 200; // Maximum items to keep in state for performance
const ESTIMATED_ITEM_HEIGHT = 300; // ** Crucial for FlashList: ESTIMATED average height - ADJUST AS NEEDED **

// Modals (Lazy Loaded)
const ArticleModal = React.lazy(() => import('./articlepage'));
const TweetModal = React.lazy(() => import('./tweetpage'));

// --- Category Grouping Logic ---
const preferenceToMainCategoryMap: Record<string, string> = {
    'Breaking News': 'Top Stories', 'Politics': 'Top Stories', 'Top': 'Top Stories', 'World': 'Top Stories',
    'Business': 'Business', 'Technology': 'Business',
    'Health': 'Health & Environment', 'Environment': 'Health & Environment', 'Food': 'Health & Environment', 'Science': 'Health & Environment',
    'Football': 'Sports', 'Formula1': 'Sports', 'Sports': 'Sports', 'Gaming': 'Sports',
    'Lifestyle': 'Lifestyle', 'Travel': 'Lifestyle', 'Education': 'Lifestyle', 'Tourism': 'Lifestyle',
    'Entertainment': 'Entertainment',
    'Crime': 'Society', 'Domestic': 'Society', 'Other': 'Society',
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

// --- Helper Function ---
const areArraysEqual = (arr1: string[], arr2: string[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
};

// --- Custom Auth Hook ---
function useAuth() {
  const router = useRouter();
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [request, , promptAsync] = useAuthRequest(
    { clientId, redirectUri, scopes: ['openid', 'profile', 'email'], usePKCE: false, prompt: 'login', },
    { authorizationEndpoint: `https://${domain}/authorize` }
  );
  const authUrlWeb = `https://${domain}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20profile%20email&prompt=login`;

  const login = useCallback(async () => {
    setLoadingLogin(true);
    try {
      if (Platform.OS === 'web') { window.location.href = authUrlWeb; }
      else {
        if (request) {
          const result = await promptAsync();
          if (result.type === 'success' && result.params.code) { router.push({ pathname: '/loginstatus', params: { code: result.params.code } }); }
          else if (result.type !== 'cancel' && result.type !== 'dismiss') { console.error('Auth Error:', result); throw new Error(result.params?.error_description || 'Authorization failed'); }
        } else { Alert.alert('Login Error', 'Authentication request could not be prepared. Please try again.'); }
      }
    } catch (error: any) { console.error('Error during login:', error); Alert.alert('Login Failed', error.message || 'An unexpected error occurred during login.'); }
    finally { setLoadingLogin(false); }
  }, [router, request, promptAsync, authUrlWeb]);

  return { login, loadingLogin };
}

// --- Memoized Card Components ---
const MemoizedTweetCard = memo(TweetCard);
const MemoizedArticleCard = memo(ArticleCard);

// ================== Main Index Component ==================
const Index: React.FC = () => {
  // --- Contexts ---
  const { contentChoice, setContentChoice } = useContext(ContentChoiceContext);
  const { setScrollToTop } = useContext(ScrollContext);
  const { userToken, isDarkTheme } = useContext(UserContext);
  const router = useRouter();
  const pathname = usePathname();

  // --- Local States ---
  const [pageLoading, setPageLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [tweetModalVisible, setTweetModalVisible] = useState(false);
  const [selectedTweetLink, setSelectedTweetLink] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState<string[]>(defaultUserPreferences);
  const [mainDisplayCategories, setMainDisplayCategories] = useState<string[]>([]);
  const [activeMainCategory, setActiveMainCategory] = useState<string>('');
  const [activeSubcategory, setActiveSubcategory] = useState<string | string[] | null>(null);
  const [currentSubcategories, setCurrentSubcategories] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [username, setUsername] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // --- State for Content List & Fetching ---
  const [articlesAndTweets, setArticlesAndTweets] = useState<any[]>([]);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentErrorMessage, setContentErrorMessage] = useState('');

  // --- State for Pagination ---
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);

  // --- Refs ---
  // *** Update Ref type for FlashList ***
  const flashListRef = useRef<FlashList<any>>(null);
  const scrollY = useRef(new Animated.Value(0)).current; // Keep for potential scroll animations
  const fetchControllerRef = useRef<AbortController | null>(null);
  const searchDebounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- Custom Hooks ---
  const { login, loadingLogin } = useAuth();

  // --- Utility Functions ---
  const showLoginMessage = useCallback((text: string = "Please log in to access this feature.", type: 'info' | 'error' | 'success' = 'info') => {
    setMessageText(text);
    setMessageType(type);
    setMessageVisible(true);
  }, []);
  const formatDateToDay = useCallback((dateString?: string) => {
    if (!dateString) return '';
    try { return new Date(dateString).toISOString().split('T')[0]; }
    catch (e) { console.error("Error parsing date:", dateString, e); return ''; }
  }, []);

  // --- Profile & Preferences Fetching ---
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

  const fetchPreferences = useCallback(async (uname: string) => {
    if (!userToken) { setUserPreferences(defaultUserPreferences); return; }
    if (!uname) return;
    try {
      const response = await fetch(`${domaindynamo}/check-preferences`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname }) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.status === 'Success' && Array.isArray(data.data)) {
        const fetchedPrefs: string[] = data.data.map((item: any) => item?.preference).filter((pref): pref is string => typeof pref === 'string');
        setUserPreferences(fetchedPrefs.length > 0 ? fetchedPrefs : defaultUserPreferences);
      } else { console.warn('Preference fetch issue:', data.message || 'No preferences found'); setUserPreferences(defaultUserPreferences); }
    } catch (error) { console.error('Error fetching preferences:', error); setUserPreferences(defaultUserPreferences); }
  }, [domaindynamo, userToken]);

  const fetchUsername = useCallback(async () => {
    const resetToLoggedOutState = () => {
        setUsername(null); setProfilePictureUrl(null); setUserPreferences(defaultUserPreferences);
        const derivedMainCats = displayMainCategories.filter(mainCat => getPreferencesForMainCategory(mainCat).some(pref => defaultUserPreferences.includes(pref)));
        setMainDisplayCategories(derivedMainCats); setActiveMainCategory(derivedMainCats[0] || ''); setActiveSubcategory(null); setCurrentSubcategories(getPreferencesForMainCategory(derivedMainCats[0] || ''));
        setPageLoading(false);
    };
    if (!userToken) { resetToLoggedOutState(); return; }
    setPageLoading(true);
    try {
      const response = await fetch(`${domaindynamo}/get-username`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: userToken }) });
       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.status === 'Success' && data.username) {
        const fetchedUsername = data.username; setUsername(fetchedUsername);
        await fetchProfilePicture(fetchedUsername); await fetchPreferences(fetchedUsername);
      } else { console.warn('Username fetch issue:', data.message || 'Username not found'); resetToLoggedOutState(); }
    } catch (error) { console.error('Error fetching username:', error); resetToLoggedOutState(); }
    finally { if (userToken) setPageLoading(false); }
  }, [domaindynamo, userToken, fetchProfilePicture, fetchPreferences]);

  useEffect(() => { fetchUsername(); }, [userToken, fetchUsername]);

  // --- Data Fetching Functions ---
  const cancelOngoingFetch = () => {
      if (fetchControllerRef.current) {
          console.log("[CancelFetch] Aborting previous fetch controller.");
          fetchControllerRef.current.abort();
          fetchControllerRef.current = null;
      }
  };

  async function fetchRegion(username, backendUrlBase) {
    // 1. Check if username is provided
    if (!username) {
      console.warn("fetchRegion: Username is required.");
      return null; // Cannot fetch without a username
    }
    // Check if backendUrlBase is provided
    if (!backendUrlBase) {
        console.error("fetchRegion: Backend URL base is required.");
        return null;
    }

    try {
      // 2. Construct the API URL *correctly* using the provided base URL
      const apiUrl = `${backendUrlBase}/get-region?username=${encodeURIComponent(username)}`;
      console.log(`WorkspaceRegion: Calling ${apiUrl}`); // Debug log

      // 3. Make the GET request
      const response = await fetch(apiUrl);

      // 4. Check if the request was successful (HTTP status 200-299)
      if (response.ok) {
        const data = await response.json();
        // 5. Check the API's response structure for success and region data
        if (data.status === 'Success' && typeof data.region === 'string' && data.region.length > 0) {
          console.log(`WorkspaceRegion: Success for ${username}, region: ${data.region}`);
          return data.region; // Return the actual region string
        } else {
          // API call was okay, but the backend indicated an issue or missing/invalid data
          console.warn(`WorkspaceRegion: API OK but no valid region data for ${username}. Response:`, data);
          // Consider returning a default region or null based on your app's logic
          // return DEFAULT_REGION;
          return null;
        }
      } else {
        // Handle HTTP errors (404 Not Found, 500 Internal Server Error, etc.)
        console.error(`WorkspaceRegion: Failed for ${username}. Status: ${response.status}`);
         // You might want to see the response body for more details
         // const errorBody = await response.text(); console.error("Error body:", errorBody);
        return null; // Indicate failure
      }
    } catch (error) {
      // Handle network errors (couldn't connect, DNS issues, CORS, etc.)
      console.error(`WorkspaceRegion: Network error for ${username}:`, error);
      return null; // Indicate failure
    }
  }

  // --- Interaction Tracking ---
      const trackInteraction = useCallback((itemId: string | number, itemType: 'tweet' | 'article', interactionType: string) => {
        // Don't track if not logged in
        if (!username || !userToken) {
            // console.log("Interaction tracking skipped: User not logged in.");
            return;
        }

        // Ensure itemId is a string for consistency before sending
        const finalItemId = String(itemId);

        console.log(`Tracking Interaction: User=${username}, Type=${interactionType}, ItemType=${itemType}, ItemID=${finalItemId}`); // Debug log

        const payload = {
          username: username,
          itemId: finalItemId,
          itemType: itemType,
          interactionType: interactionType,
          // Optionally include region from state if relevant for tracking context
          // region: currentUserRegion || DEFAULT_REGION
        };

        // Fire-and-forget fetch call
        fetch(`${domaindynamo}/track-interaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add Authorization header if your endpoint requires it
            // 'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(payload)
        })
        .then(response => {
            // We don't strictly need to check the response unless debugging
            if (!response.ok) {
                 // Log backend errors silently in console if needed
                 response.text().then(text => console.warn(`Interaction tracking failed: ${response.status}`, text));
            }
            // else { console.log("Interaction tracked successfully via API"); }
        })
        .catch(error => {
          // Avoid crashing the app on network errors for this background task
          console.warn("Network error tracking interaction:", error);
        });

      // Dependencies: username (to know who), userToken (to know if logged in), domaindynamo
      }, [username, userToken, domaindynamo]); // Add currentUserRegion if you include it in payload



  const fetchContent = useCallback(async (categoriesToFetch: string[], filter: string, page: number, isPaginating: boolean = false) => {
      const currentContentChoice = contentChoice.toLowerCase();
      // Exit if no categories are selected AND we are not in the 'trending' view
      if (categoriesToFetch.length === 0 && currentContentChoice !== 'trending') {
          console.log("[fetchContent] No categories/trending, clearing.");
          setArticlesAndTweets([]); setIsContentLoading(false); setIsLoadingMore(false); setHasMoreData(false); return;
      }

      // Log if username is missing when it might be needed for region fetching
      if (!username && (currentContentChoice === 'trending' || currentContentChoice === 'tweets' || currentContentChoice === 'all')) {
          console.warn(`[fetchContent] Username is null, proceeding without region filter.`);
      }

      // Cancel previous fetch if not paginating
      if (!isPaginating) { cancelOngoingFetch(); }
      const controller = new AbortController(); fetchControllerRef.current = controller;

      // Set loading states
      if (isPaginating) { setIsLoadingMore(true); }
      else { setIsContentLoading(true); setContentErrorMessage(''); if (page === 1) { setArticlesAndTweets([]); setHasMoreData(true); } }

      console.log(`[fetchContent] Fetching page ${page} for categories: [${categoriesToFetch.join(', ')}] | Filter: ${filter} | Choice: ${currentContentChoice} | Limit: ${PAGE_LIMIT}`);

      try {
        let fetchedItems: any[] = [];
        let region: string | null = null;

        // --- Attempt to fetch region IF username exists & needed ---
        if (username && (currentContentChoice === 'trending' || currentContentChoice === 'tweets' || currentContentChoice === 'all')) {
            // Make sure you are calling the CORRECT fetchRegion function here
            // (either standalone defined inside with useCallback, or the one integrated into fetchUsername if you kept that change)
            // Assuming standalone for now:
            region = await fetchRegion(username, domaindynamo);
            console.log("Region fetched by fetchContent:", region);
        }

        // --- Handle TRENDING content fetch ---
        if (currentContentChoice === 'trending') {
              const endpoint = `${domaindynamo}/get_trending_tweets`;
              const trendingPayloadObject: { page: number; limit: number; region?: string } = { page, limit: PAGE_LIMIT };
              if (region) { trendingPayloadObject.region = region; }
              const trendingBodyPayload = JSON.stringify(trendingPayloadObject);
              console.log("Trending Payload:", trendingBodyPayload);

              const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: trendingBodyPayload, signal: controller.signal });

              if (controller.signal.aborted) return;
              if (!response.ok) throw new Error(`Trending fetch HTTP error! status: ${response.status}`);
              const data = await response.json();

              if (data.status === 'Success' && Array.isArray(data.data)) {
                  // Use backend order directly
                  fetchedItems = data.data.map((t: any) => ({ type: 'tweet', dateTime: t.Created_At, ...t }));
                  setHasMoreData(data.data.length === PAGE_LIMIT);
              } else if (data.status === 'No tweets found' || (data.status === 'Success' && data.data.length === 0)) {
                  setHasMoreData(false); fetchedItems = [];
              } else { throw new Error(data.message || 'Failed to load trending tweets.'); }
        }
        // --- Handle CATEGORY/ALL content fetch ---
        else {
              const fetchArticles = currentContentChoice === 'articles' || (currentContentChoice === 'all' && filter !== 'Tweets');
              const fetchTweets = currentContentChoice === 'tweets' || (currentContentChoice === 'all' && filter !== 'Articles');
              const articleEndpoint = `${domaindynamo}/get-articles`;
              const tweetEndpoint = `${domaindynamo}/get-tweets`;
              const requests: Promise<Response>[] = [];

              // Prepare Payloads
              const articleBodyPayload = JSON.stringify({ categories: categoriesToFetch, page, limit: PAGE_LIMIT });
              const tweetPayloadObject: { categories: string[]; page: number; limit: number; region?: string } = { categories: categoriesToFetch, page, limit: PAGE_LIMIT };
              if (region) { tweetPayloadObject.region = region; }
              const tweetBodyPayload = JSON.stringify(tweetPayloadObject);
              console.log("Tweet Payload:", tweetBodyPayload);

              // Add fetch promises
              // *** IMPORTANT: Fetch TWEETS first if needed, then ARTICLES ***
              // This ensures tweets appear before articles when concatenated without sorting
              if (fetchTweets) { requests.push(fetch(tweetEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: tweetBodyPayload, signal: controller.signal })); }
              if (fetchArticles) { requests.push(fetch(articleEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: articleBodyPayload, signal: controller.signal })); }


              if (requests.length === 0) { setArticlesAndTweets([]); setHasMoreData(false); setIsContentLoading(false); setIsLoadingMore(false); return; }

              const responses = await Promise.all(requests);
              if (controller.signal.aborted) return;

              const results = await Promise.all(responses.map(res => { if (!res.ok) throw new Error(`Category/All fetch HTTP error! status: ${res.status}`); return res.json(); }));

              // Extract data respecting the fetch order
              let articles: any[] = []; let tweets: any[] = []; let resultIndex = 0; let articlesFound = 0; let tweetsFound = 0;
              // Check results based on the order promises were added
              if (fetchTweets) {
                  const d = results[resultIndex++];
                  if (d.status === 'Tweets found' && Array.isArray(d.data)) { tweets = d.data.map((t: any) => ({ type: 'tweet', dateTime: t.Created_At, ...t })); tweetsFound = d.data.length; }
                  else if (d.status !== 'No tweets found') { console.warn('Tweet fetch issue:', d.message || d.status); }
              }
               if (fetchArticles) {
                  const d = results[resultIndex++];
                  if (d.status === 'Articles found' && Array.isArray(d.data)) { articles = d.data.map((a: any) => ({ type: 'article', dateTime: a.date, ...a })); articlesFound = d.data.length; }
                  else if (d.status !== 'No articles found') { console.warn('Article fetch issue:', d.message || d.status); }
              }


              // *** MODIFIED COMBINATION: Concatenate WITHOUT re-sorting by date ***
              if (fetchArticles && fetchTweets) {
                  // Combine tweets first (respecting their backend order), then articles (respecting their backend order)
                  fetchedItems = [...tweets, ...articles];
                  console.log("[fetchContent] Combined Tweets and Articles WITHOUT re-sorting by date.");
              } else if (fetchTweets) {
                  // If ONLY tweets were fetched, use backend order
                  fetchedItems = tweets;
                  console.log("[fetchContent] Using backend sort order for Tweets only.");
              } else if (fetchArticles) {
                  // If ONLY articles were fetched, use backend order (assumed date)
                  fetchedItems = articles;
                   console.log("[fetchContent] Using backend sort order for Articles only.");
              } else {
                  fetchedItems = [];
              }
              // *** REMOVED the combined.sort(...) line ***
              // *** END OF MODIFIED COMBINATION LOGIC ***

              // Determine if more data might exist
              setHasMoreData(articlesFound === PAGE_LIMIT || tweetsFound === PAGE_LIMIT);
        }

        // --- Update State with Fetched Items ---
        if (!controller.signal.aborted) {
            if (page === 1) {
                setArticlesAndTweets(fetchedItems);
            } else {
                setArticlesAndTweets(prev => {
                    const existingIds = new Set(prev.map(item => item.id || item.Tweet_Link));
                    const newUniqueItems = fetchedItems.filter(item => !existingIds.has(item.id || item.Tweet_Link));
                    const combined = [...prev, ...newUniqueItems];
                    console.log(`[fetchContent] Pruning list. Current: ${prev.length}, New: ${newUniqueItems.length}, Combined: ${combined.length}, Keeping: ${Math.min(combined.length, MAX_ITEMS_TO_KEEP)}`);
                    return combined.slice(-MAX_ITEMS_TO_KEEP);
                });
            }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('[FetchContent] Error:', error);
          if (!controller.signal?.aborted) { setContentErrorMessage(error.message || 'Failed to load content.'); if (page === 1) setArticlesAndTweets([]); }
        } else { console.log("[FetchContent] Aborted."); }
      } finally {
        if (!controller.signal?.aborted) { setIsContentLoading(false); setIsLoadingMore(false); }
      }
    // Ensure correct dependencies. Add fetchRegion if defined outside component scope.
    }, [contentChoice, domaindynamo, username, PAGE_LIMIT, MAX_ITEMS_TO_KEEP]); // Added fetchRegion dependency assuming it's needed

  const handleSearchQuery = useCallback(async (query: string, page: number, isPaginating: boolean = false) => {
      const trimmedQuery = query.trim();
      if (trimmedQuery === '') {
          if (!isPaginating) { cancelOngoingFetch(); setIsSearchLoading(false); setCurrentPage(1); setHasMoreData(true); let categoriesToFetch: string[] = []; if (typeof activeSubcategory === 'string') { categoriesToFetch = [activeSubcategory]; } else if (Array.isArray(activeSubcategory)) { categoriesToFetch = activeSubcategory; } else if (activeMainCategory) { categoriesToFetch = getPreferencesForMainCategory(activeMainCategory).filter(sub => userPreferences.includes(sub)); } const controller = new AbortController(); fetchControllerRef.current = controller;
          let region: string | null = null; // Variable to store fetched region

          // --- Attempt to fetch region IF username exists ---
          if (username) {
              // *** Pass domaindynamo as the second argument ***
              // Ensure fetchRegion function is defined and accessible here
              region = await fetchRegion(username, domaindynamo);
              console.log("Region fetched by fetchContent:", region); // Log fetched region or null
          } else {
              console.warn(`[fetchContent] Username is null, proceeding without region filter.`);
          }
          if (contentChoice.toLowerCase() === 'trending' || categoriesToFetch.length > 0) { fetchContent(categoriesToFetch, selectedFilter, 1, false); } else { setArticlesAndTweets([]); setHasMoreData(false); } }
          return;
      }
      if (!isPaginating) { cancelOngoingFetch(); setCurrentPage(1); setHasMoreData(true); setArticlesAndTweets([]); }
      const controller = new AbortController(); fetchControllerRef.current = controller;
      if (isPaginating) { setIsLoadingMore(true); } else { setIsContentLoading(true); setIsSearchLoading(true); setContentErrorMessage(''); }
      const searchEndpoint = `${domaindynamo}/search_content`;
      console.log(`[handleSearchQuery] Fetching page ${page} for query: '${trimmedQuery}' | Limit: ${PAGE_LIMIT}`);
      try {
        const response = await fetch(searchEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ searchQuery: trimmedQuery, page: page, limit: PAGE_LIMIT }), signal: controller.signal });
         if (controller.signal.aborted) return; if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json(); console.log(`[handleSearchQuery] Raw search response page ${page}:`, data);
        if (data.status === 'Success' && Array.isArray(data.data)) {
          const detailedContentPromises = data.data.map(async (item: any, index: number) => {
              if (controller.signal.aborted) return null;
              try {
                  if (item.type === 'tweet' && item.id) { const detailEndpoint = `${domaindynamo}/get-tweet-by-link`; const tweetResponse = await fetch(detailEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: item.id }), signal: controller.signal }); if (controller.signal.aborted) return null; if (!tweetResponse.ok) throw new Error(`Tweet detail fetch failed: ${tweetResponse.status}`); const tweetData = await tweetResponse.json(); return tweetData.data ? { ...item, ...tweetData.data, dateTime: tweetData.data?.Created_At || item.Created_At, type: 'tweet' } : null; }
                  else if (item.type === 'article' && item.id) { const detailEndpoint = `${domaindynamo}/get-article-by-id`; const articleResponse = await fetch(detailEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }), signal: controller.signal }); if (controller.signal.aborted) return null; if (!articleResponse.ok) throw new Error(`Article detail fetch failed: ${articleResponse.status}`); const articleData = await articleResponse.json(); return articleData.data ? { ...item, ...articleData.data, dateTime: articleData.data?.date || item.date, type: 'article' } : null; }
                  else { console.warn(`[SearchDetail] Skipping item ${index}:`, item); }
              } catch (itemError) { console.error(`[SearchDetail] Error for item ${index}:`, itemError); return null; } return null;
            });
          const detailedContent = await Promise.all(detailedContentPromises); const finalFilteredContent = detailedContent.filter(item => item !== null);
           if (!controller.signal.aborted) {
               if (page === 1) {
                   setArticlesAndTweets(finalFilteredContent);
               } else {
                   // *** IMPLEMENT DATA PRUNING ***
                   setArticlesAndTweets(prev => {
                       const existingIds = new Set(prev.map(item => item.id || item.Tweet_Link));
                       const newUniqueItems = finalFilteredContent.filter(item => !existingIds.has(item.id || item.Tweet_Link));
                       const combined = [...prev, ...newUniqueItems];
                       console.log(`[handleSearchQuery] Pruning list. Current: ${prev.length}, New: ${newUniqueItems.length}, Combined: ${combined.length}, Keeping: ${Math.min(combined.length, MAX_ITEMS_TO_KEEP)}`);
                       return combined.slice(-MAX_ITEMS_TO_KEEP);
                   });
               }
               setHasMoreData(data.data.length === PAGE_LIMIT);
            }
        } else { if (!controller.signal.aborted) { if (page === 1) setArticlesAndTweets([]); setHasMoreData(false); if (data.status !== 'No results found') { console.warn('[handleSearchQuery] Search issue:', data.message || data.status); } } }
      } catch (error: any) { if (error.name !== 'AbortError') { console.error('[handleSearchQuery] Error searching content:', error); if (!controller.signal.aborted) { setContentErrorMessage(error.message || 'Failed to load search results.'); if (page === 1) setArticlesAndTweets([]); setHasMoreData(false); } } else { console.log("[handleSearchQuery] Search aborted"); } }
      finally { if (!controller.signal.aborted) { setIsContentLoading(false); setIsLoadingMore(false); if (!isPaginating) { setIsSearchLoading(false); } } }
  }, [domaindynamo, activeMainCategory, activeSubcategory, selectedFilter, fetchContent, contentChoice, userPreferences]);

  // --- Category & Filter Setup Effects ---
  useEffect(() => {
    const relevantMainCategories = displayMainCategories.filter(mainCat => getPreferencesForMainCategory(mainCat).some(pref => userPreferences.includes(pref)));
    const orderedRelevantMainCategories = displayMainCategories.filter(cat => relevantMainCategories.includes(cat));
    setMainDisplayCategories(prev => !areArraysEqual(prev, orderedRelevantMainCategories) ? orderedRelevantMainCategories : prev);
    const currentActiveMain = activeMainCategory;
    const newActiveMain = orderedRelevantMainCategories.includes(currentActiveMain) ? currentActiveMain : (orderedRelevantMainCategories[0] || '');
    if (newActiveMain !== currentActiveMain || !activeMainCategory) {
        console.log(`[Effect userPreferences] Setting active main category to: ${newActiveMain}`);
        setActiveMainCategory(newActiveMain); setActiveSubcategory(null); const subs = getPreferencesForMainCategory(newActiveMain); setCurrentSubcategories(subs); setCurrentPage(1); setHasMoreData(true);
    } else { setCurrentSubcategories(getPreferencesForMainCategory(currentActiveMain)); }
  }, [userPreferences, activeMainCategory]);

  useEffect(() => {
      const subs = getPreferencesForMainCategory(activeMainCategory);
      setCurrentSubcategories(prevSubs => !areArraysEqual(prevSubs, subs) ? subs : prevSubs);
      if (typeof activeSubcategory === 'string' && !subs.includes(activeSubcategory)) {
          console.log(`[Effect activeMainCategory] Resetting activeSubcategory because ${activeSubcategory} is not in ${activeMainCategory}`);
          setActiveSubcategory(null);
      }
      else if (Array.isArray(activeSubcategory)) {
          const relevantPreferredSubs = subs.filter(sub => userPreferences.includes(sub));
          if (!areArraysEqual(activeSubcategory, relevantPreferredSubs)) {
              console.log(`[Effect activeMainCategory] Updating activeSubcategory array for new main category ${activeMainCategory}`);
              setActiveSubcategory(relevantPreferredSubs);
          }
      }
  }, [activeMainCategory, userPreferences, activeSubcategory]);


  // --- Data Fetch Trigger Effect ---
  useEffect(() => {
    if (pageLoading) { console.log(`[Effect Trigger] Skipping fetch: pageLoading=${pageLoading}`); return; }
    cancelOngoingFetch();
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    console.log(`[Effect Trigger] Resetting page to 1 and clearing data due to dependency change.`);
    setCurrentPage(1);
    setHasMoreData(true);
    setArticlesAndTweets([]); // Clear existing data before new fetch
    const trimmedQuery = searchQuery.trim();
    const currentContentChoice = contentChoice.toLowerCase();
    if (trimmedQuery !== '') {
        console.log(`[Effect Trigger] Triggering handleSearchQuery (Page 1) for: '${trimmedQuery}'`);
        handleSearchQuery(trimmedQuery, 1, false);
    } else {
        let categoriesToFetch: string[] = [];
        if (currentContentChoice === 'trending') {
            console.log(`[Effect Trigger] Fetching trending content (Page 1).`);
        } else if (typeof activeSubcategory === 'string') {
            console.log(`[Effect Trigger] Fetching specific subcategory (Page 1): ${activeSubcategory}`);
            categoriesToFetch = [activeSubcategory];
        } else if (activeMainCategory) {
             const allSubsForMain = getPreferencesForMainCategory(activeMainCategory);
             const relevantPreferredSubs = allSubsForMain.filter(sub => userPreferences.includes(sub));
             if (!Array.isArray(activeSubcategory) || !areArraysEqual(activeSubcategory, relevantPreferredSubs)) {
                 setActiveSubcategory(relevantPreferredSubs); // Update state if needed
             }
             categoriesToFetch = relevantPreferredSubs;
             console.log(`[Effect Trigger] Fetching ALL preferred subcategories in ${activeMainCategory} (Page 1): [${categoriesToFetch.join(', ')}]`);
        } else {
            console.log(`[Effect Trigger] No valid category/subcategory state for fetching (Page 1).`);
        }
        if (currentContentChoice === 'trending' || categoriesToFetch.length > 0) {
            fetchContent(categoriesToFetch, selectedFilter, 1, false);
        } else if (currentContentChoice !== 'trending') {
            console.log(`[Effect Trigger] Clearing content because no categories determined (Page 1).`);
            setArticlesAndTweets([]); setHasMoreData(false); setIsContentLoading(false);
        }
    }
    return () => {
        console.log(`[Effect Trigger Cleanup] Aborting controller.`);
        controller.abort();
        setIsSearchLoading(false);
    };
  }, [ activeMainCategory, activeSubcategory, selectedFilter, contentChoice, searchQuery, pageLoading, userPreferences, fetchContent, handleSearchQuery ]);


  // --- Callback Handlers ---
  const handleTweetPress = useCallback((item: any) => { if (!userToken) { showLoginMessage(); return; } if (item && item.Tweet_Link) { setSelectedTweetLink(item.Tweet_Link); setTweetModalVisible(true); trackInteraction(item.Tweet_Link, 'tweet', 'view');} else { console.warn("Tweet item/link missing", item); showLoginMessage("Could not open tweet details.", 'error'); } }, [userToken, showLoginMessage, trackInteraction]);
  const handleArticlePress = useCallback((item: any) => { if (!userToken) { showLoginMessage(); return; } if (item && item.id) { setSelectedArticleId(item.id); setModalVisible(true); } else { console.warn("Article item/ID missing", item); showLoginMessage("Could not open article details.", 'error'); } }, [userToken, showLoginMessage]);
  const handleCategorySelect = useCallback((mainCategory: string) => { if (mainCategory !== activeMainCategory) { setActiveMainCategory(mainCategory); setActiveSubcategory(null); setContentChoice('all'); setSelectedFilter('All'); setSearchQuery(''); if (flashListRef.current) { flashListRef.current.scrollToOffset({ offset: 0, animated: false }); } } }, [activeMainCategory, setContentChoice]);
  const handleSubcategorySelect = useCallback((selection: string | string[] | null) => {
      let isDifferent = true;
      if (Array.isArray(selection) && Array.isArray(activeSubcategory)) { isDifferent = !areArraysEqual(selection, activeSubcategory); }
      else { isDifferent = selection !== activeSubcategory; }
      if (isDifferent) {
          setActiveSubcategory(selection);
          setSearchQuery('');
          if (flashListRef.current) { flashListRef.current.scrollToOffset({ offset: 0, animated: false }); }
      }
  }, [activeSubcategory]);
  const handleFilterSelect = useCallback((filter: string) => { if (contentChoice.toLowerCase() === 'all' && filter !== selectedFilter) { setSelectedFilter(filter); if (flashListRef.current) { flashListRef.current.scrollToOffset({ offset: 0, animated: false }); } } }, [contentChoice, selectedFilter]);
  const handleSearchChange = useCallback((query: string) => { setSearchQuery(query); setIsSearchLoading(true); if (searchDebounceTimeout.current) { clearTimeout(searchDebounceTimeout.current); } searchDebounceTimeout.current = setTimeout(() => { setIsSearchLoading(false); }, 500); }, []);
  // Note: onScroll prop might behave differently with FlashList, keep simple for now
  // const handleScroll = useCallback(Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false }), [scrollY]);
  const handleScroll = () => {}; // Placeholder if Animated.event causes issues with FlashList
  const handleScrollToTop = useCallback(() => { if (flashListRef.current) { flashListRef.current.scrollToOffset({ offset: 0, animated: true }); } }, []);
  useEffect(() => { setScrollToTop(() => handleScrollToTop); return () => setScrollToTop(() => () => {}); }, [setScrollToTop, handleScrollToTop]);

  // --- Pagination Handler ---
  const loadMoreContent = useCallback(() => {
      if (isLoadingMore || !hasMoreData || isContentLoading || pageLoading) { return; }
      console.log(`[loadMoreContent] Attempting to load page ${currentPage + 1}`);
      const nextPage = currentPage + 1;
      const trimmedQuery = searchQuery.trim();
      const currentContentChoice = contentChoice.toLowerCase();
      let categoriesToFetch: string[] = [];
      if (trimmedQuery !== '') {
          handleSearchQuery(trimmedQuery, nextPage, true);
      } else {
          if (currentContentChoice === 'trending') { categoriesToFetch = []; }
          else if (typeof activeSubcategory === 'string') { categoriesToFetch = [activeSubcategory]; }
          else if (Array.isArray(activeSubcategory)) { categoriesToFetch = activeSubcategory; }
          else if (activeMainCategory) { const allSubsForMain = getPreferencesForMainCategory(activeMainCategory); categoriesToFetch = allSubsForMain.filter(sub => userPreferences.includes(sub)); }
          if (currentContentChoice === 'trending' || categoriesToFetch.length > 0) {
              setCurrentPage(nextPage);
              fetchContent(categoriesToFetch, selectedFilter, nextPage, true);
          } else { console.log("[loadMoreContent] No categories to fetch for pagination."); setHasMoreData(false); }
      }
  }, [isLoadingMore, hasMoreData, isContentLoading, pageLoading, currentPage, searchQuery, contentChoice, activeSubcategory, activeMainCategory, userPreferences, selectedFilter, handleSearchQuery, fetchContent]);


  // --- Render Item function ---
  const renderContentCard = useCallback(({ item }: { item: any }) => {
      if (!item || !item.type) return null;
      if (item.type === 'tweet' && !item.Tweet_Link) return null;
      if (item.type === 'article' && !item.id) return null;
      if (item.type === 'tweet') return <MemoizedTweetCard item={item} onPress={handleTweetPress} />;
      if (item.type === 'article') return <MemoizedArticleCard item={item} onPress={handleArticlePress} />;
      return null;
    }, [handleTweetPress, handleArticlePress]);

  // --- Render Header Component ---
  const renderHeader = useCallback(
    () => (
      <HeaderTabs
        categories={mainDisplayCategories} activeCategory={activeMainCategory} onCategorySelect={handleCategorySelect}
        subcategories={currentSubcategories} activeSubcategory={activeSubcategory} onSubcategorySelect={handleSubcategorySelect}
        allUserPreferences={userPreferences} activeFilter={selectedFilter} onFilterSelect={handleFilterSelect}
        username={username} profilePictureUrl={profilePictureUrl || undefined}
        onSettingsPress={() => { if (!userToken) { showLoginMessage(); return; } router.push('/settings'); }}
        onLoginPress={login} onSearch={handleSearchChange} isLoggedIn={!!userToken}
        searchQuery={searchQuery} isLoading={loadingLogin}
        isTrendingActive={contentChoice.toLowerCase() === 'trending'} isSearchLoading={isSearchLoading}
      />
    ),
    [ mainDisplayCategories, activeMainCategory, handleCategorySelect, currentSubcategories, activeSubcategory, handleSubcategorySelect, userPreferences, selectedFilter, handleFilterSelect, username, profilePictureUrl, userToken, showLoginMessage, router, login, loadingLogin, handleSearchChange, searchQuery, contentChoice, isSearchLoading, ]
  );

  // --- Render Footer for Pagination Loading ---
  const renderFooter = () => {
      if (!isLoadingMore) return null;
      return ( <View style={dynamicStyles.footerLoading}> <ActivityIndicator size="small" color={isDarkTheme ? '#9067C6' : '#007AFF'} /> </View> );
  };

  // --- Theme and Styles ---
  const dynamicStyles = getStyles(isDarkTheme);
  const themeStatusBar = isDarkTheme ? 'light-content' : 'dark-content';
  const themeBackgroundColor = isDarkTheme ? '#0A0A0A' : '#F8F9FA';

  // --- Retry function ---
  const handleRetryFetch = useCallback(() => {
      setContentErrorMessage('');
      setCurrentPage(1);
      setHasMoreData(true);
      const trimmedQuery = searchQuery.trim();
      const currentContentChoice = contentChoice.toLowerCase();
      let categoriesToFetch: string[] = [];
       if (trimmedQuery !== '') { handleSearchQuery(trimmedQuery, 1, false); return; }
       else if (currentContentChoice === 'trending') { categoriesToFetch = []; }
       else if (typeof activeSubcategory === 'string') { categoriesToFetch = [activeSubcategory]; }
       else if (Array.isArray(activeSubcategory)) { categoriesToFetch = activeSubcategory; }
       else if (activeSubcategory === null && activeMainCategory) { categoriesToFetch = getPreferencesForMainCategory(activeMainCategory).filter(sub => userPreferences.includes(sub)); }
      if (currentContentChoice === 'trending' || categoriesToFetch.length > 0) {
          fetchContent(categoriesToFetch, selectedFilter, 1, false);
      } else {
          setArticlesAndTweets([]); setHasMoreData(false); setIsContentLoading(false);
      }
  }, [searchQuery, contentChoice, activeMainCategory, activeSubcategory, selectedFilter, userPreferences, handleSearchQuery, fetchContent]);

  // --- Key Extractor ---
  const keyExtractor = useCallback((item: any, index: number) => {
      // Prefix key with type for guaranteed uniqueness across articles/tweets
      return `${item?.type || 'item'}-${item?.id || item?.Tweet_Link || `index-${index}`}`;
  }, []);

  // --- Initial Loading State ---
  if (pageLoading) {
      return ( <SafeAreaView style={[dynamicStyles.loadingContainer, { backgroundColor: themeBackgroundColor }]}> <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} /> <ActivityIndicator size="large" color={isDarkTheme ? '#9067C6' : '#007AFF'} /> <Text style={dynamicStyles.loadingText}>Loading your feed...</Text> </SafeAreaView> );
  }

  // --- Main Render ---
  return (
    <SafeAreaView style={[dynamicStyles.container, { backgroundColor: themeBackgroundColor }]}>
      <StatusBar barStyle={themeStatusBar} backgroundColor={themeBackgroundColor} />
      {/* Render HeaderTabs directly - FlashList doesn't have ListHeaderComponent */}
      {renderHeader()}
      {/* *** Use FlashList *** */}
      <FlashList
        ref={flashListRef}
        data={articlesAndTweets}
        renderItem={renderContentCard}
        keyExtractor={keyExtractor}
        // *** Add estimatedItemSize (CRUCIAL) ***
        estimatedItemSize={ESTIMATED_ITEM_HEIGHT} // Adjust this value based on your average item height!
        // Pagination Props
        onEndReached={loadMoreContent}
        onEndReachedThreshold={0.8} // Can keep threshold
        ListFooterComponent={renderFooter}
        // Empty/Error State
        ListEmptyComponent={
          isContentLoading ? ( <View style={dynamicStyles.listFeedbackContainer}><ActivityIndicator size="large" color={isDarkTheme ? '#9067C6' : '#007AFF'} /></View> )
          : ( <View style={dynamicStyles.listFeedbackContainer}>
              <Icon name={contentErrorMessage ? "cloud-offline-outline" : "file-tray-outline"} size={60} color={isDarkTheme ? '#555' : '#AAA'} />
              <Text style={dynamicStyles.emptyText}>
                {contentErrorMessage ? contentErrorMessage
                  : searchQuery ? 'No results found for your search.'
                  : contentChoice.toLowerCase() === 'trending' ? 'No trending content available right now.'
                  : activeMainCategory ? (Array.isArray(activeSubcategory) || activeSubcategory === null) ? `No content found for your preferred subcategories in ${activeMainCategory}.` : `No content available for ${activeSubcategory}.`
                  : 'Select a category or try searching.' }
              </Text>
              {contentErrorMessage && ( <TouchableOpacity onPress={handleRetryFetch} style={dynamicStyles.retryButton}><Text style={dynamicStyles.retryButtonText}>Try Again</Text></TouchableOpacity> )}
            </View> )
        }
        // Other props (Keep contentContainerStyle, consider removing scrollEventThrottle if not needed)
        contentContainerStyle={dynamicStyles.listContentContainer}
        // onScroll={handleScroll} // Keep if needed for scroll animations, otherwise remove
        // scrollEventThrottle={16} // Less critical for FlashList performance
        // Props removed: getItemLayout, removeClippedSubviews, windowSize, initialNumToRender, maxToRenderPerBatch (less critical)
      />
      {/* Modals */}
      <Suspense fallback={<View style={StyleSheet.absoluteFillObject} pointerEvents="none" />}>
        <ArticleModal visible={modalVisible} onClose={() => setModalVisible(false)} articleId={selectedArticleId} />
        <TweetModal visible={tweetModalVisible} onClose={() => setTweetModalVisible(false)} tweetLink={selectedTweetLink} />
      </Suspense>
      {/* Bottom Navigation */}
      <ChronicallyButton
        onHomePress={() => { const firstDisplayCategory = mainDisplayCategories[0] || ''; if (contentChoice !== 'all' || activeMainCategory !== firstDisplayCategory || activeSubcategory !== null) { setContentChoice('all'); setActiveMainCategory(firstDisplayCategory); setActiveSubcategory(null); setSearchQuery(''); setSelectedFilter('All'); } else { handleScrollToTop(); } }}
        onTrendingPress={() => { if (contentChoice !== 'trending') { setContentChoice('trending'); setActiveMainCategory(''); setActiveSubcategory(null); setSearchQuery(''); setSelectedFilter('All'); } else { handleScrollToTop(); } }}
        onBookmarkPress={!userToken ? showLoginMessage : () => router.push('/savedarticles')}
        onFeedPress={!userToken ? showLoginMessage : () => router.push('/repostfeed')}
        onFriendsPress={!userToken ? showLoginMessage : () => router.push('/followingpage')}
        onArrowPress={handleScrollToTop}
        activeTab={ pathname === '/repostfeed' ? 'feed' : pathname === '/followingpage' ? 'friends' : pathname === '/savedarticles' ? 'saved' : contentChoice.toLowerCase() === 'trending' ? 'trending' : 'home' }
        isDarkTheme={isDarkTheme}
      />
      {/* In-App Message Banner */}
      <InAppMessage visible={messageVisible} message={messageText} type={messageType} onClose={() => setMessageVisible(false)} />
    </SafeAreaView>
  );
};

// --- Styling ---
const getStyles = (isDarkTheme: boolean) => {
    const colors = {
        background: isDarkTheme ? '#0A0A0A' : '#F8F9FA', card: isDarkTheme ? '#1A1A1A' : '#FFFFFF', text: isDarkTheme ? '#EAEAEA' : '#1C1C1E', textSecondary: isDarkTheme ? '#A0A0A0' : '#6C6C6E', accent: isDarkTheme ? '#9067C6' : '#007AFF', border: isDarkTheme ? '#2C2C2E' : '#E5E5E5', error: isDarkTheme ? '#FF6B6B' : '#D93025', buttonText: '#FFFFFF', buttonBackground: isDarkTheme ? '#3A3A3C' : '#007AFF', retryButtonText: isDarkTheme ? '#9067C6' : '#007AFF',
     };
    return StyleSheet.create({
        container: { flex: 1 },
        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        loadingText: { marginTop: 15, fontSize: 16, color: colors.textSecondary },
        listContentContainer: { paddingHorizontal: 0, paddingTop: 10, paddingBottom: 100 }, // Ensure paddingBottom is sufficient
        listFeedbackContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50, minHeight: 300, paddingHorizontal: 20 },
        emptyText: { marginTop: 15, color: colors.textSecondary, fontSize: 16, textAlign: 'center', paddingHorizontal: 30 },
        retryButton: { marginTop: 20, paddingHorizontal: 25, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.retryButtonText },
        retryButtonText: { color: colors.retryButtonText, fontSize: 15, fontWeight: '600' },
        seeAllButton: { backgroundColor: colors.buttonBackground, paddingVertical: 14, marginVertical: 20, borderRadius: 25, alignItems: 'center', marginHorizontal: 40, flexDirection: 'row', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4 },
        seeAllButtonText: { color: colors.buttonText, fontSize: 16, fontWeight: '600' },
        footerLoading: { paddingVertical: 20, alignItems: 'center' },
     });
};

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error: error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error('ErrorBoundary caught an error:', error, errorInfo); }
  render() { if (this.state.hasError) { const styles = getStyles(false); return ( <SafeAreaView style={[styles.loadingContainer, { backgroundColor: '#F8F9FA' }]}> <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" /> <Icon name="alert-circle-outline" size={60} color="#D93025" /> <Text style={{ fontSize: 18, color: '#1C1C1E', marginTop: 15, textAlign: 'center', paddingHorizontal: 20 }}> Oops! Something went wrong. </Text> <Text style={{ fontSize: 14, color: '#6C6C6E', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 }}> Please try restarting the app. {__DEV__ && this.state.error && `\n\n${this.state.error.toString()}`} </Text> </SafeAreaView> ); } return this.props.children; }
}

// --- Final Export ---
export default function App() {
  return (
    <ErrorBoundary>
      <Index />
    </ErrorBoundary>
  );
}
