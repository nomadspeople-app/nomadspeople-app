# IRON RULE #0 — The System Belongs to the User

> **Once a user enters with a profile, the system is theirs. The tools are theirs. They build, manage, decide — alone.**

This is the foundational product principle of NomadsPeople. Everything else flows from it.

---

## The Rules

### 1. Full Autonomy
Whatever the user creates (status, timer, group, event) — they own it.
They can edit, extend, cancel, end, rename, remove members.
No asking permission. No "are you sure?" on every action. No admin approval.

### 2. Creator = Owner
The system must identify the creator of every entity and give them full management tools.
- Creator badge visible in chat messages
- Creator tools visible in group info (edit, end event, remove members)
- The creator runs their space — we just provide the tools

### 3. Zero Friction
If we built a tool, let them use it freely.
- Don't lock features behind unnecessary gates
- Don't add extra confirmation screens where one tap is enough
- Don't hide actions in deep menus
- One tap to join. One tap to leave. One tap to edit.

### 4. Upload, Post, Share — Freely
Users should feel free to upload what they want, post what they want, share what they want.
The guardrails we set (content moderation, safety) are invisible rails — not visible walls.

### 5. They Use Us, We Don't Use Them
The user must never feel like the product. They must feel like they're using a tool that empowers them.
- No dark patterns
- No engagement traps
- No artificial scarcity
- If they want to leave a group — one tap
- If they want to delete their status — one tap
- If they want to come back — welcome back, no guilt

### 6. Self-Governing Communities
Groups, events, and activities are self-managed by their creators and members.
We provide the tools, they provide the culture.
We intervene only for safety — never for control.

---

## The Test

When building ANY feature, ask:

> *"Does this make the user feel like they own their space, or like they're renting it from us?"*

If it's the latter — redesign it.

---

## Implementation Checklist

- [x] Creator badge on chat messages (`ChatScreen` — "creator" tag next to sender name)
- [x] Creator tools in group info (`GroupInfoScreen` — edit name, end event, remove members)
- [x] Join/Leave flow works everywhere (`ActivityDetailSheet`, `FlightDetailSheet`, `FlightDetailScreen`, `GroupInfoScreen`, `PulseScreen`)
- [x] All leave paths use centralized `leaveGroupChat()` — consistent behavior
- [x] Groups appear in Messages tab immediately after join
- [x] Groups disappear from Messages tab immediately after leave
- [x] Member count updates on join and leave
- [x] No unnecessary confirmation dialogs on reversible actions
- [ ] Content upload freedom (photos, images — no artificial limits)
- [ ] Status/timer edit and cancel — one tap
- [ ] Event re-open after ending (creator can revive)
- [ ] Member self-management (mute, leave, block — all accessible)
