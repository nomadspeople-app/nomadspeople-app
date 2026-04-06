/**
 * sharing.ts — Utility functions for sharing events to Instagram Stories and native share sheet.
 *
 * Handles:
 * - Capturing EventShareCard to an image via ViewShot
 * - Sharing to Instagram Stories (iOS + Android)
 * - Fallback to generic share sheet
 * - Instagram installation detection
 */

import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Linking, Platform, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/* ─── Capture EventShareCard to image file ─── */
export async function captureCard(
  viewShotRef: React.RefObject<ViewShot>
): Promise<string | null> {
  try {
    if (!viewShotRef.current) {
      console.warn('ViewShot ref not attached');
      return null;
    }

    const uri = await viewShotRef.current.capture?.();
    return uri || null;
  } catch (error) {
    console.error('[captureCard] Failed to capture:', error);
    return null;
  }
}

/* ─── Check if Instagram is installed ─── */
export async function isInstagramInstalled(): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL('instagram://');
    return canOpen;
  } catch (error) {
    console.warn('[isInstagramInstalled] Error checking Instagram:', error);
    return false;
  }
}

/* ─── Share to Instagram Stories (iOS + Android) ─── */
export async function shareToInstagramStory(imageUri: string): Promise<boolean> {
  try {
    const installed = await isInstagramInstalled();
    if (!installed) {
      console.warn('[shareToInstagramStory] Instagram not installed');
      return false;
    }

    if (Platform.OS === 'ios') {
      return await shareToInstagramStoryIOS(imageUri);
    } else if (Platform.OS === 'android') {
      return await shareToInstagramStoryAndroid(imageUri);
    } else {
      console.warn('[shareToInstagramStory] Unsupported platform:', Platform.OS);
      return false;
    }
  } catch (error) {
    console.error('[shareToInstagramStory] Error:', error);
    return false;
  }
}

/* ─── iOS: Use pasteboard to pass image to Instagram Stories ─── */
async function shareToInstagramStoryIOS(imageUri: string): Promise<boolean> {
  try {
    // Read the image file as base64
    const base64Data = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Copy to pasteboard
    await Clipboard.setImageAsync(`data:image/png;base64,${base64Data}`);

    // Open Instagram Stories
    // Using the instagram-stories://share URI scheme
    const instagramUrl = 'instagram-stories://share';
    const canOpen = await Linking.canOpenURL(instagramUrl);

    if (canOpen) {
      await Linking.openURL(instagramUrl);
      return true;
    }

    // Fallback: open regular Instagram app
    await Linking.openURL('instagram://');
    return true;
  } catch (error) {
    console.error('[shareToInstagramStoryIOS] Error:', error);
    return false;
  }
}

/* ─── Android: Use intent with ADD_TO_STORY ─── */
async function shareToInstagramStoryAndroid(imageUri: string): Promise<boolean> {
  try {
    // Copy image URI to clipboard for user to paste
    // Android requires sharing via content:// URI or file URI
    // The simplest approach: use Sharing.shareAsync which lets Android handle Instagram
    await Sharing.shareAsync(imageUri, {
      mimeType: 'image/png',
      dialogTitle: 'Share to Instagram Stories',
    });

    return true;
  } catch (error) {
    console.error('[shareToInstagramStoryAndroid] Error:', error);
    return false;
  }
}

/* ─── Share via native share sheet (WhatsApp, Telegram, Email, etc.) ─── */
export async function shareEvent(params: {
  activityText: string;
  locationName?: string;
  link?: string;
  imageUri?: string;
}): Promise<void> {
  try {
    const { activityText, locationName, link, imageUri } = params;

    // Build message text
    let message = `Check out this event: ${activityText}`;
    if (locationName) {
      message += ` at ${locationName}`;
    }
    if (link) {
      message += `\n\nJoin here: ${link}`;
    } else {
      message += `\n\nJoin: nomadspeople.com`;
    }

    const shareOptions: any = {
      message,
      url: link || 'https://nomadspeople.com',
      title: `Join ${activityText}`,
    };

    // Add image if provided
    if (imageUri && Platform.OS === 'ios') {
      shareOptions.url = imageUri;
    }

    const result = await Share.share(shareOptions);

    if (result.action === Share.dismissedAction) {
      console.log('[shareEvent] Share dismissed');
    } else {
      console.log('[shareEvent] Share successful');
    }

    // If image and Android, try to share with Sharing API
    if (imageUri && Platform.OS === 'android') {
      try {
        await Sharing.shareAsync(imageUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Event',
        });
      } catch (e) {
        console.warn('[shareEvent] Image sharing failed on Android:', e);
      }
    }
  } catch (error) {
    console.error('[shareEvent] Error:', error);
    if (error instanceof Error) {
      Alert.alert('Share Error', error.message);
    }
  }
}

/* ─── Check if Instagram is available and show appropriate UI ─── */
export async function getShareOptions(
  imageUri?: string
): Promise<{
  canShareToInstagram: boolean;
  canShareNatively: boolean;
}> {
  try {
    const instagramInstalled = await isInstagramInstalled();
    const canShareNatively = await Sharing.isAvailableAsync();

    return {
      canShareToInstagram: instagramInstalled && !!imageUri,
      canShareNatively,
    };
  } catch (error) {
    console.error('[getShareOptions] Error:', error);
    return {
      canShareToInstagram: false,
      canShareNatively: false,
    };
  }
}
