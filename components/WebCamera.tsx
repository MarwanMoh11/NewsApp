// components/WebCamera.tsx

import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Webcam from 'react-webcam';
import { Ionicons } from '@expo/vector-icons';

interface WebCameraProps {
  onCapture: (imageSrc: string) => void;
  onCancel: () => void;
  isDarkTheme: boolean;
}

const WebCamera: React.FC<WebCameraProps> = ({ onCapture, onCancel, isDarkTheme }) => {
  const webcamRef = useRef<Webcam>(null);

  const capture = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  };

  return (
    <View style={styles.container}>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          facingMode: 'user',
        }}
        style={styles.webcam}
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.captureButton} onPress={capture}>
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.buttonText}>Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Ionicons name="close-circle" size={24} color={isDarkTheme ? '#fff' : '#333'} />
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '90%',
    backgroundColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
  },
  webcam: {
    width: '100%',
    height: 300,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    width: '100%',
    backgroundColor: '#000',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6D28D9',
    padding: 10,
    borderRadius: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    padding: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 16,
  },
});

export default WebCamera;
