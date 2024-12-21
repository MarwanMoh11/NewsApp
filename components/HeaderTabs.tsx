// components/HeaderTabs.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface HeaderTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSettingsPress: () => void;
}

const HeaderTabs: React.FC<HeaderTabsProps> = ({ activeTab, setActiveTab, onSettingsPress }) => {
  return (
    <View style={styles.header}>
      <View style={styles.tabsContainer}>
        {['My News', 'Trending'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={onSettingsPress} style={styles.settingsIcon}>
        <Icon name="settings-outline" size={24} color="#888" />
      </TouchableOpacity>
    </View>
  );
};

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
  settingsIcon: {
    padding: 5,
  },
});

export default HeaderTabs;
