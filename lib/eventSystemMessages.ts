/**
 * eventSystemMessages — the single entry point for posting system-level
 * updates into an event's chat when the owner changes something about
 * the event. This closes the "logic skill" loop: a change in the DB is
 * only half the story; members in the chat room must also see the update
 * so they actually know what happened.
 *
 * System messages are identified by `sender_id === null`. The chat UI
 * should render null-sender messages as centered, italic, no-bubble
 * callouts (e.g. "📍 Location changed to Jerusalem").
 *
 * Push notifications to the members are a separate concern (Edge
 * Function / server-side) and NOT handled here.
 */
import { supabase } from './supabase';

/**
 * Post a system message into the chat conversation tied to the given
 * check-in, if one exists. Silent no-op when the check-in has no chat
 * (e.g. solo timer with no one joined yet) — this is intentional.
 *
 * Never throws — system-message posting must not block the primary
 * save from succeeding. Failures are logged to console.
 */
export async function postEventSystemMessage(
  checkinId: string,
  content: string
): Promise<void> {
  if (!checkinId || !content?.trim()) return;
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
      sender_id: null,   // null sender = system message
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
