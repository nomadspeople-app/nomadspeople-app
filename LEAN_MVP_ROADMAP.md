# 🎯 nomadspeople - Lean MVP v1.0 Roadmap

## סטטוס: CLEANUP MODE - עדיפות לגודל קובץ מעל כל דבר

---

## ✅ CRITICAL v1.0 (Do NOT Remove)

| Feature | Status | Notes |
|---------|--------|-------|
| **Map** - All nomads visible | ✅ Core | Keep all pins, no clustering |
| **Checkin** - Timer activity | ✅ Core | 30-120 min activities |
| **Checkin** - Status activity | ✅ Core | Quick status updates |
| **Chat** - Group messaging | ✅ Core | Text only for v1.0 |
| **Profile** - User profile view | ✅ Core | Avatar, bio, interests |
| **Search** - City search | ✅ Core | Tap to switch cities |
| **Auth** - Email/password login | ✅ Core | Supabase auth |
| **Notifications** - Push (basic) | ✅ Core | Join/message alerts |
| **Messages Tab** - Conversation list | ✅ Core | Pulse screen |

---

## 🟡 LEAN (Minimal Implementation - v1.0)

| Feature | Current | Lean v1.0 | v1.1+ |
|---------|---------|-----------|--------|
| **Edit Activity** | Full (name, location, date, time, all fields) | **Name only** | Date, time, location editing |
| **Group Management** | Full admin panel | **None - remove for v1.0** | Full admin panel in v1.1 |
| **Group Photos** | Implemented | **REMOVE** | Add back in v1.1 |
| **Approve Join Requests** | Not started | **REMOVE** | Implement in v1.1 |
| **Map View in Chat** | Was there, removed | **RESTORE** - just navigator button | Keep it |
| **Mute Notifications** | Implemented | **REMOVE** | Add back in v1.1 |
| **Leave Chat** | Implemented | **KEEP** - button only, no UI fluff | Keep simple |
| **Activity Details View** | Elaborate | **SIMPLIFY** - just name + member count | Full details in v1.1 |

---

## 🔴 REMOVE FOR v1.0 (Defer to v1.1)

### High Impact (Remove immediately)
- ❌ **Group Photos** - Delete completely, add back v1.1
- ❌ **Approve Join Requests** - Feature not started, skip for v1.0
- ❌ **Edit Location/Date/Time** - Keep name edit only, full editing in v1.1
- ❌ **Group Admin Panel** - Remove creator tools section
- ❌ **Mute Notifications Switch** - Remove from GroupInfo
- ❌ **Trips/Adventures** - Not core, skip

### Medium Impact (Simplify)
- ⚠️ **Activity Details** - Show only: Avatar + Name + Member count
- ⚠️ **Creator Tools** - Only: "Edit Name" button (not full edit form)
- ⚠️ **Members List** - Simple grid, no admin options

---

## 📱 App Size Reduction Strategy

### Files to DELETE entirely:
```
components/TripManagerSheet.tsx          (~2KB)
components/GroupPhotos.tsx               (~3KB)
screens/TripDetailScreen.tsx             (~4KB)
Database tables: app_group_photos        (cleanup SQL)
Database tables: app_trips               (cleanup SQL)
```

### Files to SIMPLIFY:
```
screens/GroupInfoScreen.tsx              (Reduce from 26KB → 15KB)
  - Remove group photos section
  - Remove mute notifications
  - Remove full edit form (keep name edit only)
  - Remove admin panel
  
components/TimerBubble.tsx               (Keep as-is, already lean)
components/QuickStatusSheet.tsx          (Keep as-is)
```

---

## 🚀 v1.0 User Journey (Lean Path)

1. **Login** → Email/password
2. **Map** → See nomads in city
3. **Tap nomad** → See Timer/Status bubble
4. **Join activity** → Click "Join"
5. **Chat** → Send messages
6. **Leave** → Click "Leave Chat"

**That's it. No extra UI. No photos. No admin stuff.**

---

## 📋 Implementation Checklist

### Phase 1: DELETE (Today)
- [ ] Remove group photos component + UI
- [ ] Remove approve requests feature (not started)
- [ ] Remove mute notifications from GroupInfoScreen
- [ ] Remove group admin panel
- [ ] Simplify activity details (name + count only)
- [ ] Restore map navigator in chat
- [ ] Keep name edit only (remove date/time/location)

### Phase 2: SIMPLIFY (Review)
- [ ] Remove unnecessary state from GroupInfoScreen
- [ ] Reduce imports in TimerBubble
- [ ] Clean up unused styles
- [ ] Remove dead code from QuickStatusSheet

### Phase 3: VERIFY (Testing)
- [ ] All core flows work
- [ ] No errors in console
- [ ] Map appears + navigator works
- [ ] Chat functions
- [ ] Notifications work
- [ ] Auth flows

---

## 💾 After v1.0 Release: v1.1 Roadmap

Once app is in stores:
- Add group photos
- Add approval system
- Add full activity editing (location, date, time)
- Add group admin panel
- Add trips/adventures
- Add mute notifications
- Add advanced search

---

## 🎯 Goal for v1.0
**< 50MB download, < 200MB installed, 30 second cold start**

Current estimates:
- App code: ~8MB
- Assets: ~2MB
- Dependencies: ~30MB
- Total: ~40MB ✅

Target post-cleanup: **35-38MB**
