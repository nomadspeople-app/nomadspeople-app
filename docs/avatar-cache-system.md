# Avatar Cache System — Decision Log

## Date: April 8, 2026

## Current Approach: AvatarContext + Cache Busting (?v=N)

### What was built:
- `lib/AvatarContext.tsx` — Global context with `avatarVersion` counter
- `useAvatar()` hook provides `avatarUri(url)` and `bustAvatar()`
- Every `<Image source={{ uri: avatarUri(someUrl) }}>` appends `?v=N` to force reload
- `bustAvatar()` is called in `ProfileScreen.tsx` after avatar upload
- Wired into ALL files that display avatars (12+ components)

### Files modified:
- `lib/AvatarContext.tsx` — NEW FILE (the context provider)
- `App.tsx` — AvatarProvider wrapper + tab bar avatar
- `screens/ProfileScreen.tsx` — bustAvatar() on upload + avatar display
- `screens/HomeScreen.tsx` — map markers + nomad bubbles + TimerBubble + ActivityDetail
- `screens/PeopleScreen.tsx` — match avatars + flight dot avatars
- `screens/PulseScreen.tsx` — chat list avatars
- `screens/GroupInfoScreen.tsx` — member avatars
- `screens/PostFeedScreen.tsx` — author avatars
- `components/TimerBubble.tsx` — creator + group member avatars
- `components/ProfileCardSheet.tsx` — profile card avatar
- `components/NomadsListSheet.tsx` — nomad list avatars
- `components/FlightDetailSheet.tsx` — flight member avatars

### Why this approach (for now):
- Simple, works, no extra dependencies
- All avatar images refresh when user changes their profile picture

### Known downsides:
- Bumping version reloads ALL avatars, not just the changed one
- Requires global context + prop drilling in memoized components
- Standard RN Image has no advanced cache control

### Alternative considered: expo-image
- Built-in smart cache management
- `Image.clearMemoryCache()` after upload — one line, no context needed
- Better performance (blur placeholders, transitions)
- Expo ecosystem standard
- Would allow removing AvatarContext entirely
- Decision: Parked for now, can migrate later

### How to migrate to expo-image:
1. `npx expo install expo-image`
2. Replace `import { Image } from 'react-native'` with `import { Image } from 'expo-image'` in all files above
3. Add `Image.clearMemoryCache()` in ProfileScreen after avatar upload
4. Delete `lib/AvatarContext.tsx`
5. Remove all `useAvatar()` / `avatarUri()` usage — just use plain `uri` again
6. Remove `AvatarProvider` from App.tsx
