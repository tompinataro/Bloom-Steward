import React from 'react'
import { ImageBackground } from 'react-native'
import styles from './styles'

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
  )
}

export default AppSplash