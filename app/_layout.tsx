// app/Layout.tsx
import React, { useContext, useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { UserProvider, UserContext } from './UserContext';
import { ContentChoiceProvider, ContentChoiceContext } from './contentchoice';
import { ScrollProvider, ScrollContext } from './ScrollContext';
import ChronicallyButton from '../components/ui/ChronicallyButton'; // Adjust path if needed
import InAppMessage from '../components/ui/InAppMessage';

export default function Layout() {
  // State for In-App Message
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'error' | 'success'>('info');

  // Function to show the message (defined here to access state)
  const showLoginMessage = useCallback(() => {
    setMessageText("Please log in to access this feature.");
    setMessageType('info');
    setMessageVisible(true);
  }, []); // No dependencies needed

  return (
    <UserProvider>
      <ContentChoiceProvider>
        <ScrollProvider>
          <View style={styles.container}>
            <View style={styles.content}>
              <Slot />
            </View>
            {/* Pass showLoginMessage down as a prop */}
            <PersistentBottomBar showLoginMessage={showLoginMessage} />
          </View>
          {/* Render InAppMessage overlay here */}
          <InAppMessage
              visible={messageVisible}
              message={messageText}
              type={messageType}
              onClose={() => setMessageVisible(false)}
          />
        </ScrollProvider>
      </ContentChoiceProvider>
    </UserProvider>
  );
}

// --- Props for PersistentBottomBar ---
interface PersistentBottomBarProps {
    showLoginMessage: () => void; // Expect the function as a prop
}

/**
 * PersistentBottomBar remains visible on allowed routes only.
 */
function PersistentBottomBar({ showLoginMessage }: PersistentBottomBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { contentChoice, setContentChoice } = useContext(ContentChoiceContext);
  const { isDarkTheme, userToken } = useContext(UserContext);
  const { scrollToTop } = useContext(ScrollContext);

  // *** Add '/repostfeed' to allowed paths ***
  const allowedPaths = ['/', '/savedarticles', '/followingpage', '/repostfeed']; // Assuming '/repostfeed' is the route
  if (!allowedPaths.includes(pathname)) {
    return null;
  }

  // Determine active tab based on pathname or context
  // *** Updated type to include 'feed' ***
  let activeTab: 'home' | 'trending' | 'saved' | 'feed' | 'friends';
  if (pathname.startsWith('/savedarticles')) {
    activeTab = 'saved';
  } else if (pathname.startsWith('/followingpage')) { // This route name might change if the file was renamed
    activeTab = 'friends';
  } else if (pathname.startsWith('/repostfeed')) { // *** Check for feed route ***
     activeTab = 'feed';
  } else {
    // Use contentChoice for home/trending distinction only on the '/' path
    activeTab = pathname === '/' && contentChoice.toLowerCase() === 'trending' ? 'trending' : 'home';
  }


  const handleHomePress = () => {
    if (contentChoice !== 'All' || pathname !== '/') {
        setContentChoice('All');
    }
    router.push({ pathname: '/', params: {} });
  };

  const handleTrendingPress = () => {
     if (contentChoice !== 'Trending' || pathname !== '/') {
        setContentChoice('Trending');
     }
    router.push({ pathname: '/', params: {} });
  };

  const handleBookmarkPress = () => {
    if (!userToken) {
      showLoginMessage();
    } else {
      router.push('/savedarticles');
    }
  };

  // *** New handler for the Feed tab ***
  const handleFeedPress = () => {
    // Assuming Feed requires login
    if (!userToken) {
        showLoginMessage();
    } else {
        router.push('/repostfeed'); // Navigate to the feed page route
    }
  };

  // *** Renamed handler for the Friends tab ***
  const handleFriendsPress = () => {
    if (!userToken) {
      showLoginMessage();
    } else {
      // Ensure this route matches the actual filename/route for the connections page
      router.push('/followingpage'); // Or '/connections' if you renamed the file/route
    }
  };

  // When the button is already active, call the scrollToTop function from context.
  const handleArrowPress = () => {
    // Check if the currently displayed tab matches the activeTab derived from the route/context
    // And call scrollToTop only if it's a match
    if (
        (activeTab === 'home' && pathname === '/' && contentChoice.toLowerCase() !== 'trending') ||
        (activeTab === 'trending' && pathname === '/' && contentChoice.toLowerCase() === 'trending') ||
        (activeTab === 'saved' && pathname === '/savedarticles') ||
        (activeTab === 'feed' && pathname === '/repostfeed') || // *** Added feed check ***
        (activeTab === 'friends' && pathname === '/followingpage') // *** Updated friends check ***
    ) {
        scrollToTop();
    } else {
        // If the tab isn't truly active for scrolling (e.g., home tab pressed while on /savedarticles),
        // perform the default navigation action instead.
        switch(activeTab) {
            case 'home': handleHomePress(); break;
            case 'trending': handleTrendingPress(); break;
            case 'saved': handleBookmarkPress(); break;
            case 'feed': handleFeedPress(); break; // *** Added feed case ***
            case 'friends': handleFriendsPress(); break; // *** Updated friends case ***
        }
    }
  };


  return (
    // *** Pass updated/new props to ChronicallyButton ***
    <ChronicallyButton
      onHomePress={handleHomePress}
      onTrendingPress={handleTrendingPress}
      onBookmarkPress={handleBookmarkPress}
      onFeedPress={handleFeedPress} // Pass new handler
      onFriendsPress={handleFriendsPress} // Pass renamed handler
      onArrowPress={handleArrowPress}
      activeTab={activeTab}
      isDarkTheme={isDarkTheme}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
