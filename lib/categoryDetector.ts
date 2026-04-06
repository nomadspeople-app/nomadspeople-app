/**
 * categoryDetector — keyword-based auto-tagging
 *
 * Scans free text and returns all matching category icons.
 * No AI, no API calls — runs locally from a static keyword map.
 * Supports Hebrew + English.
 */

export interface DetectedCategory {
  key: string;
  emoji: string;
  label: string;
}

type Entry = { emoji: string; label: string; keywords: string[] };

const CATEGORY_MAP: Record<string, Entry> = {
  coffee: {
    emoji: '☕',
    label: 'coffee',
    keywords: [
      'coffee', 'cafe', 'café', 'espresso', 'latte', 'cappuccino', 'americano', 'macchiato', 'mocha',
      'קפה', 'קפוצ', 'אספרסו', 'לאטה', 'קפוצינו',
    ],
  },
  work: {
    emoji: '💻',
    label: 'work',
    keywords: [
      'work', 'working', 'laptop', 'coding', 'code', 'cowork', 'coworking', 'co-working', 'office', 'meeting', 'calls', 'zoom', 'remote',
      'עבודה', 'לעבוד', 'עובד', 'עובדת', 'מחשב', 'לפטופ', 'קודינג', 'ישיבה', 'זום', 'משרד',
    ],
  },
  food: {
    emoji: '🍽️',
    label: 'food',
    keywords: [
      'food', 'eat', 'eating', 'lunch', 'dinner', 'breakfast', 'brunch', 'restaurant', 'sushi', 'pizza', 'burger', 'pasta', 'ramen', 'falafel', 'hummus', 'steak', 'salad', 'meal',
      'אוכל', 'לאכול', 'ארוחה', 'צהריים', 'ערב', 'בוקר', 'מסעדה', 'סושי', 'פיצה', 'המבורגר', 'פלאפל', 'חומוס', 'בראנץ',
    ],
  },
  bar: {
    emoji: '🍺',
    label: 'bar',
    keywords: [
      'bar', 'beer', 'beers', 'drinks', 'drinking', 'cocktail', 'cocktails', 'wine', 'pub', 'happy hour', 'shots',
      'בירה', 'בר', 'לשתות', 'שתייה', 'קוקטייל', 'יין', 'פאב', 'משקאות',
    ],
  },
  beach: {
    emoji: '🏖',
    label: 'beach',
    keywords: [
      'beach', 'sea', 'ocean', 'swim', 'swimming', 'sand', 'tan', 'tanning', 'sunbathe', 'shore', 'waves',
      'חוף', 'ים', 'שחייה', 'לשחות', 'חול', 'גלים', 'שיזוף',
    ],
  },
  sport: {
    emoji: '🏃',
    label: 'sport',
    keywords: [
      'sport', 'gym', 'fitness', 'run', 'running', 'jog', 'jogging', 'workout', 'crossfit', 'yoga', 'surf', 'surfing', 'climbing', 'hike', 'hiking', 'bike', 'cycling', 'tennis', 'football', 'soccer', 'basketball', 'boxing', 'martial',
      'ספורט', 'חדר כושר', 'כושר', 'ריצה', 'לרוץ', 'יוגה', 'גלישה', 'לגלוש', 'טיול', 'אופניים', 'טניס', 'כדורגל', 'כדורסל', 'אגרוף',
    ],
  },
  nightlife: {
    emoji: '🎉',
    label: 'nightlife',
    keywords: [
      'party', 'parties', 'club', 'clubbing', 'nightlife', 'dance', 'dancing', 'dj', 'rave', 'night out',
      'מסיבה', 'מועדון', 'לרקוד', 'ריקודים', 'לילה', 'מוזיקה',
    ],
  },
  sightseeing: {
    emoji: '🗿',
    label: 'sightseeing',
    keywords: [
      'sightseeing', 'tourist', 'tour', 'explore', 'exploring', 'museum', 'temple', 'landmark', 'monument', 'ruins', 'palace', 'castle', 'market',
      'סיור', 'תיירות', 'מוזיאון', 'מקדש', 'שוק', 'טיול', 'לטייל',
    ],
  },
  shopping: {
    emoji: '🛍️',
    label: 'shopping',
    keywords: [
      'shop', 'shopping', 'mall', 'buy', 'buying', 'store', 'boutique',
      'קניות', 'לקנות', 'קניון', 'חנות',
    ],
  },
  wellness: {
    emoji: '🧘',
    label: 'wellness',
    keywords: [
      'spa', 'massage', 'meditation', 'meditate', 'relax', 'relaxing', 'sauna', 'retreat', 'mindfulness', 'breathwork',
      'ספא', 'עיסוי', 'מדיטציה', 'להירגע', 'רגיעה',
    ],
  },
  social: {
    emoji: '💬',
    label: 'social',
    keywords: [
      'hangout', 'hang out', 'chill', 'chilling', 'meetup', 'meet up', 'catch up', 'chat', 'talk', 'friends',
      'לבלות', 'בילוי', 'לפגוש', 'מפגש', 'צאט', 'חברים', 'לדבר',
    ],
  },
  entertainment: {
    emoji: '🎬',
    label: 'entertainment',
    keywords: [
      'movie', 'movies', 'cinema', 'film', 'show', 'concert', 'theater', 'theatre', 'comedy', 'live music', 'game', 'games', 'gaming',
      'סרט', 'קולנוע', 'הופעה', 'תיאטרון', 'קומדי', 'משחק',
    ],
  },
  rideshare: {
    emoji: '🚗',
    label: 'rideshare',
    keywords: [
      'ride', 'carpool', 'taxi', 'uber', 'grab', 'bolt', 'drive', 'driving', 'road trip', 'airport',
      'נסיעה', 'טרמפ', 'מונית', 'נהיגה', 'שדה תעופה',
    ],
  },
};

/**
 * Detect categories from free text.
 * Returns array of matched categories (can be multiple).
 * The primary/manual category is NOT included — caller merges.
 */
export function detectCategories(text: string): DetectedCategory[] {
  if (!text || text.length < 2) return [];

  const lower = text.toLowerCase();
  const matched: DetectedCategory[] = [];
  const seen = new Set<string>();

  for (const [key, entry] of Object.entries(CATEGORY_MAP)) {
    if (seen.has(key)) continue;

    for (const kw of entry.keywords) {
      // Word-boundary-ish match: check the keyword exists in the text
      // For multi-word keywords (like "hang out"), check directly
      // For single words, ensure it's not part of a larger word
      if (kw.includes(' ')) {
        if (lower.includes(kw)) {
          matched.push({ key, emoji: entry.emoji, label: entry.label });
          seen.add(key);
          break;
        }
      } else {
        // Simple word boundary: keyword surrounded by non-alphanumeric or start/end
        const regex = new RegExp(`(?:^|[\\s,.:;!?()\\-])${escapeRegex(kw)}(?:$|[\\s,.:;!?()\\-])`, 'i');
        if (regex.test(lower) || lower === kw) {
          matched.push({ key, emoji: entry.emoji, label: entry.label });
          seen.add(key);
          break;
        }
        // Also check for Hebrew where words connect differently
        if (/[\u0590-\u05FF]/.test(kw) && lower.includes(kw)) {
          matched.push({ key, emoji: entry.emoji, label: entry.label });
          seen.add(key);
          break;
        }
      }
    }
  }

  return matched;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
