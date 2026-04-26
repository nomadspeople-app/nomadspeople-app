import * as ImagePicker from 'expo-image-picker';
// expo-file-system v55 split the old function-style API into the
// `legacy` subpath; the default import now throws at runtime for
// `readAsStringAsync` / `EncodingType`. We need the legacy module
// to read the picker URI as base64 in a single line, regardless
// of file:// vs content:// scheme. `getInfoAsync` is from the same
// path so the existence check before reading is consistent.
import { readAsStringAsync, getInfoAsync, EncodingType } from 'expo-file-system/legacy';
import { decode as base64ToArrayBuffer } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { captureError } from './sentry';
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
/* Tiny diagnostic helper — surfaces a failure to the user with
 * the EXACT failing step so we never debug "it didn't work" again.
 * Each call also fires a Sentry breadcrumb-style captureError for
 * post-mortem analysis without needing a screenshot. */
function showFailure(stage: string, detail: string, ctx?: Record<string, any>): void {
  const msg = `[${stage}] ${detail}`;
  console.error(`[uploadImage] ${msg}`, ctx || {});
  captureError(new Error(`uploadImage:${stage}`), { detail, ...ctx });
  if (Platform.OS === 'web') window.alert(`Upload failed\n${msg}`);
  else Alert.alert('Upload failed', msg);
}

export async function uploadImage(
  localUri: string,
  bucket: 'avatars' | 'post-images',
  userId: string,
  customFileName?: string,
): Promise<string | null> {
  /* This function is the single chokepoint for every image upload
   * in the app (avatar, profile grid, chat attachment). It MUST
   * NEVER fail silently — the user sees the picker close and
   * expects feedback. We surface a stage-tagged Alert at every
   * exit path so the report "I picked a photo but nothing happened"
   * always becomes "I picked a photo and saw `[STAGE] reason`"
   * instead, which is debuggable instead of a guess.
   *
   * Stages, in order:
   *   URI    — the picker handed us nothing usable.
   *   STAT   — file system can't see the URI on disk.
   *   READ   — readAsStringAsync threw or returned empty.
   *   AUTH   — no Supabase session → RLS will reject upload.
   *   SDK    — supabase.storage.upload threw (network / RLS / size).
   *   URL    — upload succeeded but getPublicUrl returned nothing.
   * Every catch flows through showFailure so Sentry sees it too.
   */
  try {
    // ── Stage URI: sanity-check the picker output ─────────────
    if (!localUri || typeof localUri !== 'string') {
      showFailure('URI', 'Picker returned no usable image URI', { localUri });
      return null;
    }

    // Determine extension + content type. Strip any query string
    // (some Android pickers append `?width=..&height=..`).
    const cleaned = localUri.split('?')[0];
    const dotIdx = cleaned.lastIndexOf('.');
    const ext = (dotIdx >= 0 ? cleaned.slice(dotIdx + 1) : 'jpg').toLowerCase();
    const mimeType = ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : ext === 'heic' || ext === 'heif' ? 'image/heic'
      : 'image/jpeg';
    const fileName = customFileName || `${userId}/${Date.now()}.${ext}`;

    // ── Stage STAT: confirm the file actually exists ──────────
    // expo-image-picker on Android sometimes hands back a URI that
    // looks valid but points to a vanished cache file. Check first
    // so the failure has a clear message instead of a cryptic
    // "could not read" further down.
    let fileSizeBytes = 0;
    try {
      const info = await getInfoAsync(localUri);
      if (!info.exists) {
        showFailure('STAT', 'Picker URI does not point to a file on disk', { localUri });
        return null;
      }
      fileSizeBytes = (info as any).size ?? 0;
    } catch (statErr: any) {
      showFailure('STAT', statErr?.message || 'getInfoAsync threw', { localUri });
      return null;
    }

    // ── Stage READ: pull bytes as base64 ──────────────────────
    let base64: string;
    try {
      base64 = await readAsStringAsync(localUri, { encoding: EncodingType.Base64 });
    } catch (readErr: any) {
      showFailure('READ', readErr?.message || 'readAsStringAsync threw', {
        localUri,
        fileSizeBytes,
      });
      return null;
    }
    if (!base64 || base64.length === 0) {
      showFailure('READ', 'Read succeeded but file is empty', {
        localUri,
        fileSizeBytes,
      });
      return null;
    }

    const arrayBuffer = base64ToArrayBuffer(base64);
    const arrayBufferBytes = arrayBuffer.byteLength;
    if (arrayBufferBytes === 0) {
      showFailure('READ', 'Decoded ArrayBuffer is empty', {
        base64Length: base64.length,
      });
      return null;
    }

    // ── Stage AUTH: confirm we have a live Supabase session ───
    // Without it, RLS denies the upload. Surface as auth, not as
    // a generic upload error, so the user knows to re-sign-in.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      showFailure('AUTH', 'No active session — please sign in again', { userId });
      return null;
    }

    // ── Stage SDK: upload via the Supabase Storage SDK ────────
    // ArrayBuffer payload + explicit contentType is the official
    // RN pattern. upsert:false because our timestamped paths can
    // never collide and our UPDATE storage RLS policy has a NULL
    // check_expr that default-denies, which would produce 403s if
    // we let upsert engage the UPDATE branch.
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(fileName, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadErr) {
      showFailure('SDK', uploadErr.message || 'Storage SDK rejected the upload', {
        bucket,
        fileName,
        mimeType,
        arrayBufferBytes,
      });
      return null;
    }

    // ── Stage URL: build the public URL for callers ───────────
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    if (!urlData?.publicUrl) {
      showFailure('URL', 'Upload succeeded but no public URL returned', {
        bucket,
        fileName,
      });
      return null;
    }
    return urlData.publicUrl;
  } catch (err: any) {
    // Fallback safety net — should never hit if every stage
    // above caught its own error, but keeps a guarantee that
    // SOMETHING is shown on any reachable failure.
    showFailure('CATCH', err?.message || 'Unknown error', { stack: err?.stack });
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
