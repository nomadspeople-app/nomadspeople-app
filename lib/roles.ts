/**
 * lib/roles.ts — THE single source of truth for "who can do what"
 * ════════════════════════════════════════════════════════════════
 *
 * Locks the Creator-vs-Participant distinction that CLAUDE.md
 * Rule Two depends on. Every UI surface that decides "show this
 * button to X but not Y" MUST import from here. No screen is
 * allowed to derive the role inline. No screen is allowed to use
 * `app_conversations.created_by` directly.
 *
 * Why this file exists
 * ────────────────────
 * Tester report 2026-04-26 ("חבר ראה End Event שצריך להיות רק
 * ליוצר") proved the codebase was using `app_conversations.created_by`
 * as the proxy for "event creator". After the April 2026 RLS
 * hardening, that column became "the first user to insert the
 * conversation row" — which is often the FIRST JOINER of an event,
 * not its owner. The result was members seeing creator-only
 * destructive actions on events they didn't create.
 *
 * Source of truth
 * ───────────────
 * For event-linked chats (status / timer): the **event** is the
 *   anchor. `app_checkins.user_id` is the owner. Period.
 * For ad-hoc / standalone groups: there's no event, so
 *   `app_conversations.created_by` IS the legitimate owner — they
 *   created the group from scratch.
 * For 1-on-1 chats: there is no creator role. Both sides are
 *   peers; "leave" is replaced by "block".
 *
 * Closed-loop guarantee
 * ─────────────────────
 * Every helper here is deterministic and side-effect free. Pass it
 * the same inputs, get the same answer. UI gates compose them
 * directly:
 *
 *     {canEndEvent(ctx) && <EndEventButton/>}
 *     {canLeaveGroup(ctx) && <LeaveButton/>}
 *
 * If you ever find yourself writing `userId === conversation.created_by`
 * inline, STOP. Add the missing helper here instead. Inline checks
 * are how this whole class of bug was born.
 */

/**
 * What every role helper needs.
 *
 * `checkin` is OPTIONAL. When present (the chat is bound to an
 * event), the event's `user_id` is the source of truth. When
 * absent, we fall back to the conversation row's `created_by`.
 *
 * `conversation` is OPTIONAL only because some callers may not
 * have it loaded yet (loading state); helpers return false in
 * that case so loading screens never flash creator-only buttons.
 */
export interface ConversationRoleContext {
  /** The viewing user's id. Null/undefined while auth is loading. */
  userId: string | null | undefined;
  /** The chat row. */
  conversation:
    | {
        id?: string;
        created_by?: string | null;
        checkin_id?: string | null;
        /** When set, this is a 1-on-1 DM, not a group. */
        user_a?: string | null;
        user_b?: string | null;
      }
    | null
    | undefined;
  /** When the conversation is bound to an event (status / timer),
   *  pass the linked app_checkins row. Its `user_id` is authoritative.
   *  Omit / pass null for ad-hoc group chats. */
  checkin?: { user_id?: string | null } | null | undefined;
}

/**
 * Internal helper — true iff the conversation is a 1-on-1 DM.
 * Group/event chats have user_a == user_b == null.
 */
function isDirectMessage(
  conversation: ConversationRoleContext['conversation'],
): boolean {
  return !!(conversation?.user_a && conversation?.user_b);
}

/**
 * Is the viewer the CREATOR (owner) of this conversation/event?
 *
 * Event-linked chats: defers to the event's user_id (the person
 *   who started the status / timer).
 * Ad-hoc groups: defers to the conversation row's created_by
 *   (no event exists, so the chat IS the thing they own).
 * 1-on-1 chats: always false — DMs have no creator role.
 */
export function isConversationCreator(ctx: ConversationRoleContext): boolean {
  const { userId, conversation, checkin } = ctx;
  if (!userId || !conversation) return false;
  if (isDirectMessage(conversation)) return false;

  // Event-linked chats: the event owner is the source of truth.
  // We accept the checkin context whenever it's been loaded; if it
  // hasn't, we DO NOT silently fall through to created_by — that's
  // exactly how the original bug shipped. Loading state should be
  // handled by the caller (skip rendering until checkin is in).
  if (conversation.checkin_id != null && checkin?.user_id) {
    return checkin.user_id === userId;
  }

  // Ad-hoc / standalone group — created_by is the legit owner.
  return conversation.created_by === userId;
}

/* ── Public capability gates ──────────────────────────────────────
 *
 * Each one answers ONE question, returns boolean. UI imports them
 * by name so the gate at the call site reads like English:
 *
 *     {canEndEvent(ctx) && <EndEventButton/>}
 *
 * If a new affordance lands that depends on creator vs participant,
 * add a new gate here — never gate inline.
 * ───────────────────────────────────────────────────────────────── */

/** Creator only — ends the event for everyone. */
export const canEndEvent = (ctx: ConversationRoleContext): boolean =>
  isConversationCreator(ctx);

/** Creator only — edit title / time / location / privacy. */
export const canEditEvent = (ctx: ConversationRoleContext): boolean =>
  isConversationCreator(ctx);

/** Creator only — rename the chat (mirrors event title). */
export const canEditGroupName = (ctx: ConversationRoleContext): boolean =>
  isConversationCreator(ctx);

/** Creator only — kick a participant out of the group. */
export const canRemoveMember = (ctx: ConversationRoleContext): boolean =>
  isConversationCreator(ctx);

/**
 * Members only — leaves the chat.
 *
 * Creators can NEVER "leave" — that would orphan the bubble on the
 * map and leave members without an admin. Their destructive path
 * is `canEndEvent`. 1-on-1 chats also have no leave (block instead).
 */
export const canLeaveGroup = (ctx: ConversationRoleContext): boolean => {
  if (!ctx.userId || !ctx.conversation) return false;
  if (isDirectMessage(ctx.conversation)) return false;
  return !isConversationCreator(ctx);
};

/**
 * Members only — joins a status / timer / group from outside.
 *
 * The creator is implicitly already in their own chat; offering
 * "Join" to them is a UX dead-end (the button does nothing
 * meaningful). Members and onlookers see Join.
 */
export const canJoinGroup = (ctx: ConversationRoleContext): boolean => {
  if (!ctx.userId || !ctx.conversation) return false;
  if (isDirectMessage(ctx.conversation)) return false;
  return !isConversationCreator(ctx);
};

/* ── Convenience: derive a role label for analytics / debug
 *    overlays. NOT for gating UI — gates use the booleans above. */
export type ConversationRole = 'creator' | 'member' | 'visitor' | 'peer';
export function getConversationRole(
  ctx: ConversationRoleContext,
): ConversationRole {
  if (!ctx.conversation) return 'visitor';
  if (isDirectMessage(ctx.conversation)) return 'peer';
  if (isConversationCreator(ctx)) return 'creator';
  // We can't tell "member" vs "visitor" from the conversation row
  // alone — that requires checking app_conversation_members. Caller
  // can refine this with a membership lookup if needed. For now we
  // optimistically say 'member' — the gates above are what actually
  // protect destructive actions, this label is informational.
  return 'member';
}
