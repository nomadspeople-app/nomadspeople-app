# nomadspeople MVP 1.0 — Complete Specification

**Version:** 1.0  
**Status:** Ready for Apple Submission  
**Date:** April 15, 2026

---

## Table of Contents
1. [Overview](#overview)
2. [User Flow](#user-flow)
3. [Onboarding](#onboarding)
4. [Map & Discovery](#map--discovery)
5. [Activities & Timers](#activities--timers)
6. [Messaging](#messaging)
7. [User Profile](#user-profile)
8. [Safety & Moderation](#safety--moderation)
9. [Database Schema](#database-schema)
10. [Security (RLS Policies)](#security-rls-policies)

---

## Overview

**nomadspeople MVP 1.0** is a location-based social app for digital nomads to:
- Discover other nomads nearby on a map
- Join spontaneous activities/timers
- Chat in real-time with groups
- Build community on the road

**NOT in 1.0:**
- Flight tracking
- Advanced event discovery
- Monetization
- Dark mode

**LOCKED for 1.0:**
- System Language: **English ONLY** (default & only option)
- All UI strings, buttons, messages in English
- No language switching
- No translation files needed

**What IS in 1.0:**
- Real-time map with nomad pins
- Activity creation & joining
- Group chat with message management
- User profiles
- Safety features (block, report, leave)

---

## User Flow

```
App Launch
    ↓
[NOT LOGGED IN] → Auth Screen → Login/Signup
    ↓
[LOGGED IN BUT NEW] → Onboarding Screen
    ↓
    ├─ Welcome message
    ├─ Set display name
    ├─ Choose avatar
    ├─ Set location (GPS)
    ├─ Choose your vibe (tags)
    └─ "You're ready!"
    ↓
[LOGGED IN + ONBOARDED] → Home Screen (Map)
    ↓
    ├─ See nearby nomads on map
    ├─ Tap nomad pin → zoom + see timer
    ├─ Tap timer → join or view details
    ├─ Create new timer
    └─ Chat tab to see messages
    ↓
[READY TO WORK] → User can:
    ├─ Join groups
    ├─ Chat with other nomads
    ├─ Create activities
    ├─ View profile
    └─ Adjust settings
```

---

## Onboarding

**Goal:** Get user's profile ready in 5 minutes

### Step 1: Welcome
```
Screen: "Welcome to nomadspeople"
- Logo + tagline
- "Let's get you set up (3 min)"
- [Continue] button
```

### Step 2: Display Name
```
Input: "What should we call you?"
- Text field (min 2 chars, max 50)
- Placeholder: "e.g., Alex, Nomad Jane"
- [Next]
```

### Step 3: Avatar + Birth Year
```
Two sections on same page:

Avatar:
- 6 avatar options (initials + color)
- User can also upload photo

Birth Year:
- Input field: "What year were you born?"
- Placeholder: "2000"
- Shows age below

When both filled → [Next]
```

### Step 4: Location (Two-part)
```
Part A - Where are you from?
- Text input or country picker
- "Where's your home country/city?"

When filled, unlocks:

Part B - Where are you now?
- [Allow Location] button
- Gets GPS coordinates
- Shows city name + country
- User can edit if needed

When both filled → [Done]
```

### Step 5: Confirm
```
Summary: "You're all set!"
- Show name + avatar + birth year
- Show home + current location
- [Let's go!] → Home screen
```

**Result:**
- `onboarding_done = true`
- Profile created with:
  - `user_id`
  - `full_name`
  - `avatar_url`
  - `birth_year`
  - `home_location` (text)
  - `latitude` / `longitude`
  - `show_on_map = true`
  
**Deferred to Profile Settings:**
- Tags/Vibe/Interests (DNA-connected)
- Instagram handle
- Bio/About
- Notification preferences

---

## Map & Discovery

### Home Screen (Main Map)

```
┌─────────────────────────────┐
│ [Menu] Map [Profile]        │  ← Tab bar
├─────────────────────────────┤
│                             │
│  🗺️  [Nomad pins visible]  │  ← react-native-maps
│     [Tap any pin to zoom]   │
│                             │
├─────────────────────────────┤
│  [Create Activity] [Nearby] │  ← Action buttons
└─────────────────────────────┘
```

### Map Interaction Flow

**User taps nomad pin:**
1. Map zooms smoothly (400ms) to pin location
2. Latitude delta: 0.008 (zoomed in)
3. Wait 450ms for animation
4. Show timer popup (if user has active timer)

**TimerBubble Component:**
```
┌──────────────────────┐
│  📍 User Name        │
│  ⏱️  30 mins left    │
│  📍 Location         │
│  👥 3 joined         │
│  [Join Activity]     │  ← Red button
└──────────────────────┘
```

**Map Features:**
- All pins ALWAYS visible (density is the feature)
- No clustering
- Nomad count updates based on visible region
- Realtime updates when users go online/offline

---

## Activities & Timers

### Create Activity

```
Form: "What are you doing?"
├─ Title: "Coffee at Sarona" (required)
├─ Location: [Auto-filled from GPS]
├─ Duration: Slider 15-180 mins (default: 60)
├─ Description: "Join me for coffee" (optional)
├─ Category: [Slider with 3 tabs]
│   ├─ Social 🤝
│   ├─ Work 💼
│   └─ Adventure 🏔️
└─ [Create] button
```

**Result:**
- Activity created with `created_by = current_user`
- Timer pin appears on map
- Activity appears in chat as system message: "Created 'Coffee at Sarona' 🎉"
- Timer shows in bubble above location

### Join Activity

```
User taps [Join Activity] button:
1. RLS policy checks: user is authenticated ✅
2. Insert into `app_group_members`
3. Message sent: "[User] joined the activity 🤙"
4. User sees activity in Chat tab
5. Can now send messages to group
```

### Activity Bubble Display

```
All activities show as pins with:
- User avatar (color-coded)
- Time remaining
- Number of people
- Activity title (on tap)

Tapping shows:
- Full title
- Location
- Who joined (avatars)
- [Join] or [Leave] button
```

---

## Messaging

### Group Chat

**Access:** From Chat tab or activity popup

```
Chat Screen:
┌──────────────────────────┐
│ [Back] Group Name [Info] │
├──────────────────────────┤
│ Message 1                │
│ Message 2                │
│ Message 3                │
│ ...                      │
├──────────────────────────┤
│ [📎 Photo] [Text input]  │
│           [➤ Send]       │
└──────────────────────────┘
```

### Send Message

**User types & taps send:**
1. Text saved locally
2. INSERT into `app_messages` table
3. RLS checks: `sender_id = auth.uid()` ✅
4. Message appears in chat (realtime)
5. Other users see it via Realtime subscription

**Message Object:**
```javascript
{
  id: UUID,
  conversation_id: UUID,
  sender_id: UUID,
  content: "string",
  image_url: null,  // Only if image attached
  reply_to_id: null,  // Only if replying
  sent_at: timestamp,
  read_at: null,
  deleted_at: null
}
```

### Delete Message

**User can delete own messages (within 1 hour):**
1. Long-press message
2. Menu shows: [Copy, Delete, Report]
3. Tap [Delete]
4. SET `deleted_at = NOW()`
5. Message disappears from chat
6. Other users see: "[User] deleted a message"

**Rules:**
- Only sender can delete
- Only within 1 hour of sending
- Soft delete (record preserved)

### Message Reactions (1.1)

NOT in 1.0 — deferred to 1.1

---

## User Profile

### Profile Screen

```
┌──────────────────────────┐
│        [Avatar]          │
│       Display Name       │
│      Age (from birth yr) │
│     📍 Home Location     │
│     📍 Current Location  │
├──────────────────────────┤
│ Photo Gallery (3 grid)   │
│  [📸] [📸] [📸]       │
│   Photo 1  2   3        │
├──────────────────────────┤
│  About: "Love coffee..."│
│  Joined: 3 months ago   │
├──────────────────────────┤
│ [Edit Profile]          │
│ [Settings]              │
│ [Logout]                │
└──────────────────────────┘
```

**Photo Gallery:**
- 3 photos in grid format
- Can upload/replace each photo
- Tap to expand/view full size
- Stored in Supabase storage

**What's NOT in MVP 1.0:**
- ❌ My Travels
- ❌ My Work
- ❌ Instagram (in profile; can be added to settings later)
- ❌ Tags/Interests (in profile; deferred to profile settings)

### Edit Profile

**Fields (modifiable):**
- Full name ✏️
- Avatar (upload or choose) ✏️
- About/Bio (optional) ✏️
- Tags/Vibe ✏️
- Instagram handle (optional) ✏️
- Photo Gallery (3 photos) ✏️
- Location (override GPS) ✏️
- Show on map (toggle) ✏️

**NOT editable:**
- User ID
- Email
- Join date

**Photo Gallery:**
- 3 photo grid (photo_1_url, photo_2_url, photo_3_url)
- Each can be uploaded/replaced
- Stored in Supabase storage (`avatars/` bucket)
- Tap to select & upload
- Max 3MB per photo
- Display: 3-column grid on profile

**Social Media Field:**
- Label: "Instagram (optional)"
- Input: "@username" format
- Stored as: `instagram_handle` in `app_profiles`
- Display: Icon + clickable link on profile
- Opens: Instagram app or web (if available)

### Settings

```
Settings Screen:
├─ Notifications
│  ├─ New messages
│  ├─ Someone nearby
│  ├─ Group updates
│  └─ (All toggles)
├─ Privacy
│  ├─ Show me on map (toggle)
│  ├─ Who can message me
│  └─ Block list
├─ Account
│  ├─ Change password
│  ├─ Delete account
│  └─ Logout
└─ About
   ├─ Version 1.0
   ├─ Privacy Policy
   └─ Terms of Service
```

---

## Safety & Moderation

### Block User

**User can block another user:**
1. Visit their profile
2. Tap [...] menu
3. Select [Block User]
4. Blocked user:
   - Can't see them on map
   - Can't message them
   - Chat history hidden
   - Can unblock anytime

**Database:**
- Add to `app_blocked_users` table
- RLS: Users can only block/unblock for themselves

### Report Message

**User can report inappropriate message:**
1. Long-press message
2. Select [Report]
3. Choose reason:
   - Inappropriate
   - Harassment
   - Spam
   - Other
4. Message flagged in admin console
5. User notified: "Thanks for reporting"

### Leave Group

**User can leave group chat:**
1. Tap [Leave Group] in settings
2. Confirmation: "You'll no longer see messages"
3. System message: "[User] left the group 👋"
4. Chat history preserved (but hidden)

### Remove User from Group

**Group creator can remove members:**
1. Tap group member
2. Select [Remove from group]
3. User removed from `app_group_members`
4. System message: "[Creator] removed [User]"
5. Removed user can see history but can't chat

---

## Database Schema

### Core Tables

```sql
-- Users (Supabase auth.users)
auth.users
├─ id (UUID)
├─ email
├─ password_hash
└─ created_at

-- Profiles (our extension)
app_profiles
├─ user_id → FK auth.users
├─ full_name
├─ display_name
├─ avatar_url
├─ birth_year (integer, e.g. 2000)
├─ home_location (text, e.g. "United States" or "Los Angeles")
├─ latitude (current location)
├─ longitude (current location)
├─ photo_1_url (nullable, grid photo 1)
├─ photo_2_url (nullable, grid photo 2)
├─ photo_3_url (nullable, grid photo 3)
├─ about (nullable, bio)
├─ show_on_map (default: true)
├─ tags (JSON array, default: []) [deferred to 1.1]
├─ instagram_handle (nullable) [deferred to 1.1]
├─ onboarding_done (default: false)
├─ dark_mode (default: false)
├─ app_language (default: 'en', locked to 'en' for MVP)
├─ notification_distance_km (default: 50)
├─ notify_nearby (boolean)
├─ notify_chat (boolean)
├─ notify_activity_joined (boolean)
├─ snooze_mode (boolean)
├─ updated_at
└─ created_at

-- Conversations (Groups)
app_conversations
├─ id (UUID)
├─ user_a → FK auth.users (for DMs)
├─ user_b → FK auth.users (for DMs)
├─ created_by → FK auth.users
├─ is_locked (default: false)
├─ last_message_at
├─ created_at
└─ updated_at

-- Conversation Members
app_conversation_members
├─ conversation_id → FK app_conversations
├─ user_id → FK auth.users
├─ status ('active', 'request', 'left')
├─ muted_at (nullable)
├─ joined_at
└─ left_at (nullable)

-- Messages
app_messages
├─ id (UUID)
├─ conversation_id → FK app_conversations
├─ sender_id → FK auth.users
├─ content (text)
├─ image_url (nullable)
├─ reply_to_id → FK app_messages (nullable)
├─ sent_at (default: now())
├─ read_at (nullable)
├─ deleted_at (nullable, soft delete)
└─ updated_at

-- Checkins (Current location)
app_checkins
├─ id (UUID)
├─ user_id → FK auth.users
├─ latitude
├─ longitude
├─ is_active (default: true)
├─ checked_in_at
└─ expires_at

-- Blocked Users
app_blocked_users
├─ blocker_id → FK auth.users
├─ blocked_id → FK auth.users
├─ created_at
└─ PRIMARY KEY (blocker_id, blocked_id)

-- Reports
app_reports
├─ id (UUID)
├─ reporter_id → FK auth.users
├─ reported_message_id → FK app_messages
├─ reason (enum)
├─ status ('open', 'resolved')
├─ created_at
└─ resolved_at
```

---

## Security (RLS Policies)

### app_profiles
```sql
-- Users can read all profiles (for discovery)
CREATE POLICY "profiles_read" ON app_profiles
FOR SELECT TO authenticated
USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update" ON app_profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid());
```

### app_conversations
```sql
-- Users can read conversations they're in
CREATE POLICY "conversations_read" ON app_conversations
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT conversation_id FROM app_conversation_members
    WHERE user_id = auth.uid()
  )
);

-- Users can insert (create) conversations
CREATE POLICY "conversations_insert" ON app_conversations
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
```

### app_messages
```sql
-- Users can read messages in their conversations
CREATE POLICY "messages_read" ON app_messages
FOR SELECT TO authenticated
USING (
  conversation_id IN (
    SELECT conversation_id FROM app_conversation_members
    WHERE user_id = auth.uid()
  )
);

-- Users can insert (send) messages
CREATE POLICY "messages_insert" ON app_messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

-- Users can update their own messages
CREATE POLICY "messages_update" ON app_messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());
```

### app_blocked_users
```sql
-- Users can only manage their own blocks
CREATE POLICY "blocked_users_all" ON app_blocked_users
FOR ALL TO authenticated
USING (blocker_id = auth.uid())
WITH CHECK (blocker_id = auth.uid());
```

---

## Data Flow Summary

### New User Journey
```
1. Sign up
2. Onboarding (name, avatar, location, tags)
3. Profile created in DB
4. Redirect to Home (Map)
5. See nearby nomads
6. Can create/join activities
7. Can chat in groups
8. READY TO WORK ✅
```

### Message Sending
```
User types text
    ↓
handleSend() called
    ↓
Validate: not empty, user authenticated
    ↓
INSERT into app_messages
    ↓
RLS check: sender_id = auth.uid() ✅
    ↓
Realtime broadcast to group
    ↓
Other users see message (0-500ms delay)
```

### Activity Creation
```
User taps [Create Activity]
    ↓
Form: title, location, duration, category
    ↓
INSERT into app_conversations (system group)
    ↓
INSERT into app_conversation_members (creator)
    ↓
System message: "Created [Activity] 🎉"
    ↓
Timer pin appears on map
    ↓
Other nomads can see & join
```

---

## Apple Submission Checklist

- [ ] Privacy Policy (posted at `/privacy`)
- [ ] Terms of Service (posted at `/terms`)
- [ ] Account Deletion endpoint (at `/delete-account`)
- [ ] No hardcoded secrets in code
- [ ] Error handling (no crashes)
- [ ] Permissions:
  - [ ] Location (NSLocationWhenInUseUsageDescription)
  - [ ] Camera (for avatar upload)
  - [ ] Photos Library (for avatar upload)
  - [ ] Notifications
- [ ] No external links to payment processors
- [ ] GDPR-compliant (data export)
- [ ] Version number: 1.0.0
- [ ] Build number: 1
- [ ] Screenshots ready (iPhone + iPad)
- [ ] Description: "Discover nomads nearby and join spontaneous activities"
- [ ] Keywords: nomads, social, travel, community, real-time chat
- [ ] Support email configured
- [ ] Category: Social Networking or Travel

---

## Version 1.1 (Roadmap)

Deferred features:
- [ ] Multi-language (HE, ES, PT, IT, FR, DE, RU) — English is base
- [ ] Dark mode
- [ ] Message reactions
- [ ] Voice/video calls
- [ ] Event discovery (via APIs)
- [ ] Payments/monetization
- [ ] Story/feed functionality
- [ ] Advanced profile fields (Instagram, tags, etc.)

---

**END OF SPECIFICATION**

Signed off: MVP 1.0 Ready for Apple Submission ✅
