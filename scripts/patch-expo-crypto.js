#!/usr/bin/env node
/**
 * Patches expo-crypto AES module to work in Expo Go.
 * ExpoCryptoAES is a native module not available in Expo Go,
 * so we replace it with a JS mock.
 * Run automatically via postinstall.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname, '..', 'node_modules', 'expo-crypto', 'build', 'aes', 'ExpoCryptoAES.js'
);

const mock = `// Patched: mock ExpoCryptoAES for Expo Go compatibility
class EncryptionKey {}
class SealedData {
  static fromParts() { return new SealedData(); }
  static fromCombined() { return new SealedData(); }
}
function encryptAsync() { throw new Error('AES not available in Expo Go'); }
function decryptAsync() { throw new Error('AES not available in Expo Go'); }

const _module = { EncryptionKey, SealedData, encryptAsync, decryptAsync };
export { EncryptionKey, SealedData, encryptAsync, decryptAsync };
export default _module;
`;

if (fs.existsSync(target)) {
  fs.writeFileSync(target, mock);
  console.log('✅ Patched expo-crypto AES for Expo Go compatibility');
} else {
  console.log('⚠️  expo-crypto AES file not found, skipping patch');
}
