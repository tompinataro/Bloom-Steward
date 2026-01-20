import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

const AppSplash = () => {
  return (
    <ImageBackground
      source={require('../../assets/palms_splash.jpg')}
      resizeMode="cover"
      style={styles.bg}
      accessibilityLabel="Loading"
    >
      {/* ...existing content... */}
    </ImageBackground>
  );
};

export default AppSplash;
