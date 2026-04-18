/**
 * AvatarContext — Global cache-bust for profile avatars.
 *
 * When a user changes their avatar, bump `avatarVersion`.
 * Every component that displays an avatar appends `?v=<version>` to the URL,
 * forcing React Native's Image cache to reload the fresh image.
 *
 * Usage:
 *   const { bustAvatar, avatarUri } = useAvatar();
 *   // After uploading new avatar:
 *   bustAvatar();
 *   // When rendering:
 *   <Image source={{ uri: avatarUri(someUrl) }} />
 */
import { createContext, useContext, useState, useCallback } from 'react';

interface AvatarCtx {
  /** Increment to force all avatar images to reload */
  avatarVersion: number;
  /** Call after uploading a new avatar */
  bustAvatar: () => void;
  /** Append cache-bust param to any avatar URL */
  avatarUri: (url: string | null | undefined) => string | undefined;
}

export const AvatarContext = createContext<AvatarCtx>({
  avatarVersion: 0,
  bustAvatar: () => {},
  avatarUri: (u) => u || undefined,
});

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const [avatarVersion, setAvatarVersion] = useState(0);

  const bustAvatar = useCallback(() => {
    setAvatarVersion((v) => v + 1);
  }, []);

  const avatarUri = useCallback(
    (url: string | null | undefined): string | undefined => {
      if (!url) return undefined;
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}v=${avatarVersion}`;
    },
    [avatarVersion],
  );

  return (
    <AvatarContext.Provider value={{ avatarVersion, bustAvatar, avatarUri }}>
      {children}
    </AvatarContext.Provider>
  );
}

export const useAvatar = () => useContext(AvatarContext);
