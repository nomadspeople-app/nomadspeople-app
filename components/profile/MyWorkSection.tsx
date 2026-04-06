import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Linking, Image,
  Keyboard, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useState, useRef, useCallback, useMemo } from 'react';
import NomadIcon from '../NomadIcon';
import type { NomadIconName } from '../NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  jobType: string | null;
  skills: string[] | null;
  openToWork: boolean;
  portfolioUrl: string | null;
  websiteUrl: string | null;
  isOwner: boolean;
  onSave?: (data: {
    job_type?: string | null;
    skills?: string[];
    open_to_work?: boolean;
    portfolio_url?: string | null;
    website_url?: string | null;
  }) => void;
}

const MAX_LINKS = 3;

/* ── Brand detection for link icons ── */
interface BrandInfo {
  icon: string;
  color: string;
  label: string;
  faviconUrl?: string;
}

function detectBrand(url: string): BrandInfo {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com') || lower.includes('instagr.am'))
    return { icon: 'instagram', color: '#E4405F', label: 'Instagram' };
  if (lower.includes('twitter.com') || lower.includes('x.com'))
    return { icon: 'twitter', color: '#1DA1F2', label: 'X / Twitter' };
  if (lower.includes('linkedin.com'))
    return { icon: 'linkedin', color: '#0A66C2', label: 'LinkedIn' };
  if (lower.includes('github.com'))
    return { icon: 'github', color: '#333', label: 'GitHub' };
  if (lower.includes('youtube.com') || lower.includes('youtu.be'))
    return { icon: 'youtube', color: '#FF0000', label: 'YouTube' };
  if (lower.includes('facebook.com') || lower.includes('fb.com'))
    return { icon: 'facebook', color: '#1877F2', label: 'Facebook' };
  if (lower.includes('dribbble.com'))
    return { icon: 'dribbble', color: '#EA4C89', label: 'Dribbble' };
  if (lower.includes('figma.com'))
    return { icon: 'figma', color: '#A259FF', label: 'Figma' };
  if (lower.includes('medium.com'))
    return { icon: 'book-open', color: '#000', label: 'Medium' };
  if (lower.includes('tiktok.com'))
    return { icon: 'music', color: '#000', label: 'TikTok' };
  if (lower.includes('behance.net'))
    return { icon: 'pen-tool', color: '#1769FF', label: 'Behance' };
  if (lower.includes('t.me') || lower.includes('telegram'))
    return { icon: 'send', color: '#0088CC', label: 'Telegram' };

  // Generic website — use favicon
  try {
    const domain = url.replace(/^https?:\/\//, '').split('/')[0];
    return {
      icon: 'globe',
      color: '#555',
      label: domain,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    };
  } catch {
    return { icon: 'link', color: '#555', label: 'Link' };
  }
}

function cleanUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

function getDisplayName(url: string, brand: BrandInfo): string {
  // For known brands, show username if possible
  const clean = cleanUrl(url);
  if (brand.label !== clean.split('/')[0]) {
    // Known brand — try to extract handle
    const parts = clean.split('/').filter(Boolean);
    if (parts.length > 1) {
      const handle = parts[parts.length - 1].replace(/^@/, '');
      if (handle && handle !== '') return `@${handle}`;
    }
    return brand.label;
  }
  // Generic — show cleaned domain/path
  return clean.length > 30 ? clean.slice(0, 30) + '...' : clean;
}

export default function MyWorkSection({
  jobType, skills, openToWork, portfolioUrl, websiteUrl, isOwner, onSave,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editJob, setEditJob] = useState(jobType || '');
  const [editSkills, setEditSkills] = useState((skills || []).join(', '));
  const [editLinks, setEditLinks] = useState<string[]>(() => {
    const links: string[] = [];
    if (portfolioUrl) links.push(portfolioUrl);
    if (websiteUrl && websiteUrl !== portfolioUrl) links.push(websiteUrl);
    while (links.length < MAX_LINKS) links.push('');
    return links.slice(0, MAX_LINKS);
  });
  const [editOpenToWork, setEditOpenToWork] = useState(openToWork);

  const openEdit = useCallback(() => {
    setEditJob(jobType || '');
    setEditSkills((skills || []).join(', '));
    const links: string[] = [];
    if (portfolioUrl) links.push(portfolioUrl);
    if (websiteUrl && websiteUrl !== portfolioUrl) links.push(websiteUrl);
    while (links.length < MAX_LINKS) links.push('');
    setEditLinks(links.slice(0, MAX_LINKS));
    setEditOpenToWork(openToWork);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing(true);
  }, [jobType, skills, portfolioUrl, websiteUrl, openToWork]);

  const cancelEdit = useCallback(() => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing(false);
  }, []);

  const handleSave = useCallback(() => {
    Keyboard.dismiss();
    const parsedSkills = editSkills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const validLinks = editLinks.filter(l => l.trim().length > 0);

    onSave?.({
      job_type: editJob.trim() || null,
      skills: parsedSkills.length > 0 ? parsedSkills : [],
      open_to_work: editOpenToWork,
      portfolio_url: validLinks[0] || null,
      website_url: validLinks[1] || null,
    });

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing(false);
  }, [editJob, editSkills, editLinks, editOpenToWork, onSave]);

  const updateLink = (idx: number, val: string) => {
    const copy = [...editLinks];
    copy[idx] = val;
    setEditLinks(copy);
  };

  const clearLink = (idx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const copy = [...editLinks];
    copy[idx] = '';
    setEditLinks(copy);
  };

  // Hide for visitors if nothing to show — MUST be after all hooks
  const hasContent = jobType || (skills && skills.length > 0) || portfolioUrl || websiteUrl;
  if (!hasContent && !isOwner) return null;

  /* ── EDIT MODE ── */
  if (editing) {
    return (
      <View style={st.card}>
        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            <NomadIcon name="briefcase" size={s(6)} color="#1A1A1A" strokeWidth={1.6} />
            <Text style={st.headerTitle}>{t('profile.myWork')}</Text>
          </View>
          <TouchableOpacity onPress={cancelEdit} activeOpacity={0.7}>
            <NomadIcon name="close" size={s(6)} color={colors.textMuted} strokeWidth={1.6} />
          </TouchableOpacity>
        </View>

        {/* Job title */}
        <Text style={st.fieldLabel}>{t('profile.jobTitleLabel')}</Text>
        <TextInput
          style={st.fieldInput}
          value={editJob}
          onChangeText={setEditJob}
          placeholder="e.g. Full-Stack Developer"
          placeholderTextColor="#bbb"
          maxLength={60}
          returnKeyType="done"
        />

        {/* Skills */}
        <Text style={st.fieldLabel}>{t('profile.skillsLabel')}</Text>
        <TextInput
          style={st.fieldInput}
          value={editSkills}
          onChangeText={setEditSkills}
          placeholder="React, TypeScript, Design..."
          placeholderTextColor="#bbb"
          maxLength={120}
          returnKeyType="done"
        />

        {/* Links (3 slots) */}
        <Text style={st.fieldLabel}>{t('profile.linksLabel')}</Text>
        {editLinks.map((link, i) => {
          const hasValue = link.trim().length > 0;
          const brand = hasValue ? detectBrand(link) : null;
          return (
            <View key={i} style={st.linkInputRow}>
              {brand ? (
                <NomadIcon name={brand.icon as NomadIconName} size={18} color={brand.color} strokeWidth={1.6} />
              ) : (
                <NomadIcon name="link" size={18} color="#ccc" strokeWidth={1.6} />
              )}
              <TextInput
                style={st.linkInput}
                value={link}
                onChangeText={(v) => updateLink(i, v)}
                placeholder={i === 0 ? 'instagram.com/you' : i === 1 ? 'yoursite.com' : 'Any link...'}
                placeholderTextColor="#ccc"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
              />
              {hasValue && (
                <TouchableOpacity onPress={() => clearLink(i)} style={st.linkClearBtn} activeOpacity={0.7}>
                  <NomadIcon name="x-circle" size={18} color="#ccc" strokeWidth={1.6} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Open to work toggle */}
        <TouchableOpacity
          style={[st.toggleRow, editOpenToWork && st.toggleActive]}
          onPress={() => setEditOpenToWork(!editOpenToWork)}
          activeOpacity={0.7}
        >
          <View style={[st.toggleDot, editOpenToWork && st.toggleDotActive]} />
          <Text style={[st.toggleText, editOpenToWork && st.toggleTextActive]}>
            {t('profile.openToWork')}
          </Text>
        </TouchableOpacity>

        {/* Save / Cancel */}
        <View style={st.editActions}>
          <TouchableOpacity style={st.cancelBtn} onPress={cancelEdit} activeOpacity={0.7}>
            <Text style={st.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.saveBtn} onPress={handleSave} activeOpacity={0.8}>
            <Text style={st.saveText}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── DISPLAY MODE ── */
  const allLinks = [portfolioUrl, websiteUrl].filter(Boolean) as string[];

  return (
    <View style={st.card}>
      <View style={st.headerRow}>
        <View style={st.headerLeft}>
          <NomadIcon name="briefcase" size={s(6)} color="#1A1A1A" strokeWidth={1.6} />
          <Text style={st.headerTitle}>{t('profile.myWork')}</Text>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={openEdit} activeOpacity={0.7}>
            <NomadIcon name="edit" size={s(5)} color={colors.textMuted} strokeWidth={1.6} />
          </TouchableOpacity>
        )}
      </View>

      {/* Open to work badge */}
      {openToWork && (
        <View style={st.openBadge}>
          <View style={st.openDot} />
          <Text style={st.openText}>{t('profile.openToWork')}</Text>
        </View>
      )}

      {/* Job title */}
      {jobType ? (
        <Text style={st.jobTitle}>{jobType}</Text>
      ) : isOwner ? (
        <TouchableOpacity onPress={openEdit} activeOpacity={0.7}>
          <Text style={st.addJobText}>{t('profile.addJobTitle')}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Skills */}
      {skills && skills.length > 0 && (
        <View style={st.skillsRow}>
          {skills.map((skill, i) => (
            <View key={i} style={st.skillChip}>
              <Text style={st.skillText}>{skill}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Links — with brand icons and clean display */}
      {allLinks.length > 0 && (
        <View style={st.linksContainer}>
          {allLinks.map((url, i) => {
            const brand = detectBrand(url);
            const displayName = getDisplayName(url, brand);
            return (
              <TouchableOpacity
                key={i}
                style={st.linkCard}
                activeOpacity={0.7}
                onPress={() => {
                  const full = url.startsWith('http') ? url : `https://${url}`;
                  Linking.openURL(full).catch(() => {});
                }}
              >
                <View style={[st.linkIconWrap, { backgroundColor: brand.color + '14' }]}>
                  {brand.faviconUrl ? (
                    <Image
                      source={{ uri: brand.faviconUrl }}
                      style={st.linkFavicon}
                      defaultSource={undefined}
                    />
                  ) : (
                    <NomadIcon name={brand.icon as NomadIconName} size={18} color={brand.color} strokeWidth={1.6} />
                  )}
                </View>
                <View style={st.linkTextCol}>
                  <Text style={st.linkLabel}>{brand.label}</Text>
                  <Text style={st.linkHandle} numberOfLines={1}>{displayName}</Text>
                </View>
                <NomadIcon name="external-link" size={14} color="#ccc" strokeWidth={1.4} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Empty state for owner */}
      {!hasContent && isOwner && (
        <TouchableOpacity style={st.emptyRow} activeOpacity={0.7} onPress={openEdit}>
          <NomadIcon name="plus-circle" size={s(6)} color={colors.textMuted} strokeWidth={1.6} />
          <Text style={st.emptyText}>{t('profile.addWorkInfo')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    marginHorizontal: s(8), marginTop: s(4),
    backgroundColor: c.card, borderRadius: s(10), padding: s(6),
    borderWidth: 0.5, borderColor: c.borderSoft,
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1) },
    shadowOpacity: 0.04, shadowRadius: s(4),
  },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(4) },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  headerTitle: { fontSize: s(7), fontWeight: FW.extra, color: c.dark },

  /* Open to work */
  openBadge: {
    flexDirection: 'row', alignItems: 'center', gap: s(2),
    backgroundColor: 'rgba(16,185,129,0.1)', alignSelf: 'flex-start',
    paddingHorizontal: s(4), paddingVertical: s(2),
    borderRadius: s(6), marginBottom: s(3),
  },
  openDot: { width: s(3), height: s(3), borderRadius: s(1.5), backgroundColor: '#10B981' },
  openText: { fontSize: s(5), fontWeight: FW.bold, color: '#10B981' },

  jobTitle: { fontSize: s(7), fontWeight: FW.bold, color: c.dark, marginBottom: s(3) },
  addJobText: { fontSize: s(6), color: c.textMuted, fontStyle: 'italic', marginBottom: s(3) },

  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(2.5), marginBottom: s(3) },
  skillChip: {
    backgroundColor: c.surface, borderRadius: s(6),
    paddingHorizontal: s(4), paddingVertical: s(2),
    borderWidth: 0.5, borderColor: c.borderSoft,
  },
  skillText: { fontSize: s(4.5), fontWeight: FW.medium, color: c.textSec },

  /* Links display — card style */
  linksContainer: { gap: s(2.5), marginTop: s(2) },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: s(3.5),
    backgroundColor: c.surface, borderRadius: 14,
    paddingHorizontal: s(4), paddingVertical: s(3.5),
    borderWidth: 1, borderColor: c.borderSoft,
  },
  linkIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  linkFavicon: { width: 20, height: 20, borderRadius: 4 },
  linkTextCol: { flex: 1 },
  linkLabel: { fontSize: 13, fontWeight: FW.bold, color: c.dark },
  linkHandle: { fontSize: 12, color: c.textMuted, marginTop: 1 },

  emptyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: s(3), paddingVertical: s(5),
  },
  emptyText: { fontSize: s(5.5), color: c.textMuted },

  /* ── Edit mode ── */
  fieldLabel: {
    fontSize: 12, fontWeight: FW.semi, color: c.textMuted,
    marginBottom: 6, marginTop: 14,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: c.surface, borderRadius: 14,
    paddingHorizontal: 16, height: 52,
    fontSize: 15, fontWeight: FW.medium, color: c.dark,
    borderWidth: 1.5, borderColor: c.borderSoft,
  },

  /* Link input rows — bigger and more touch-friendly */
  linkInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.surface, borderRadius: 14,
    paddingHorizontal: 14, height: 52,
    borderWidth: 1.5, borderColor: c.borderSoft,
    marginBottom: 8,
  },
  linkInput: {
    flex: 1, fontSize: 15, fontWeight: FW.medium, color: c.dark,
    padding: 0, margin: 0,
  },
  linkClearBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    backgroundColor: c.surface, borderRadius: 14,
    paddingHorizontal: 16, height: 52,
    marginTop: 16, borderWidth: 1.5, borderColor: c.borderSoft,
  },
  toggleActive: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: '#10B981' },
  toggleDot: { width: s(4), height: s(4), borderRadius: s(2), backgroundColor: c.textFaint },
  toggleDotActive: { backgroundColor: '#10B981' },
  toggleText: { fontSize: 15, fontWeight: FW.medium, color: c.textSec },
  toggleTextActive: { color: '#10B981', fontWeight: FW.bold },

  editActions: {
    flexDirection: 'row', gap: 10, marginTop: 20,
  },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 14, backgroundColor: c.surface,
  },
  cancelText: { fontSize: 15, fontWeight: FW.semi, color: c.textSec },
  saveBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 14, backgroundColor: c.primary,
  },
  saveText: { fontSize: 15, fontWeight: FW.bold, color: c.white },
});
