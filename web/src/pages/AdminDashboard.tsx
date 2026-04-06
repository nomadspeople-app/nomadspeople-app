import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, ADMIN_USER_ID } from '../lib/supabase'
import {
  Users, Activity, MessageCircle, MapPin, Eye, TrendingUp,
  Shield, AlertTriangle, Search, Ban, UserCheck, RefreshCw, LogOut
} from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'

interface Stats {
  totalUsers: number
  activeCheckins: number
  totalMessages: number
  totalFollows: number
  profileViews: number
  totalReports: number
}

interface UserProfile {
  id: string
  user_id: string
  full_name: string
  username: string
  avatar_url: string | null
  current_city: string | null
  home_country: string | null
  job_type: string | null
  created_at: string
  last_active_at: string | null
  onboarding_done: boolean
  snooze_mode: boolean | null
  is_premium: boolean | null
}

interface Report {
  id: string
  message_id: string
  reporter_id: string
  reason: string
  created_at: string
}

type Tab = 'overview' | 'users' | 'reports' | 'activity'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeCheckins: 0, totalMessages: 0, totalFollows: 0, profileViews: 0, totalReports: 0 })
  const [users, setUsers] = useState<UserProfile[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [cityData, setCityData] = useState<{ city: string; count: number }[]>([])
  const [activityData, setActivityData] = useState<{ action: string; count: number }[]>([])

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/admin/login')
        return
      }
      // Check if admin
      if (data.session.user.id !== ADMIN_USER_ID) {
        alert('Unauthorized. Only admins can access this page.')
        navigate('/')
        return
      }
      setAuthed(true)
      setLoading(false)
    })
  }, [navigate])

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!authed) return

    // Stats
    const [usersRes, checkinsRes, messagesRes, followsRes, viewsRes, reportsRes] = await Promise.all([
      supabase.from('app_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('app_checkins').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('app_messages').select('id', { count: 'exact', head: true }),
      supabase.from('app_follows').select('follower_id', { count: 'exact', head: true }),
      supabase.from('app_profile_views').select('id', { count: 'exact', head: true }),
      supabase.from('app_message_reports').select('id', { count: 'exact', head: true }),
    ])
    setStats({
      totalUsers: usersRes.count || 0,
      activeCheckins: checkinsRes.count || 0,
      totalMessages: messagesRes.count || 0,
      totalFollows: followsRes.count || 0,
      profileViews: viewsRes.count || 0,
      totalReports: reportsRes.count || 0,
    })

    // Users
    const { data: usersData } = await supabase.from('app_profiles')
      .select('id, user_id, full_name, username, avatar_url, current_city, home_country, job_type, created_at, last_active_at, onboarding_done, snooze_mode, is_premium')
      .order('created_at', { ascending: false })
    setUsers((usersData as UserProfile[]) || [])

    // Reports
    const { data: reportsData } = await supabase.from('app_message_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setReports((reportsData as Report[]) || [])

    // City distribution
    const { data: checkins } = await supabase.from('app_checkins')
      .select('city')
      .eq('is_active', true)
    if (checkins) {
      const cityMap = new Map<string, number>()
      checkins.forEach((c: any) => {
        const city = c.city || 'Unknown'
        cityMap.set(city, (cityMap.get(city) || 0) + 1)
      })
      setCityData(Array.from(cityMap.entries()).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count))
    }

    // Activity tracking data
    const { data: activityRaw } = await supabase.from('user_activity')
      .select('action')
      .limit(1000)
    if (activityRaw) {
      const actionMap = new Map<string, number>()
      activityRaw.forEach((a: any) => {
        actionMap.set(a.action, (actionMap.get(a.action) || 0) + 1)
      })
      setActivityData(Array.from(actionMap.entries()).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count))
    }
  }, [authed])

  useEffect(() => { fetchData() }, [fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  if (loading) return <div style={s.loadWrap}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
  if (!authed) return null

  const filteredUsers = searchQuery
    ? users.filter(u =>
        (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.current_city || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users

  return (
    <div style={s.wrap}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <span style={s.sidebarLogo}>nomadspeople</span>
        <span style={s.sidebarSub}>Admin</span>
        <div style={s.sidebarNav}>
          {([
            ['overview', 'Overview', <TrendingUp size={18} />],
            ['users', 'Users', <Users size={18} />],
            ['reports', 'Reports', <AlertTriangle size={18} />],
            ['activity', 'Activity', <Activity size={18} />],
          ] as [Tab, string, React.ReactNode][]).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{ ...s.sidebarItem, ...(tab === key ? s.sidebarItemActive : {}) }}
            >
              {icon} {label}
            </button>
          ))}
        </div>
        <button onClick={handleLogout} style={s.logoutBtn}>
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {/* ── Overview Tab ── */}
        {tab === 'overview' && (
          <>
            <h1 style={s.pageTitle}>Dashboard Overview</h1>
            <div style={s.statGrid}>
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: <Users size={20} />, color: '#E8614D' },
                { label: 'Active Now', value: stats.activeCheckins, icon: <MapPin size={20} />, color: '#4ADE80' },
                { label: 'Messages', value: stats.totalMessages, icon: <MessageCircle size={20} />, color: '#3B82F6' },
                { label: 'Follows', value: stats.totalFollows, icon: <UserCheck size={20} />, color: '#8B5CF6' },
                { label: 'Profile Views', value: stats.profileViews, icon: <Eye size={20} />, color: '#F59E0B' },
                { label: 'Reports', value: stats.totalReports, icon: <Shield size={20} />, color: '#EF4444' },
              ].map((st, i) => (
                <div key={i} style={s.statCard}>
                  <div style={{ ...s.statIcon, background: st.color + '15', color: st.color }}>{st.icon}</div>
                  <div>
                    <div style={s.statValue}>{st.value}</div>
                    <div style={s.statLabel}>{st.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div style={s.chartRow}>
              <div style={s.chartCard}>
                <h3 style={s.chartTitle}>Active Checkins by City</h3>
                {cityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={cityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="city" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#E8614D" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>No data yet</p>}
              </div>

              <div style={s.chartCard}>
                <h3 style={s.chartTitle}>User Actions Tracked</h3>
                {activityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={activityData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis dataKey="action" type="category" fontSize={11} width={120} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>No activity tracked yet. Use the app to generate data.</p>}
              </div>
            </div>
          </>
        )}

        {/* ── Users Tab ── */}
        {tab === 'users' && (
          <>
            <div style={s.headerRow}>
              <h1 style={s.pageTitle}>Users ({users.length})</h1>
              <div style={s.searchWrap}>
                <Search size={16} color="#999" />
                <input
                  style={s.searchInput}
                  placeholder="Search by name, username, or city..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>User</th>
                    <th style={s.th}>City</th>
                    <th style={s.th}>Country</th>
                    <th style={s.th}>Job</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Joined</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} style={s.tr}>
                      <td style={s.td}>
                        <div style={s.userCell}>
                          <div style={s.avatar}>
                            {u.avatar_url
                              ? <img src={u.avatar_url} alt="" style={s.avatarImg} />
                              : <span>{(u.full_name || '?')[0]}</span>
                            }
                          </div>
                          <div>
                            <div style={s.userName}>{u.full_name || '—'}</div>
                            <div style={s.userHandle}>@{u.username || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={s.td}>{u.current_city || '—'}</td>
                      <td style={s.td}>{u.home_country || '—'}</td>
                      <td style={s.td}>{u.job_type || '—'}</td>
                      <td style={s.td}>
                        <span style={{
                          ...s.badge,
                          background: u.snooze_mode ? '#FEF3C7' : u.onboarding_done ? '#D1FAE5' : '#FEE2E2',
                          color: u.snooze_mode ? '#92400E' : u.onboarding_done ? '#065F46' : '#991B1B',
                        }}>
                          {u.snooze_mode ? 'Snoozed' : u.onboarding_done ? 'Active' : 'Pending'}
                        </span>
                        {u.is_premium && <span style={{ ...s.badge, background: '#EDE9FE', color: '#5B21B6', marginLeft: 4 }}>Pro</span>}
                      </td>
                      <td style={s.tdDate}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={s.td}>
                        <button style={s.actionBtn} title="Ban user"><Ban size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Reports Tab ── */}
        {tab === 'reports' && (
          <>
            <h1 style={s.pageTitle}>Reports ({reports.length})</h1>
            {reports.length === 0
              ? <div style={s.emptyState}><Shield size={48} color="#ddd" /><p>No reports yet. That's a good thing!</p></div>
              : (
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Reporter</th>
                        <th style={s.th}>Reason</th>
                        <th style={s.th}>Date</th>
                        <th style={s.th}>Message ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map(r => (
                        <tr key={r.id} style={s.tr}>
                          <td style={s.td}>{r.reporter_id.slice(0, 8)}...</td>
                          <td style={s.td}>{r.reason}</td>
                          <td style={s.tdDate}>{new Date(r.created_at).toLocaleDateString()}</td>
                          <td style={s.td}>{r.message_id.slice(0, 8)}...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}

        {/* ── Activity Tab ── */}
        {tab === 'activity' && (
          <>
            <h1 style={s.pageTitle}>User Activity Tracking</h1>
            <p style={{ color: '#888', marginBottom: 24 }}>
              Real-time behavioral data collected from the app. This powers the matching engine and recommendations.
            </p>
            {activityData.length > 0 ? (
              <div style={s.chartCard}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="action" fontSize={11} angle={-45} textAnchor="end" height={80} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div style={s.emptyState}><Activity size={48} color="#ddd" /><p>No activity tracked yet. Use the app to generate behavioral data.</p></div>}
          </>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  loadWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  wrap: { display: 'flex', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", background: '#F7F7F5' },

  // Sidebar
  sidebar: { width: 220, background: '#1A1A1A', color: '#fff', padding: '24px 16px', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0 },
  sidebarLogo: { fontSize: 18, fontWeight: 800, letterSpacing: -0.5, marginBottom: 2 },
  sidebarSub: { fontSize: 11, color: '#666', marginBottom: 32, textTransform: 'uppercase', letterSpacing: 1 },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  sidebarItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#999', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left' },
  sidebarItemActive: { background: '#333', color: '#fff' },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#666', fontSize: 13, cursor: 'pointer' },

  // Main
  main: { flex: 1, marginLeft: 220, padding: '32px 40px' },
  pageTitle: { fontSize: 28, fontWeight: 800, marginBottom: 24, letterSpacing: -0.5 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },

  // Stats
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 },
  statCard: { background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 16 },
  statIcon: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: 800 },
  statLabel: { fontSize: 13, color: '#999', fontWeight: 500 },

  // Charts
  chartRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 },
  chartCard: { background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #eee' },
  chartTitle: { fontSize: 16, fontWeight: 700, marginBottom: 16 },

  // Search
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '8px 14px' },
  searchInput: { border: 'none', outline: 'none', fontSize: 14, width: 260, background: 'transparent' },

  // Table
  tableWrap: { background: '#fff', borderRadius: 14, border: '1px solid #eee', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #eee' },
  tr: { borderBottom: '1px solid #f5f5f5' },
  td: { padding: '12px 16px', fontSize: 14 },
  tdDate: { padding: '12px 16px', fontSize: 13, color: '#999' },

  // User cell
  userCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, background: '#E8614D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  userName: { fontSize: 14, fontWeight: 600 },
  userHandle: { fontSize: 12, color: '#999' },

  // Badge
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600 },

  // Action button
  actionBtn: { padding: '6px 8px', border: '1px solid #eee', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#999' },

  // Empty
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#999' },
}
