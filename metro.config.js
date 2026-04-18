const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect ExpoCryptoAES native module to a JS mock so the app
// can run inside Expo Go (which doesn't include that native module).
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === './ExpoCryptoAES' || moduleName.endsWith('aes/ExpoCryptoAES')) {
    return {
      filePath: path.resolve(__dirname, 'expo-crypto-aes-mock.js'),
      type: 'sourceFile',
    };
  }
  // Web-only: stub react-native-maps (native-only package that crashes the web bundler)
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'react-native-maps-web-mock.js'),
      type: 'sourceFile',
    };
  }
  // Fall back to default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
