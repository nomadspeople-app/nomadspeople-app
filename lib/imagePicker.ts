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
 *
 * Stage-tagged failure model — same posture as uploadImage below.
 * Every reachable exit either returns a usable URI or surfaces an
 * Alert with `[STAGE] reason` so the user never sees a blind
 * "nothing happened". Cancelled by user is the ONE silent path
 * (returning to the screen without an alert is the desired UX).
 *
 * Stages:
 *   PERM   — gallery permission denied. Alert + null.
 *   PICKER — launchImageLibraryAsync threw (rare, but happens on
 *            some OEM skins when the gallery app is missing).
 *   EMPTY  — picker returned no asset AND wasn't cancelled.
 *            Tester report 2026-04-26: Samsung Photos picker
 *            returns canceled:true with assets:[] sometimes after
 *            a successful selection — no URI handed back. We
 *            surface this so the user knows to retry rather than
 *            assume the app froze.
 */
export async function pickImage(aspect?: [number, number]): Promise<string | null> {
  // Permissions: Android 13+ uses the system Photo Picker which
  // requires NO runtime permission — it grants per-photo access via
  // a temporary URI grant. iOS uses PHPhotoPicker which the picker
  // itself prompts for the first time it's invoked. Calling
  // requestMediaLibraryPermissionsAsync up front used to return
  // 'denied' on Android 13+ when the app's manifest doesn't declare
  // READ_MEDIA_IMAGES (we don't, because the modern picker doesn't
  // need it) — that 'denied' was making us bail before the picker
  // even opened. Tester report 2026-04-26: "אין כניסה אפילו לאלבום
  // בחירת תמונות כלל". Fix: skip the upfront permission check and
  // let the system picker handle access internally. If the user
  // genuinely lacks access, launchImageLibraryAsync surfaces it.
  let result;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // UX: on Android, `allowsEditing: true` invokes the OEM system
      // cropper which on Samsung One UI is broken (postage-stamp
      // preview, no Save button). Skip it on Android, keep on iOS.
      allowsEditing: Platform.OS === 'ios',
      aspect: aspect || [1, 1],
      quality: 0.7,
    });
  } catch (err: any) {
    showPickFailure('PICKER', err?.message || 'launchImageLibraryAsync threw');
    return null;
  }

  // Robustness order: trust the URI first, honor cancelled second.
  // Some Android pickers return canceled:true alongside a perfectly
  // good asset URI; we'd rather upload it than throw it away.
  const asset = result.assets?.[0];
  if (asset?.uri) {
    return asset.uri;
  }
  if (result.canceled) {
    // Genuine cancel — silent return. The user tapped Cancel; no
    // alert needed, that would be UX noise.
    return null;
  }
  // Not cancelled, but also no asset URI. Most common cause: OEM
  // picker returned an unreadable result (permissions, missing
  // gallery app, system intent quirk). Surface clearly so the user
  // knows the app isn't broken — the picker is.
  showPickFailure('EMPTY', `No image returned (canceled=${result.canceled}, assets=${result.assets?.length ?? 0})`);
  return null;
}

function showPickFailure(stage: string, detail: string): void {
  const msg = `[${stage}] ${detail}`;
  console.error(`[pickImage] ${msg}`);
  captureError(new Error(`pickImage:${stage}`), { detail });
  if (Platform.OS === 'web') window.alert(`Image picker failed\n${msg}`);
  else Alert.alert('Image picker failed', msg);
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
