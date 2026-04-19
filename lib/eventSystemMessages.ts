/**
 * eventSystemMessages — single entry point for posting change-notices
 * into an event's chat when the owner edits the event. Closes the
 * `logic` skill's loop: DB update is only half the story; members in
 * the chat must see what changed.
 *
 * Authoring rule: we attribute these to the OWNER (senderUserId), not
 * a null sender. RLS on app_messages requires sender_id = auth.uid()
 * for INSERT — posting with NULL silently fails. Content prefixes
 * (✏️ / 📍 / ⏰ / 🔒 / ❌) are how the chat UI styles these as
 * system-style announcements instead of regular bubbles.
 */
import { supabase } from './supabase';

/**
 * Post a change-notice into the chat tied to the given check-in.
 *   senderUserId: the user making the change (normally the event
 *     owner). This must equal auth.uid() or RLS blocks the INSERT.
 * Silent no-op when there's no chat yet (solo event, nobody joined).
 * Never throws — failures logged to console.
 */
export async function postEventSystemMessage(
  checkinId: string,
  senderUserId: string,
  content: string
): Promise<void> {
  if (!checkinId || !senderUserId || !content?.trim()) return;
  try {
    const { data: conv, error: findErr } = await supabase
      .from('app_conversations')
      .select('id')
      .eq('checkin_id', checkinId)
      .maybeSingle();

    if (findErr) {
      console.warn('[eventSystemMessages] conv lookup failed:', findErr.message);
      return;
    }
    if (!conv?.id) return;  // no chat yet → nothing to notify

    const { error: insertErr } = await supabase.from('app_messages').insert({
      conversation_id: conv.id,
      sender_id: senderUserId,
      content: content.trim(),
    });

    if (insertErr) {
      console.warn('[eventSystemMessages] insert failed:', insertErr.message);
    }
  } catch (e) {
    console.warn('[eventSystemMessages] unexpected error:', e);
  }
}

/* ─── Pre-built formatters so every caller produces consistent copy ─── */

export const eventSystemMsg = {
  titleChanged: (newTitle: string) => `✏️ Event renamed to "${newTitle}"`,
  locationChanged: (newLocation: string) => `📍 Location moved to ${newLocation}`,
  dateChanged: (newDateLabel: string) => `📅 Moved to ${newDateLabel}`,
  timeChanged: (newTimeLabel: string) => `⏰ Time moved to ${newTimeLabel}`,
  cancelled: () => '❌ Event cancelled',
  madePrivate: () => '🔒 Event is now private',
  madePublic: () => '🌐 Event is now public',
};
