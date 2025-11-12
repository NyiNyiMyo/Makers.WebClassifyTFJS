// ✅ mocks/react-native-fs.js
// Minimal safe mock for Expo Managed workflow
export default {
  readFile: async () => '',
  writeFile: async () => {},
  mkdir: async () => {},
  exists: async () => false,
  unlink: async () => {},
  copyFile: async () => {},
  moveFile: async () => {},
  readDir: async () => [],
};
