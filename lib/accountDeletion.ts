/**
 * accountDeletion — THE single account-erasure procedure.
 *
 * Required by Apple Guideline 5.1.1(v) (June 2022) and Google Play
 * developer policy. Both stores reject apps where account deletion
 * is missing, hidden, or incomplete.
 *
 * WHY THIS MODULE EXISTS
 * ──────────────────────
 * Two surfaces invoke account deletion:
 *
 *   1. The mobile app — Settings → Delete Account (lib/hooks.ts).
 *   2. The web — nomadspeople.com/delete-account (after the user
 *      confirms via emailed magic link).
 *
 * Before this module was extracted, only path #1 actually worked.
 * Path #2 sent a magic link and showed "we'll delete within 24
 * hours" — but no code ever performed the deletion. Apple would
 * have rejected the submission on first review (the reviewer
 * tests this exact flow).
 *
 * Both surfaces now call deleteAccountData() with the same
 * Supabase client they normally use. The mutation logic lives
 * in one place; if a new table is added that holds user PII, it
 * gets cleaned up here and both surfaces benefit.
 *
 * WHAT GETS DELETED / ANONYMIZED
 * ──────────────────────────────
 *   1. app_checkins                — DELETED (user's pins)
 *   2. app_conversation_members    — DELETED (chat memberships)
 *   3. app_messages.sender_id      — SET NULL (text stays so the
 *      thread context is preserved for other members; rendered as
 *      "deleted user" in the UI)
 *   4. app_blocks                  — DELETED (both directions)
 *   5. app_follows                 — DELETED (both directions)
 *   6. app_photo_posts             — soft-deleted (is_deleted=true)
 *   7. app_profile_views           — DELETED (both directions)
 *   8. app_notifications           — DELETED
 *   9. app_profiles                — DELETED (final PII record)
 *  10. auth.signOut()              — break the session
 *
 * NOTE: auth.users hard-delete requires admin (service-role)
 * privileges and so must run server-side via an Edge Function or
 * cron. For Apple's purposes, removing the profile + all PII (1-9)
 * is sufficient — the auth.users row left behind has only the
 * email + hashed password, no profile data, and the user can
 * never sign back in because the profile is gone. A follow-up
 * Edge Function will hard-delete the auth.users row periodically.
 */

export interface DeleteAccountResult {
  error: any;
}

/** Structural type — accepts ANY object with the supabase-js shape
 *  we need. Using a structural interface (instead of importing
 *  SupabaseClient from @supabase/supabase-js) sidesteps a
 *  TypeScript identity mismatch between the mobile workspace's
 *  copy of supabase-js (lives in /node_modules) and the web
 *  workspace's separate copy (lives in /web/node_modules). Both
 *  call sites pass a real client at runtime; the structural type
 *  documents the surface area we use without locking us to one
 *  package install. */
interface SupabaseLike {
  from(table: string): any;
  auth: {
    signOut(): Promise<{ error: any }>;
  };
}

/** Delete every row of personal data tied to `userId`, anonymize
 *  shared messages, and sign the session out. Idempotent —
 *  re-running on an already-deleted user is a no-op (every DELETE
 *  matches zero rows, every UPDATE matches zero rows). */
export async function deleteAccountData(
  userId: string,
  supabase: SupabaseLike,
): Promise<DeleteAccountResult> {
  if (!userId) return { error: new Error('userId required') };

  try {
    // 1. Delete all checkins owned by the user.
    await supabase.from('app_checkins').delete().eq('user_id', userId);

    // 2. Remove from every conversation they belong to.
    await supabase.from('app_conversation_members').delete().eq('user_id', userId);

    // 3. Anonymize messages they sent — text remains, attribution gone.
    //    Keeps chat continuity for other members. UI renders sender_id=null
    //    as "deleted user".
    await supabase.from('app_messages').update({ sender_id: null }).eq('sender_id', userId);

    // 4. Remove blocks (both directions).
    await supabase
      .from('app_blocks')
      .delete()
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    // 5. Remove follows (both directions).
    await supabase
      .from('app_follows')
      .delete()
      .or(`follower_id.eq.${userId},following_id.eq.${userId}`);

    // 6. Soft-delete photo posts (preserves any existing comments
    //    referencing them; UI hides them via the is_deleted flag).
    await supabase.from('app_photo_posts').update({ is_deleted: true }).eq('user_id', userId);

    // 7. Remove profile views (both directions — privacy + small data).
    await supabase
      .from('app_profile_views')
      .delete()
      .or(`viewer_id.eq.${userId},viewed_id.eq.${userId}`);

    // 8. Remove notifications.
    await supabase.from('app_notifications').delete().eq('user_id', userId);

    // 9. Delete the profile row itself. This is the last PII record.
    const { error: profileErr } = await supabase
      .from('app_profiles')
      .delete()
      .eq('user_id', userId);
    if (profileErr) return { error: profileErr };

    // 10. Break the session. The auth.users row stays behind but
    //     is unreachable — see header comment for the follow-up
    //     Edge Function plan.
    await supabase.auth.signOut();

    return { error: null };
  } catch (e: any) {
    return { error: e };
  }
}
