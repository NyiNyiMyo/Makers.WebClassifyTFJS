// ✅ metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect any require('react-native-fs') to our mock file
config.resolver.extraNodeModules = {
  'react-native-fs': path.resolve(__dirname, 'mocks/react-native-fs.js'),
};

module.exports = config;
