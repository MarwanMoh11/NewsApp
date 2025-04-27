// components/WebCamera.tsx
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    Text,
    StyleSheet,
    SafeAreaView,
    Platform,
    ActivityIndicator,
    StatusBar, // Import StatusBar
} from 'react-native';
import Webcam from 'react-webcam';
import { Ionicons } from '@expo/vector-icons';

interface WebCameraProps {
  onCapture: (imageSrc: string) => void;
  onCancel: () => void;
  isDarkTheme: boolean;
  isVisible: boolean; // Keep isVisible prop for state reset and key
}

const WebCamera: React.FC<WebCameraProps> = ({ onCapture, onCancel, isDarkTheme, isVisible }) => {
  const webcamRef = useRef<Webcam>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const dynamicStyles = getWebCameraStyles(isDarkTheme);
  const themeStatusBar = isDarkTheme ? 'light-content' : 'dark-content';

  // Reset state when visibility changes
  useEffect(() => {
    if (isVisible) {
      console.log("WebCamera becoming visible, resetting state.");
      setIsInitializing(true);
      setCameraError(null);
      setIsCapturing(false);
    }
  }, [isVisible]);

  // Capture handler
  const capture = useCallback(() => {
    if (webcamRef.current && !isCapturing && !cameraError) {
      setIsCapturing(true);
      const imageSrc = webcamRef.current.getScreenshot({
          // width: 1280, // Keep commented unless specific resolution needed
          // height: 720
      });
      if (imageSrc) {
        onCapture(imageSrc);
      } else {
        console.error("Webcam screenshot returned null or undefined.");
        alert("Failed to capture image. Please try again.");
        setIsCapturing(false);
      }
    }
  }, [webcamRef, onCapture, isCapturing, cameraError]);

  // Camera error handler
  const handleUserMediaError = useCallback((error: any) => {
    console.error("onUserMediaError:", error);
    let errorMessage = `Could not access camera. Please check browser permissions and ensure the camera is not in use by another app. (Error: ${error.name || 'Unknown'})`;
    if (error.name === 'NotReadableError') {
        errorMessage = `Camera might be in use by another application or encountered a hardware issue. Try closing other apps using the camera or restarting your browser. (Error: ${error.name})`;
    } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = `Camera permission was denied. Please grant permission in your browser settings and refresh. (Error: ${error.name})`;
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
         errorMessage = `No camera found on this device. Please ensure a camera is connected and enabled. (Error: ${error.name})`;
    }
    setCameraError(errorMessage);
    setIsInitializing(false);
  }, []);

  // Camera success handler
  const handleUserMedia = useCallback(() => {
    console.log("Webcam media stream loaded.");
    setIsInitializing(false);
    setCameraError(null);
  }, []);

  // Video constraints (simplified)
  const videoConstraints = true;

  // Key to force remount
  const webcamKey = isVisible ? `webcam-visible-${Date.now()}` : 'webcam-hidden';

  return (
    // Use SafeAreaView for the entire screen
    <SafeAreaView style={dynamicStyles.safeArea}>
      <StatusBar barStyle={themeStatusBar} backgroundColor={dynamicStyles.safeArea.backgroundColor} />

      {/* Header Bar */}
      <View style={dynamicStyles.headerContainer}>
         {/* Always visible Cancel button */}
         <TouchableOpacity onPress={onCancel} style={dynamicStyles.headerButton}>
             <Ionicons name="close-outline" size={28} color={dynamicStyles.headerButtonText.color} />
         </TouchableOpacity>
         <Text style={dynamicStyles.headerTitle}>Take Photo</Text>
         {/* Spacer to balance title */}
         <View style={dynamicStyles.headerButton} />
      </View>

      {/* Main Content Area */}
      <View style={dynamicStyles.contentContainer}>
        {/* Webcam View or Placeholder */}
        <View style={dynamicStyles.webcamContainer}>
          {Platform.OS === 'web' ? (
            <>
              <Webcam
                key={webcamKey}
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                style={dynamicStyles.webcam} // Style now includes objectFit: 'contain'
                mirrored={true}
                onUserMediaError={handleUserMediaError}
                onUserMedia={handleUserMedia}
                screenshotQuality={0.92}
              />
              {/* Loading Overlay */}
              {isInitializing && !cameraError && (
                <View style={dynamicStyles.overlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={dynamicStyles.overlayText}>Initializing Camera...</Text>
                </View>
              )}
              {/* Error Overlay */}
              {cameraError && (
                 <View style={dynamicStyles.overlay}>
                   <Ionicons name="warning-outline" size={40} color={AppColors.darkDestructive} />
                   <Text style={[dynamicStyles.overlayText, dynamicStyles.errorText]}>{cameraError}</Text>
                 </View>
              )}
            </>
          ) : (
            <View style={dynamicStyles.nativePlaceholder}>
              <Ionicons name="camera-reverse-outline" size={60} color={dynamicStyles.nativePlaceholderText.color} />
              <Text style={dynamicStyles.nativePlaceholderText}>Webcam only available on web</Text>
            </View>
          )}
        </View>

        {/* Capture Button Area */}
        <View style={dynamicStyles.captureButtonContainer}>
          <TouchableOpacity
            style={[
                dynamicStyles.captureButtonOuter,
                // Disable visually if error or initializing
                (isInitializing || !!cameraError || isCapturing) && dynamicStyles.buttonDisabled
            ]}
            onPress={capture}
            disabled={isCapturing || isInitializing || !!cameraError}
          >
            {isCapturing ? (
                 <ActivityIndicator size="large" color={dynamicStyles.captureButtonInner.backgroundColor} />
            ) : (
                 <View style={dynamicStyles.captureButtonInner} />
            )}

          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- Styles ---
const AppColors = {
  lightBackground: '#F7F7F7', lightCard: '#FFFFFF', lightTextPrimary: '#000000', lightTextSecondary: '#6D6D72', lightBorder: '#E5E5E5', lightAccent: '#007AFF', lightSystemGray4: '#D1D1D6', lightDestructive: '#FF3B30',
  darkBackground: '#000000', darkCard: '#1C1C1E', darkTextPrimary: '#FFFFFF', darkTextSecondary: '#8E8E93', darkBorder: '#38383A', darkAccent: '#0A84FF', darkSystemGray4: '#3A3A3C', darkDestructive: '#FF453A',
};

const getWebCameraStyles = (isDarkTheme: boolean) => {
  const colors = {
    background: isDarkTheme ? AppColors.darkBackground : AppColors.lightBackground,
    card: isDarkTheme ? AppColors.darkCard : AppColors.lightCard, // Use card color for header
    textPrimary: isDarkTheme ? AppColors.darkTextPrimary : AppColors.lightTextPrimary,
    textSecondary: isDarkTheme ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
    accent: isDarkTheme ? AppColors.darkAccent : AppColors.lightAccent,
    destructive: isDarkTheme ? AppColors.darkDestructive : AppColors.lightDestructive,
    overlayText: '#FFFFFF',
    headerButtonColor: isDarkTheme ? AppColors.darkAccent : AppColors.lightAccent, // Use accent for header buttons
    captureButtonInner: isDarkTheme ? AppColors.darkCard : AppColors.lightCard, // Inner capture circle color
  };

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Header Styles
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 10,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    headerButton: {
      padding: 8,
      minWidth: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerButtonText: {
        color: colors.headerButtonColor,
    },
    // Main Content Area
    contentContainer: {
      flex: 1,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    // Webcam Area Styles
    webcamContainer: {
      width: '100%',
      flexGrow: 1,
      flexShrink: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    webcam: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      // *** Changed objectFit to contain ***
      objectFit: 'contain', // Fit entire video, may add black bars
    },
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 20,
    },
    overlayText: {
        marginTop: 15, fontSize: 16, color: colors.overlayText, textAlign: 'center',
    },
    errorText: {
        color: AppColors.darkDestructive, // Use destructive color directly
        fontWeight: '600',
    },
    nativePlaceholder: {
      flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    nativePlaceholderText: {
      marginTop: 15, fontSize: 16, color: colors.textSecondary, textAlign: 'center',
    },
    // Capture Button Area Styles
    captureButtonContainer: {
        width: '100%',
        paddingVertical: 30,
        paddingBottom: Platform.OS === 'ios' ? 40 : 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
    captureButtonOuter: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.card,
    },
    captureButtonInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: colors.captureButtonInner,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
  });
};

export default WebCamera;
