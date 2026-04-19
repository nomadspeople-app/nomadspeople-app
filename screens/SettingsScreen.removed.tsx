/**
 * SettingsScreen.removed.tsx
 *
 * Archive of UI blocks removed from SettingsScreen.tsx during the v1.0
 * lean cleanup (April 2026). This file is intentionally NOT imported
 * anywhere — it exists only as a reference so removed sections can be
 * restored quickly once the underlying features are ready for production.
 *
 * All state variables, handlers, and DB columns referenced below are
 * still present in SettingsScreen.tsx / the codebase — only the UI rows
 * were removed. To restore a block, paste its JSX back at the indicated
 * location in SettingsScreen.tsx.
 */

export {};

/* ═════════════════════════════════════════════════════════════════════
 * REMOVED 2026-04-19 — "Show on map" row (visibility section)
 *
 * Reason: Snooze mode becomes the single user-facing visibility toggle.
 * handleToggleSnooze already calls applySnooze which mirrors show_on_map
 * in sync, so the reciprocal visibility rule in CLAUDE.md still fires
 * correctly from Snooze alone.
 *
 * Original location in SettingsScreen.tsx: inside the VISIBILITY card,
 * first child (before Snooze mode row).
 *
 *   <SettingsRow
 *     icon="eye"
 *     label={t('settings.showOnMap')}
 *     sublabel={t('settings.showOnMapSub')}
 *     right={
 *       <Switch
 *         value={showOnMap}
 *         onValueChange={handleToggleShowOnMap}
 *         trackColor={{ false: '#D1D5DB', true: colors.success }}
 *         ios_backgroundColor="#D1D5DB"
 *         thumbColor="white"
 *       />
 *     }
 *   />
 *   <View style={[styles.divider, { backgroundColor: colors.borderSoft }]} />
 * ═════════════════════════════════════════════════════════════════════ */

/* ═════════════════════════════════════════════════════════════════════
 * REMOVED 2026-04-19 — "Activities heating up" notification row
 *
 * Reason: feature not visible to users in v1.0. The "notify when
 * activities are heating up" push was part of an unbuilt social-signal
 * feature. State (notifyHeating) and handler (handleToggleHeating) are
 * preserved in SettingsScreen.tsx but no UI surfaces them.
 *
 * Original location: in the NOTIFICATIONS card, after notifyNearby row,
 * before notifyDistance row.
 *
 *   <View style={styles.divider} />
 *   <SettingsRow
 *     icon="trending"
 *     label={t('settings.notifyHeating')}
 *     right={
 *       <Switch
 *         value={notifyHeating}
 *         onValueChange={handleToggleHeating}
 *         trackColor={{ false: '#D1D5DB', true: colors.success }}
 *         ios_backgroundColor="#D1D5DB"
 *         thumbColor="white"
 *       />
 *     }
 *   />
 * ═════════════════════════════════════════════════════════════════════ */

/* ═════════════════════════════════════════════════════════════════════
 * REMOVED 2026-04-19 — "Profile views" notification row
 *
 * Reason: profile-views feature itself was removed in commit 88623c5
 * ("Fix: remove profile views, add location tracking, update settings").
 * The notification toggle for it was an orphan and confused users.
 *
 * Original location: in the NOTIFICATIONS card, after notifyDistance,
 * before Messages row.
 *
 *   <View style={styles.divider} />
 *   <SettingsRow
 *     icon="eye"
 *     label="Profile views"
 *     sublabel="When someone views your profile"
 *     right={
 *       <Switch
 *         value={notifyProfileView}
 *         onValueChange={handleToggleProfileView}
 *         trackColor={{ false: '#D1D5DB', true: colors.success }}
 *         ios_backgroundColor="#D1D5DB"
 *         thumbColor="white"
 *       />
 *     }
 *   />
 * ═════════════════════════════════════════════════════════════════════ */

/* ═════════════════════════════════════════════════════════════════════
 * REMOVED 2026-04-19 — "DNA matches" notification row
 *
 * Reason: DNA matching / Group Blend is the next major feature but not
 * live in v1.0. Surfacing a notification toggle for a feature that never
 * fires produces no value and hints at a feature users can't access yet.
 *
 * Original location: in the NOTIFICATIONS card, after "Activity joined"
 * row, as the last row in the card.
 *
 *   <View style={styles.divider} />
 *   <SettingsRow
 *     icon="heart"
 *     label="DNA matches"
 *     sublabel="When you match with a nearby nomad"
 *     right={
 *       <Switch
 *         value={notifyDnaMatch}
 *         onValueChange={handleToggleDnaMatch}
 *         trackColor={{ false: '#D1D5DB', true: colors.success }}
 *         ios_backgroundColor="#D1D5DB"
 *         thumbColor="white"
 *       />
 *     }
 *   />
 * ═════════════════════════════════════════════════════════════════════ */
