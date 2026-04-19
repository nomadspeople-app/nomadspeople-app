# 2026-04-19 — Auto end-of-event system messages (DB migration)

## What this migration does

When a status or a timer expires naturally (its `expires_at < now()`),
the `cleanup_checkins()` cron job now **posts a system message into the
linked chat** in the same atomic statement that flips `is_active` to
`false`. Members see the closure in the chat; the afterglow remains
usable (chat survives, only the pin disappears).

Copy:

| checkin_type | Content           |
|--------------|-------------------|
| `timer`      | `⏰ Timer ended`   |
| anything else (`status` / null / etc.) | `🏁 Event ended` |

## Why the cron, not the client

Natural expiry happens in the DB with no app-side code — the cron
flips `is_active=false`. Previously the client only posted the
`❌ Cancelled` message on **manual** cancel paths. Natural expiry
silently killed the pin with no chat notice. This migration closes
that loop at the place the state actually changes.

## Why this doesn't double-post on manual cancels

Manual cancels (Cancel Timer, Cancel Event, End Event) flip
`is_active=false` **from the client** before the cron sees the row.
By the time the cron runs, the row no longer matches the
`WHERE is_active = true` filter in the CTE. The client's own
`❌ Cancelled` message is the only one posted. No duplicates.

## Why SECURITY DEFINER

The cron has no `auth.uid()` context, so the RLS policy
`messages_insert` (`sender_id = auth.uid()`) would block the insert.
`SECURITY DEFINER` runs the function as its owner (postgres), which
owns `app_messages` and therefore bypasses RLS. The `sender_id` we
set is the checkin owner's user_id, so the message still renders in
the UI as authored by the event creator.

## Cron consolidation

Two cron jobs used to flip `is_active=false`:

- `expire-old-checkins` (jobid=5, every 5 min) — raw UPDATE, no message
- `cleanup-expired-checkins` (jobid=6, every 1 min) — `cleanup_checkins()`

If the 5-min job ran first, it would steal the message window from
the function and post nothing. Jobid=5 was unscheduled; the
1-minute job is the single source of truth.

## SQL (for reference — already applied to prod)

```sql
CREATE OR REPLACE FUNCTION public.cleanup_checkins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  WITH expired AS (
    UPDATE app_checkins
    SET is_active = false
    WHERE is_active = true
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id, user_id, checkin_type
  )
  INSERT INTO app_messages (conversation_id, sender_id, content)
  SELECT c.id,
         e.user_id,
         CASE e.checkin_type
           WHEN 'timer' THEN '⏰ Timer ended'
           ELSE '🏁 Event ended'
         END
  FROM expired e
  JOIN app_conversations c ON c.checkin_id = e.id;

  DELETE FROM app_checkins
  WHERE is_active = false
    AND checked_in_at < NOW() - INTERVAL '7 days';
END;
$function$;

SELECT cron.unschedule('expire-old-checkins')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-old-checkins');
```

## Verification (done live in the session)

1. Inserted a `timer` checkin with `expires_at = now() - 30s` and a
   linked conversation. Ran `SELECT cleanup_checkins()` → message
   `⏰ Timer ended` appeared in `app_messages` with `sender_id` =
   the owner.
2. Same for a `status` checkin → message `🏁 Event ended`.
3. Cleaned up test rows.
