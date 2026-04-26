import * as ImagePicker from 'expo-image-picker';
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
 * Uses FormData approach which is the most reliable on React Native.
 *
 * Why this detour around supabase.storage.from().upload({uri,type,name}):
 * the Supabase JS SDK quietly JSON-serializes the object instead of
 * reading the file on RN, producing a 341-byte text/plain upload that
 * the Image component can't render. We hit that in ChatScreen image
 * attachments on 2026-04-22 and moved every image path here as a
 * result.
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
    // Determine extension and content type
    const uriParts = localUri.split('.');
    const ext = uriParts[uriParts.length - 1]?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = customFileName || `${userId}/${Date.now()}.${ext}`;

    // Create FormData — the most reliable method on React Native
    const formData = new FormData();
    formData.append('', {
      uri: Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri,
      name: `upload.${ext}`,
      type: mimeType,
    } as any);

    // Upload via Supabase REST endpoint directly
    const supabaseUrl = 'https://apzpxnkmuhcwmvmgisms.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwenB4bmttdWhjd212bWdpc21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzg2MjksImV4cCI6MjA4OTk1NDYyOX0.Hr0n3c4l0vznMRN7eLPB40VATb77CjyOBWmYlLlK3KM';

    // Get session token if available
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token || supabaseKey;

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;

    // IMPORTANT: x-upsert is FALSE. When Supabase sees x-upsert=true,
    // RLS evaluates BOTH the INSERT and the UPDATE policies — and our
    // UPDATE policies on storage.objects for post-images / avatars
    // have check_expr = NULL, which Postgres interprets as default-
    // deny for the row-being-written. Result: 403 "new row violates
    // row-level security policy" on every chat image upload.
    // Our paths embed a timestamp, so collisions are impossible —
    // plain INSERT is the correct primitive. Do NOT flip this back
    // to 'true' without also fixing the UPDATE policy check_expr.
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': supabaseKey,
        'x-upsert': 'false',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload error:', response.status, errorText);
      const msg = `Upload failed: server returned ${response.status}. ${errorText.slice(0, 120)}`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Upload failed', msg);
      return null;
    }

    // Build public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (err: any) {
    console.error('Upload exception:', err);
    const msg = err.message || 'Unknown error';
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
