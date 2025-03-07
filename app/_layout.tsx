import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { UserProvider, UserContext } from './UserContext';
import { ContentChoiceProvider, ContentChoiceContext } from './contentchoice';
import ChronicallyButton from '../components/ui/ChronicallyButton';

export default function Layout() {
  return (
    <UserProvider>
      <ContentChoiceProvider>
        <View style={styles.container}>
          <View style={styles.content}>
            <Slot />
          </View>
          <PersistentBottomBar />
        </View>
      </ContentChoiceProvider>
    </UserProvider>
  );
}

/**
 * PersistentBottomBar remains visible on allowed routes only.
 * If not '/', '/savedarticles', or '/followingpage', we return null and hide the bar entirely.
 */
function PersistentBottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { contentChoice, setContentChoice } = useContext(ContentChoiceContext);
  const { isDarkTheme } = useContext(UserContext);

  // If current route is NOT one of these, hide the entire bottom bar.
  const allowedPaths = ['/', '/savedarticles', '/followingpage'];
  if (!allowedPaths.includes(pathname)) {
    return null;
  }

  // Determine activeTab if we are on an allowed path
  let activeTab: 'home' | 'trending' | 'saved' | 'friends';
  if (pathname.startsWith('/savedarticles')) {
    activeTab = 'saved';
  } else if (pathname.startsWith('/followingpage')) {
    activeTab = 'friends';
  } else {
    activeTab = contentChoice.toLowerCase() === 'trending' ? 'trending' : 'home';
  }

  // Navigation callbacks update the shared content choice or push new routes.
  const handleHomePress = () => {
    setContentChoice('All');
    router.push({ pathname: '/', params: { content: 'All' } });
  };

  const handleTrendingPress = () => {
    setContentChoice('Trending');
    router.push({ pathname: '/', params: { content: 'Trending' } });
  };

  const handleBookmarkPress = () => {
    router.push('/savedarticles');
  };

  const handleFollowingPress = () => {
    router.push('/followingpage');
  };

  const handleArrowPress = () => {};

  return (
    <ChronicallyButton
      onHomePress={handleHomePress}
      onTrendingPress={handleTrendingPress}
      onBookmarkPress={handleBookmarkPress}
      onFollowingPress={handleFollowingPress}
      onSearchPress={() => {}}
      onArrowPress={handleArrowPress}
      arrowDisabled={true}
      scrolledFarDown={false}
      activeTab={activeTab}
      isDarkTheme={isDarkTheme}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
