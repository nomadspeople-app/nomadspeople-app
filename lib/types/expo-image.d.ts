/**
 * Type stub for expo-image.
 *
 * Why this exists: we build a CachedImage wrapper that opts
 * into expo-image's disk cache WHEN the package is installed,
 * and falls back to the bundled React Native <Image/> when
 * it's not. Without this stub, TypeScript fails to compile
 * `require('expo-image')` until the package is actually in
 * node_modules.
 *
 * On Barak's machine, run once:
 *
 *     npx expo install expo-image
 *
 * That adds the real package + its real types, which shadow
 * this stub. After install, you may delete this file if you
 * prefer — optional, not breaking.
 */

declare module 'expo-image' {
  import type { ComponentType } from 'react';
  import type { ImageStyle, StyleProp } from 'react-native';

  export type ImageSource =
    | { uri: string }
    | { uri: string }[]
    | string
    | number
    | null
    | undefined;

  export type CachePolicy = 'memory' | 'disk' | 'memory-disk' | 'none';
  export type ContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

  export interface ImageProps {
    source?: ImageSource;
    style?: StyleProp<ImageStyle>;
    cachePolicy?: CachePolicy;
    contentFit?: ContentFit;
    transition?: number | { duration?: number; effect?: string };
    placeholder?: ImageSource;
    placeholderContentFit?: ContentFit;
    recyclingKey?: string;
    priority?: 'low' | 'normal' | 'high';
  }

  export const Image: ComponentType<ImageProps>;
}
