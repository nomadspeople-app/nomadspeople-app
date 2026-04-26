import * as ImagePicker from 'expo-image-picker';
// expo-file-system v55 split the old function-style API into the
// `legacy` subpath; the default import now throws at runtime for
// `readAsStringAsync` / `EncodingType`. We need the legacy module
// to read the picker URI as base64 in a single line, regardless
// of file:// vs content:// scheme.
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode as base64ToArrayBuffer } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { Alert, Platform } from 'react-native';

/**
 * Pick an image from the gallery and return a local URI.
 */
export async function pickImage(aspect?: [number, number]): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    if (Platform.OS === 'web') window.alert('Permission needed: Please allow access to your photo library.');
    else Alert.alert('Permission needed', 'Please allow access to your photo library.');
    return null;
  }

  // UX fix (2026-04-26 PM): on Android, `allowsEditing: true` invokes the
  // system cropper which (on Samsung One UI / many OEM skins) renders the
  // image into a postage-stamp preview with no visible "Done"/"Save"
  // affordance. Testers reported "התמונה מאוד מצומצמת ... ואין אופציה
  // להעלות". The native cropper is the bug, not our code — we cannot fix
  // its layout from JS. So we skip it entirely on Android and accept the
  // image as-picked. iOS keeps the cropper because Apple's is well-behaved.
  // Trade-off: no in-app crop for Android users in Closed Testing v14.
  // Follow-up (post-Google review): integrate `expo-image-manipulator` or
  // a proper crop modal so Android users can crop without the system UI.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: Platform.OS === 'ios',
    aspect: aspect || [1, 1],
    quality: 0.7,
  });

  // Robustness fix (2026-04-26): even with editing disabled on Android,
  // `result.canceled` is occasionally true while `assets[0].uri` is a
  // real, usable file — the user saw "nothing happened" after every pick.
  // We trust the URI when present and only honour `canceled` when there
  // is genuinely no asset to use.
  const asset = result.assets?.[0];
  if (asset?.uri) {
    return asset.uri;
  }
  if (result.canceled) {
    return null; // truly cancelled — no asset, no URI, nothing to do
  }
  // Not cancelled but also no URI — usually a permissions / IO failure.
  // Surface it instead of silent null so the user knows to retry.
  if (Platform.OS === 'web') window.alert('Could not read the selected image. Please try again.');
  else Alert.alert('Image error', 'Could not read the selected image. Please try again.');
  return null;
}

/**
 * Upload a local image URI to Supabase Storage.
 *
 * This is the canonical Supabase + React Native upload pattern:
 *
 *   1. Read the picker URI as base64 with expo-file-system. This
 *      works for both `file://` and `content://` URIs that
 *      expo-image-picker hands back on Android.
 *   2. Decode the base64 string into an ArrayBuffer with
 *      base64-arraybuffer.
 *   3. Pass the ArrayBuffer + contentType to
 *      `supabase.storage.from(bucket).upload(path, buf, {contentType})`.
 *      The SDK PUTs the raw bytes correctly because it sees a
 *      typed binary value, not the `{uri,type,name}` blob shape
 *      that triggered the old "341-byte text/plain upload" bug.
 *
 * History: pre-2026-04-26 this used a manual `fetch()` with a
 * FormData body. That works on iOS but is unreliable on Android —
 * tester report ("עכשיו הוא מכניס אותי לאלבום וקופץ ישר החוצה
 * לאחר בחירת תמונה") narrowed to FormData multipart on certain
 * OEMs producing zero-byte uploads with no surfaced error. The
 * ArrayBuffer path bypasses the FormData layer entirely and is
 * what the official Supabase RN docs now recommend.
 *
 * `customFileName` lets callers override the default `${userId}/time.ext`
 * layout — used by chat attachments, which want
 * `chat/{conversationId}/{userId}-{ts}.{ext}` so admin cleanup is
 * trivial.
 */
export async function uploadImage(
  localUri: string,
  bucket: 'avatars' | 'post-images',
  userId: string,
  customFileName?: string,
): Promise<string | null> {
  try {
    // Determine extension and content type from the picker URI.
    // expo-image-picker URIs always carry an extension; fall back
    // to jpg if a future asset somehow slips through without one.
    const uriParts = localUri.split('.');
    const ext = (uriParts[uriParts.length - 1] || 'jpg').toLowerCase().split('?')[0];
    const mimeType = ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';
    const fileName = customFileName || `${userId}/${Date.now()}.${ext}`;

    // Step 1 — read the file as base64. Expo's FileSystem handles
    // both `file://` (iOS) and `content://` (Android Photos picker)
    // schemes, so we don't need to scheme-detect or URL-encode here.
    const base64 = await readAsStringAsync(localUri, {
      encoding: EncodingType.Base64,
    });

    // Sanity guard — a 0-byte read means the picker handed us a URI
    // the file system can't access. Surface it instead of uploading
    // an empty image and silently saving an unviewable URL.
    if (!base64 || base64.length === 0) {
      const msg = 'Could not read the selected image (empty file).';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Upload failed', msg);
      return null;
    }

    // Step 2 — base64 → ArrayBuffer for the Supabase SDK.
    const arrayBuffer = base64ToArrayBuffer(base64);

    // Step 3 — upload via the SDK with the raw bytes. The SDK now
    // sees a binary value, sets the right Content-Type from our
    // override, and does NOT do the broken JSON-serialize-the-asset
    // path that bit us before.
    //
    // upsert: false is intentional — our paths embed a timestamp so
    // collisions are impossible, and `true` would force RLS to
    // evaluate the UPDATE policy too (which has a NULL check_expr
    // and default-denies, producing 403s on what should be plain
    // inserts). See storage.objects policies in Supabase Dashboard.
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(fileName, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[uploadImage] storage upload failed:', uploadErr.message, { bucket, fileName });
      const msg = `Upload failed: ${uploadErr.message}`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Upload failed', msg);
      return null;
    }

    // Build public URL the same way as before — public buckets
    // return a stable HTTPS link the Image component can render.
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (err: any) {
    console.error('[uploadImage] exception:', err);
    const msg = err?.message || 'Unknown error';
    if (Platform.OS === 'web') window.alert(`Upload failed: ${msg}`);
    else Alert.alert('Upload failed', msg);
    return null;
  }
}

/**
 * Pick & upload avatar — returns public URL.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const uri = await pickImage([1, 1]);
  if (!uri) return null;
  return uploadImage(uri, 'avatars', userId);
}

/**
 * Pick & upload a post image — returns public URL.
 */
export async function pickAndUploadPostImage(userId: string): Promise<string | null> {
  const uri = await pickImage([4, 3]);
  if (!uri) return null;
  return uploadImage(uri, 'post-images', userId);
}
