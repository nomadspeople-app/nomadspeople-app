// Mock for ExpoCryptoAES native module — not available in Expo Go
// This prevents the app from crashing when expo-crypto tries to load AES
class EncryptionKey {}
class SealedData {
  static fromParts() { return new SealedData(); }
  static fromCombined() { return new SealedData(); }
}
function encryptAsync() { throw new Error('AES encryption requires a development build'); }
function decryptAsync() { throw new Error('AES decryption requires a development build'); }

const _module = { EncryptionKey, SealedData, encryptAsync, decryptAsync };
export { EncryptionKey, SealedData, encryptAsync, decryptAsync };
export default _module;
