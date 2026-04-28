/**
 * AvatarTouchable — universal "tap an avatar to open the profile" wrapper.
 *
 * Why this exists (2026-04-28):
 *   nomadspeople is a social product. The owner directive after the
 *   first round of testers landed: "every avatar circle in the app
 *   should be a portal — tap a face anywhere, you land on that
 *   person's profile". Before this component, only six surfaces
 *   actually wired up profile navigation (NomadsListSheet,
 *   FollowersSheet, ProfileCardSheet, partial coverage in
 *   ActivityDetailSheet, PeopleScreen, GroupInfoScreen). Eleven
 *   surfaces — including high-traffic ones like the TimerBubble
 *   popup, PulseScreen conversation list, and ChatScreen message
 *   senders — rendered avatars that did absolutely nothing on tap.
 *
 *   That made the app feel hollow: a chat would show "Eli sent a
 *   photo" with Eli's face next to it, and tapping the face just
 *   sat there. Users tap faces. They expect to land on a profile.
 *
 *   This component centralizes that contract:
 *
 *     <AvatarTouchable userId={otherUserId} userName={otherFullName}>
 *       <CachedImage source={...} style={st.avatarRow} />
 *     </AvatarTouchable>
 *
 *   Drop it around every avatar Image / View at every render site.
 *   The wrapper handles:
 *     - useNavigation hook to reach the UserProfile screen
 *     - Disabled state when userId is missing OR when the caller
 *       explicitly opts out (e.g., own-message avatars in ChatScreen
 *       — tapping your own face is a dead end UX)
 *     - Optional onBeforeNavigate for callers that need to close a
 *       Modal/BottomSheet before pushing UserProfile (otherwise the
 *       sheet stays in front of the new screen)
 *     - hitSlop pass-through so small avatars (s(15) badge in the
 *       new bubble corner) get a generous tap target
 *
 * Usage rules (CLAUDE.md "Avatar Cache System" + UX skill):
 *   1. Every NEW avatar render in the app MUST go through this.
 *   2. Existing renders are migrated incrementally — see the
 *      "Avatar tap audit" section in PROJECT_DOSSIER for the
 *      live count.
 *   3. The visual layout is unchanged — TouchableOpacity wraps
 *      the existing children at their natural size, no layout
 *      shift, no padding changes.
 */

import React from 'react';
import { TouchableOpacity, View, type ViewStyle, type StyleProp } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  /** The user whose profile should open on tap. When falsy the
   *  wrapper degrades to a plain View — children render unchanged
   *  but no touch handler is attached. */
  userId: string | null | undefined;
  /** Optional display name passed to UserProfile so the screen
   *  header can render before the profile fetch resolves. Falls
   *  back to a generic title if absent. */
  userName?: string | null;
  /** Fired BEFORE the navigation push. Use this to close any
   *  Modal / BottomSheet that wraps the avatar, otherwise it
   *  stays in front of the freshly-pushed UserProfile screen
   *  (visible especially on iOS where Modal renders on top of
   *  the navigator). */
  onBeforeNavigate?: () => void;
  /** Hard-disable the tap (e.g., own-message avatars in chat,
   *  where tapping your own face has no useful destination). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Generous tap target for small avatars — the bubble badge
   *  is only s(15) in diameter, which is below Apple's 44pt
   *  minimum tap target. Default hitSlop here is 6/6/6/6 so
   *  the effective tap area is ~27pt; callers wrapping bigger
   *  avatars can pass `hitSlop={undefined}` to disable. */
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  activeOpacity?: number;
  children: React.ReactNode;
}

const DEFAULT_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

export default function AvatarTouchable({
  userId,
  userName,
  onBeforeNavigate,
  disabled,
  style,
  hitSlop,
  activeOpacity,
  children,
}: Props) {
  const nav = useNavigation<Nav>();

  // Degrade to a plain View when there's no destination. Pre-fix
  // attempts had an `if (!userId) return children` shortcut that
  // skipped applying `style`, breaking layout for every caller
  // that styled the wrapper instead of the inner avatar Image.
  // Wrapping in <View style={style}> preserves the layout
  // contract regardless of whether the avatar is tappable.
  if (disabled || !userId) {
    return <View style={style}>{children}</View>;
  }

  return (
    <TouchableOpacity
      style={style}
      activeOpacity={activeOpacity ?? 0.7}
      hitSlop={hitSlop === undefined ? DEFAULT_HIT_SLOP : hitSlop}
      accessibilityRole="button"
      accessibilityLabel={userName ? `Open profile of ${userName}` : 'Open profile'}
      onPress={() => {
        // onBeforeNavigate runs first so consumers can close their
        // hosting modal before the navigator pushes the new screen.
        // Try/catch keeps a buggy hook from blocking the navigation.
        try {
          onBeforeNavigate?.();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[AvatarTouchable] onBeforeNavigate threw:', e);
        }
        nav.navigate('UserProfile', {
          userId,
          name: userName ?? undefined,
        });
      }}
    >
      {children}
    </TouchableOpacity>
  );
}
