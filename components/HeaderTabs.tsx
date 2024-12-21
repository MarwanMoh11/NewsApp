import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface HeaderTabsProps {
  activeTab: 'My News' | 'Trending';
  setActiveTab: (tab: 'My News' | 'Trending') => void;
  username: string | null; // null if user is not logged in
  onLoginPress: () => void;
  onSettingsPress: () => void;
}

const HeaderTabs: React.FC<HeaderTabsProps> = ({
  activeTab,
  setActiveTab,
  username,
  onLoginPress,
  onSettingsPress
}) => {
  return (
    <View style={styles.header}>
      {/* Tabs: "My News" and "Trending" */}
      <View style={styles.tabsContainer}>
        {['My News', 'Trending'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
            onPress={() => setActiveTab(tab as 'My News' | 'Trending')}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Right Side: If NOT logged in => "Login"; if logged in => username + a small Settings icon */}
      <View style={styles.userSection}>
        {!username ? (
          // Show Login button if no username
          <TouchableOpacity style={styles.loginBtn} onPress={onLoginPress}>
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        ) : (
          // Show username & settings icon
          <View style={styles.userNameContainer}>
            <Text style={styles.userNameText}>{username}</Text>
            <TouchableOpacity
              style={styles.settingsIconButton}
              onPress={onSettingsPress}
            >
              <Icon name="settings-outline" size={18} color="#444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

export default HeaderTabs;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tabButton: {
    marginHorizontal: 20,
    paddingBottom: 5,
  },
  tabText: {
    fontSize: 18,
    color: '#888',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#A1A0FE',
  },
  activeTabText: {
    color: '#333',
    fontWeight: 'bold',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginBtn: {
    backgroundColor: '#8F80E0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontSize: 16,
    color: '#444',
    marginRight: 10,
  },
  settingsIconButton: {
    padding: 4,
  },
});
