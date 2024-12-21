// components/CategoryFilter.tsx
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onCategorySelect: (category: string) => void;
  onSeeAll: () => void;
  isSeeAll: boolean;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
  onSeeAll,
  isSeeAll,
}) => {
  return (
    <View style={styles.filterContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        <View style={styles.categoryWrapper}>
          {categories.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.filterButton,
                selectedCategory === category && styles.filterButtonActive,
              ]}
              onPress={() => onCategorySelect(category)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedCategory === category && styles.filterTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.filterButton, isSeeAll && styles.filterButtonActive]}
            onPress={onSeeAll}
          >
            <Text style={[styles.filterText, isSeeAll && styles.filterTextActive]}>
              See All →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  filterContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryWrapper: {
    flexDirection: 'row',
  },
  filterButton: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 15,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#A1A0FE',
    borderColor: '#FFF',
  },
  filterText: {
    color: '#000',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

export default CategoryFilter;
