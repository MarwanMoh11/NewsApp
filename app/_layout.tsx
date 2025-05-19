// app/Layout.tsx (Simplified Navigation + Hooks Fixed)

import React, { useContext, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
// Import useGlobalSearchParams for reliable param reading in Layout
import { Slot, usePathname, useRouter, useGlobalSearchParams } from 'expo-router';
import { UserProvider, UserContext } from './UserContext'; // Adjust path if needed
import { ScrollProvider, ScrollContext } from './ScrollContext'; // Adjust path if needed
import ChronicallyButton from '../components/ui/ChronicallyButton'; // Adjust path if needed
import InAppMessage from '../components/ui/InAppMessage'; // Adjust path if needed

export default function Layout() {
  // State for In-App Message (remains the same)
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  // Function to show the message (remains the same)
  const showLoginMessage = useCallback(() => {
    setMessageText("Please log in to access this feature.");
    setMessageType('info');
    setMessageVisible(true);
  }, []);

  return (
    <UserProvider>
      <ScrollProvider>
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Renders the current matching route */}
            <Slot />
          </View>
          {/* Persistent Bottom Bar only renders if allowed by its internal logic */}
          <PersistentBottomBar showLoginMessage={showLoginMessage} />
        </View>
        {/* In-App Message overlay */}
        <InAppMessage
            visible={messageVisible}
            message={messageText}
            type={messageType}
            onClose={() => setMessageVisible(false)}
        />
      </ScrollProvider>
    </UserProvider>
  );
}

// --- Props for PersistentBottomBar ---
interface PersistentBottomBarProps {
    showLoginMessage: () => void;
}

/**
 * PersistentBottomBar: Renders the bottom navigation, handles active state,
 * and controls its own visibility based on allowed routes.
 */
function PersistentBottomBar({ showLoginMessage }: PersistentBottomBarProps) {
  // --- Hooks (Called Unconditionally at Top) ---
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ feed?: string }>(); // Use global params
  const { isDarkTheme, userToken } = useContext(UserContext);
  const { scrollToTop } = useContext(ScrollContext);

  // State to track the intended active tab ('home' or 'trending') specifically for the '/' route
  const [homeScreenTab, setHomeScreenTab] = useState<'home' | 'trending'>('home');

  // Effect to synchronize internal state ('home'/'trending') with URL parameters
  // This handles initial load based on URL and external navigation changes.
  useEffect(() => {
    let targetTab: 'home' | 'trending' = 'home'; // Default to home
    // Only check params if we are on the root path
    if (pathname === '/' && params.feed === 'trending') {
      targetTab = 'trending';
    }

    // Update the internal state only if it differs from what the URL suggests for the '/' path
    if (pathname === '/' && targetTab !== homeScreenTab) {
        console.log(`[Layout Effect] Syncing homeScreenTab state from param. Param: ${params.feed}, Setting state to: ${targetTab}`);
        setHomeScreenTab(targetTab);
    }
    // Note: If navigating away from '/', homeScreenTab retains its last value,
    // but the `activeTab` calculation below will prioritize pathname for other routes.
  }, [pathname, params.feed, homeScreenTab]); // Dependencies for the sync effect


  // --- VISIBILITY CHECK (Performed AFTER Hooks) ---
  // Define paths where the bottom bar should be visible
  const allowedPaths = ['/', '/savedarticles', '/myprofile', '/explore']; // Updated list with explore
  console.log(`[PersistentBottomBar] Checking visibility for pathname: "${pathname}"`);

  // Check if the exact path is allowed OR if it starts with an allowed path (e.g., /myprofile/edit)
  const isAllowed = allowedPaths.includes(pathname) ||
                    allowedPaths.some(allowedPath => allowedPath !== '/' && pathname.startsWith(allowedPath));

  if (!isAllowed) {
    console.log(`[PersistentBottomBar] Pathname "${pathname}" NOT allowed. Hiding button.`);
    return null; // Hide the button if the path is not allowed
  }
  console.log(`[PersistentBottomBar] Pathname "${pathname}" IS allowed. Rendering button.`);
  // --- END VISIBILITY CHECK ---


  // --- Determine activeTab prop for ChronicallyButton ---
  // Updated type definition
  let activeTab: 'home' | 'trending' | 'saved' | 'explore' | 'profile';

  if (pathname.startsWith('/savedarticles')) {
    activeTab = 'saved';
  } else if (pathname.startsWith('/myprofile')) { // Check for profile path
    activeTab = 'profile';
  } else if (pathname.startsWith('/explore')) { // Check for explore path
    activeTab = 'explore';
  } else if (pathname === '/') {
    activeTab = homeScreenTab; // Use internal state for '/' route highlighting
  } else {
    activeTab = 'home'; // Fallback for any unexpected allowed paths
  }

  console.log(`[PersistentBottomBar] Rendering button. Path: ${pathname}, Param Feed: ${params.feed}, State Tab: ${homeScreenTab}, Determined activeTab Prop: ${activeTab}`);

  // --- Handlers (Updated) ---
  const handleHomePress = () => {
    console.log("handleHomePress called");
    setHomeScreenTab('home'); // Update internal state
    router.push({ pathname: '/', params: { feed: 'forYou' } }); // Navigate & set param
  };

  const handleTrendingPress = () => {
    console.log("handleTrendingPress called");
    setHomeScreenTab('trending'); // Update internal state
    router.push({ pathname: '/', params: { feed: 'trending' } }); // Navigate & set param
  };

  const handleBookmarkPress = () => {
    if (!userToken) { showLoginMessage(); } else { router.push('/savedarticles'); }
  };

  // New handler for Explore
  const handleExplorePress = () => {
    router.push('/explore'); // Navigate to explore page
  };

  // Handler for Profile
  const handleProfilePress = () => {
    if (!userToken) {
      showLoginMessage();
    } else {
      router.push('/myprofile'); // Navigate to profile page
    }
  };

  // Arrow press scrolls based on activeTab matching the current view state
  const handleArrowPress = () => {
      console.log(`handleArrowPress called, checking if truly active for determined tab: ${activeTab}`);
      // Check if the ACTIVE BUTTON state matches the current route/view state
      const isTrulyActive =
          (activeTab === 'home' && pathname === '/' && homeScreenTab === 'home') ||
          (activeTab === 'trending' && pathname === '/' && homeScreenTab === 'trending') ||
          (activeTab === 'saved' && pathname.startsWith('/savedarticles')) || // Use startsWith for robustness
          (activeTab === 'explore' && pathname.startsWith('/explore')) || // Added explore case
          (activeTab === 'profile' && pathname.startsWith('/myprofile')); // Use startsWith for robustness

      if (isTrulyActive) {
          console.log("--> Scrolling to top");
          scrollToTop();
      } else {
           console.log("--> Tab not truly active for scroll, performing navigation fallback");
           // Updated switch statement
          switch(activeTab) {
              case 'home': handleHomePress(); break;
              case 'trending': handleTrendingPress(); break;
              case 'saved': handleBookmarkPress(); break;
              case 'explore': handleExplorePress(); break; // Added explore case
              case 'profile': handleProfilePress(); break; // Added profile case
          }
      }
  };

  // Render ChronicallyButton only if path was allowed
  return (
    <ChronicallyButton
      onHomePress={handleHomePress}
      onTrendingPress={handleTrendingPress}
      onBookmarkPress={handleBookmarkPress}
      onExplorePress={handleExplorePress} // Pass explore handler
      onProfilePress={handleProfilePress} // Pass profile handler
      onArrowPress={handleArrowPress}
      activeTab={activeTab} // Pass the correctly determined activeTab
      isDarkTheme={isDarkTheme}
    />
  );
}

// Styles (Unchanged)
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
