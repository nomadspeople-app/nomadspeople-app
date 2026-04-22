/**
 * chatText — render chat message content with clickable URLs.
 *
 * WHY THIS MODULE EXISTS
 * ──────────────────────
 * Users paste links into conversations constantly ("check this place:
 * https://maps.app.goo.gl/…"). The plain <Text>{msg.content}</Text>
 * previously rendered those links as dead text — no indication they
 * were tappable, no way to open them, forcing the reader to copy-paste
 * manually. Apple reviewers also flag this as a broken interaction on
 * social apps because every competitor (WhatsApp, Telegram, Signal,
 * Messenger, iMessage) makes pasted links tappable.
 *
 * HOW IT WORKS
 * ────────────
 * renderChatContent() splits a string into alternating text / URL
 * spans using a URL regex that matches http and https only (we
 * intentionally do NOT auto-link bare domains like "nomadspeople.com"
 * without a protocol — too many false positives in casual text). Each
 * URL span is rendered as a <Text onPress={...}> that routes through
 * Linking.openURL, which lets the OS open the user's default browser
 * (Safari, Chrome, whatever they've set).
 *
 * SECURITY / ABUSE CONSIDERATIONS
 * ───────────────────────────────
 * - We do NOT fetch OG previews. That would (a) leak the viewer's IP
 *   to any URL a stranger pasted, and (b) open a phishing vector. Any
 *   preview feature would need the server to fetch + the client to
 *   only render a pre-approved thumbnail.
 * - The existing moderation pipeline (lib/moderation) runs on the
 *   raw text BEFORE insert — so link-spam can still be filtered there.
 *   We don't need a second filter at render time.
 * - `Linking.openURL` hands the URL to the OS. iOS / Android both
 *   validate and confirm before opening; we inherit that safety net.
 */

import React from 'react';
import { Text, Linking, type TextStyle, type StyleProp } from 'react-native';

// Matches http(s)://… up to the first whitespace or common
// trailing-sentence punctuation. Intentionally greedy about what
// counts as a URL body (query strings, fragments, parens) so we don't
// chop off half a URL mid-way.
const URL_REGEX = /\bhttps?:\/\/[^\s<>()"']+/gi;

type RenderOpts = {
  baseStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
};

/**
 * Takes a message body and returns an array of <Text> children —
 * plain spans for normal text, pressable spans for URLs. Caller
 * wraps them in its own <Text> container so the whole bubble
 * inherits font / color / size.
 */
export function renderChatContent(
  content: string,
  opts: RenderOpts = {}
): React.ReactNode[] {
  if (!content) return [];

  const { baseStyle, linkStyle } = opts;
  const out: React.ReactNode[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  // Reset the regex state across calls (/g regex keeps lastIndex on
  // the instance; we're safe because URL_REGEX is module-scoped and
  // single-threaded, but being explicit here is cheap insurance).
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(content)) !== null) {
    const url = match[0];
    const start = match.index;

    // Text span BEFORE this URL, if any.
    if (start > lastIndex) {
      out.push(
        <Text key={`t${key++}`} style={baseStyle}>
          {content.slice(lastIndex, start)}
        </Text>
      );
    }

    // The URL itself — tappable, styled distinctly, uses the OS to
    // open. onPress is wrapped in an async IIFE so we can swallow the
    // rare Linking rejection (e.g. a URL the OS can't handle) with a
    // console warning rather than an unhandled promise rejection.
    out.push(
      <Text
        key={`u${key++}`}
        style={[baseStyle, linkStyle]}
        onPress={() => {
          Linking.openURL(url).catch((err) => {
            console.warn('[chatText] openURL failed for', url, err);
          });
        }}
      >
        {url}
      </Text>
    );

    lastIndex = start + url.length;
  }

  // Trailing text span after the last URL.
  if (lastIndex < content.length) {
    out.push(
      <Text key={`t${key++}`} style={baseStyle}>
        {content.slice(lastIndex)}
      </Text>
    );
  }

  // If there were no URLs at all, return the whole string as one span
  // so callers can always rely on the return being at least one node.
  if (out.length === 0) {
    out.push(
      <Text key="t0" style={baseStyle}>
        {content}
      </Text>
    );
  }

  return out;
}
