import { View, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { s } from '../../lib/theme';

/**
 * SocialIconRow — circular brand icons under the avatar that link out
 * to the user's social profiles. Uses Google's favicon service so we
 * don't need to bundle SVG logos for every platform; the icon stays
 * recognizable (Instagram pink, TikTok black, LinkedIn blue, etc.).
 */
interface Props {
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  linkedinHandle?: string | null;
  websiteUrl?: string | null;
}

interface SocialItem {
  url: string;
  faviconDomain: string;
  label: string;
}

function buildItems(p: Props): SocialItem[] {
  const items: SocialItem[] = [];

  if (p.instagramHandle && p.instagramHandle.trim()) {
    const h = p.instagramHandle.trim().replace(/^@/, '');
    items.push({
      url: `https://instagram.com/${h}`,
      faviconDomain: 'instagram.com',
      label: `@${h} on Instagram`,
    });
  }

  if (p.tiktokHandle && p.tiktokHandle.trim()) {
    const h = p.tiktokHandle.trim().replace(/^@/, '');
    items.push({
      url: `https://tiktok.com/@${h}`,
      faviconDomain: 'tiktok.com',
      label: `@${h} on TikTok`,
    });
  }

  if (p.linkedinHandle && p.linkedinHandle.trim()) {
    const h = p.linkedinHandle.trim().replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/^in\//, '').replace(/^\//, '');
    items.push({
      url: `https://linkedin.com/in/${h}`,
      faviconDomain: 'linkedin.com',
      label: `${h} on LinkedIn`,
    });
  }

  if (p.websiteUrl && p.websiteUrl.trim()) {
    const raw = p.websiteUrl.trim();
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let domain = url.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./, '');
    items.push({
      url,
      faviconDomain: domain,
      label: domain,
    });
  }

  return items;
}

export default function SocialIconRow(p: Props) {
  const items = buildItems(p);
  if (items.length === 0) return null;

  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <TouchableOpacity
          key={item.faviconDomain + i}
          style={styles.iconWrap}
          activeOpacity={0.6}
          onPress={() => Linking.openURL(item.url).catch(() => {})}
          accessibilityLabel={item.label}
          accessibilityRole="link"
        >
          <Image
            source={{ uri: `https://www.google.com/s2/favicons?domain=${item.faviconDomain}&sz=128` }}
            style={styles.icon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const ICON_SIZE = s(16);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: s(4),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: s(4),
    marginBottom: s(2),
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    width: ICON_SIZE * 0.65,
    height: ICON_SIZE * 0.65,
  },
});
