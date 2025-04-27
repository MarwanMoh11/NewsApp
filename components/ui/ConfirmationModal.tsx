// components/ui/ConfirmationModal.tsx
import React, { useContext } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { UserContext } from '../../app/UserContext'; // Adjust path if necessary
import Ionicons from '@expo/vector-icons/Ionicons';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean; // To show loading state on confirm button
  isDestructive?: boolean; // Style confirm button as destructive
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isConfirming = false,
  isDestructive = false,
}) => {
  const { isDarkTheme } = useContext(UserContext);
  const dynamicStyles = getModalStyles(isDarkTheme);

  // Determine confirm button text color based on destructive state and theme
  const confirmButtonTextColor = isDestructive
    ? (isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightCard) // White text on destructive bg
    : (isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightCard); // White text on accent bg

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel} // Allow closing via back button on Android
    >
      <View style={dynamicStyles.centeredView}>
        <View style={dynamicStyles.modalView}>
          {/* Icon indicating the type of action */}
          <Ionicons
            name={isDestructive ? "warning-outline" : "help-circle-outline"}
            size={40}
            color={isDestructive ? dynamicStyles.destructiveIcon.color : dynamicStyles.infoIcon.color}
            style={dynamicStyles.modalIcon}
          />
          {/* Modal Title */}
          <Text style={dynamicStyles.modalTitle}>{title}</Text>
          {/* Modal Message/Description */}
          <Text style={dynamicStyles.modalMessage}>{message}</Text>

          {/* Button Container */}
          <View style={dynamicStyles.buttonContainer}>
            {/* Cancel Button */}
            <TouchableOpacity
              style={[dynamicStyles.button, dynamicStyles.cancelButton]}
              onPress={onCancel}
              disabled={isConfirming} // Disable cancel while confirming
            >
              <Text style={dynamicStyles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>
            {/* Confirm Button */}
            <TouchableOpacity
              style={[
                dynamicStyles.button,
                // Apply destructive or standard confirm button style
                isDestructive ? dynamicStyles.destructiveButton : dynamicStyles.confirmButton,
                // Apply disabled style if confirming
                isConfirming && dynamicStyles.buttonDisabled,
              ]}
              onPress={onConfirm}
              disabled={isConfirming} // Disable confirm while confirming
            >
              {isConfirming ? (
                // Show loading indicator if confirming
                <ActivityIndicator size="small" color={confirmButtonTextColor} />
              ) : (
                 // Show confirm button text otherwise
                <Text style={[
                  isDestructive ? dynamicStyles.destructiveButtonText : dynamicStyles.confirmButtonText
                ]}>
                  {confirmText}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Consistent Color Definitions
const AppColors = {
    lightBackground: '#F7F7F7', lightCard: '#FFFFFF', lightTextPrimary: '#000000',
    lightTextSecondary: '#6D6D72', lightBorder: '#E5E5E5', lightAccent: '#007AFF',
    lightDestructive: '#FF3B30', lightSystemGray4: '#D1D1D6', lightModalBackdrop: 'rgba(0, 0, 0, 0.4)',

    darkBackground: '#000000', darkCard: '#1C1C1E', darkTextPrimary: '#FFFFFF',
    darkTextSecondary: '#8E8E93', darkBorder: '#38383A', darkAccent: '#0A84FF',
    darkDestructive: '#FF453A', darkSystemGray4: '#3A3A3C', darkModalBackdrop: 'rgba(0, 0, 0, 0.6)',
};

// Styles for the Modal
const getModalStyles = (isDarkTheme: boolean) => {
    const colors = {
        card: isDarkTheme ? AppColors.darkCard : AppColors.lightCard,
        textPrimary: isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightTextPrimary,
        textSecondary: isDarkTheme ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
        accent: isDarkTheme ? AppColors.darkAccent : AppColors.lightAccent,
        destructive: isDarkTheme ? AppColors.darkDestructive : AppColors.lightDestructive,
        backdrop: isDarkTheme ? AppColors.darkModalBackdrop : AppColors.lightModalBackdrop,
        buttonCancelBg: isDarkTheme ? AppColors.darkSystemGray4 : AppColors.lightSystemGray4,
    };
    return StyleSheet.create({
        centeredView: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.backdrop,
        },
        modalView: {
            margin: 20,
            backgroundColor: colors.card,
            borderRadius: 14,
            padding: 25,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            width: '85%',
            maxWidth: 400,
        },
        modalIcon: {
            marginBottom: 15,
        },
        infoIcon: {
             color: colors.accent, // Use accent for non-destructive icons
        },
        destructiveIcon: {
             color: colors.destructive, // Use destructive for warning icons
        },
        modalTitle: {
            marginBottom: 8,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: '600',
            color: colors.textPrimary,
        },
        modalMessage: {
            marginBottom: 25,
            textAlign: 'center',
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 20,
        },
        buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
        },
        button: {
            borderRadius: 8,
            paddingVertical: 12,
            paddingHorizontal: 10,
            elevation: 1,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 44,
        },
        buttonDisabled: {
            opacity: 0.7, // Visual feedback when button is processing
        },
        cancelButton: {
            backgroundColor: colors.buttonCancelBg, // Grey background for cancel
            marginRight: 10,
        },
        confirmButton: {
            backgroundColor: colors.accent, // Accent color for standard confirm
            marginLeft: 10,
        },
        destructiveButton: {
            backgroundColor: colors.destructive, // Destructive color for delete/deactivate
            marginLeft: 10,
        },
        cancelButtonText: {
            color: colors.textPrimary, // Primary text color for cancel button
            fontWeight: '500',
            textAlign: 'center',
            fontSize: 16,
        },
        confirmButtonText: {
            // White text usually works well on accent backgrounds
            color: isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightCard,
            fontWeight: '600',
            textAlign: 'center',
            fontSize: 16,
        },
        destructiveButtonText: {
             // White text usually works well on destructive backgrounds
            color: isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightCard,
            fontWeight: '600',
            textAlign: 'center',
            fontSize: 16,
        },
    });
};

export default ConfirmationModal;
