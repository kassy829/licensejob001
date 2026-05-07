import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiff } from '../hooks/useLiff';

const API = process.env.REACT_APP_API_URL;
const LIFF_ID = process.env.REACT_APP_LIFF_ID_MYPAGE;

const STATUS_LABEL = {
  pending: '受付中',
  contacted: '担当者が連絡済み',
  recommended: '推薦状発行済み',
  rejected: '不採用',
  hired: '採用決定 🎉',
};

const STATUS_COLOR = {
  pending: '#888',
  contacted: '#2196F3',
  recommended: '#FF9800',
  rejected: '#e53e3e',
  hired: '#1DB446',
};

export default function MyPage() {
  const { ready, profile, error } = useLiff(LIFF_ID);
  const navigate = useNavigate();
  const [tab, setTab] = useState('applications');
  const [applications, setApplications] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || !profile) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/applications/user/${profile.userId}`).then((r) => r.json()),
      fetch(`${API}/api/users/${profile.userId}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([apps, u]) => { setApplications(apps); setUser(u); })
      .finally(() => setLoading(false));
  }, [ready, profile]);

  if (error) return <div style={styles.center}>初期化に失敗しました</div>;
  if (!ready) return <div style={styles.center}>読み込み中...</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <img src={profile?.pictureUrl} alt="" style={styles.avatar} />
        <div>
          <div style={styles.name}>{profile?.displayName}</div>
          <div style={styles.userType}>{user ? (user.user_type === 'student' ? '在校生' : '卒業生・OB') : '未登録'}</div>
        </div>
      </header>

      <div style={styles.tabs}>
        {[['applications', '応募状況'], ['info', '在校生登録'], ['events', '説明会'], ['contact', 'お問い合わせ']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={tab === key ? styles.tabActive : styles.tab}>
            {label}
          </button>
        ))}
      </div>

      <div style={styles.body}>
        {tab === 'applications' && (
          loading ? <div style={styles.center}>読み込み中...</div> :
          applications.length === 0 ? (
            <div style={styles.empty}>
              <p>まだ応募履歴がありません</p>
              <button style={styles.linkBtn} onClick={() => {/* LIFFを別ウィンドウで開く */ window.location.href = '/'}}>
                求人を探す
              </button>
            </div>
          ) : (
            <ul style={styles.list}>
              {applications.map((app) => (
                <li key={app.id} style={styles.card}>
                  <div style={styles.appCompany}>{app.company_name}</div>
                  <div style={styles.appTitle}>{app.job_title}</div>
                  <div style={{ ...styles.statusBadge, color: STATUS_COLOR[app.status], borderColor: STATUS_COLOR[app.status] }}>
                    {STATUS_LABEL[app.status]}
                  </div>
                  <div style={styles.appDate}>{new Date(app.created_at).toLocaleDateString('ja-JP')} 応募</div>
                  {app.staff_note && <div style={styles.staffNote}>担当メモ: {app.staff_note}</div>}
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'info' && (
          <div style={styles.card}>
            {user ? (
              <>
                <h2 style={styles.sectionTitle}>登録情報</h2>
                <p style={styles.infoRow}><span>種別</span>{user.user_type === 'student' ? '在校生' : '卒業生・OB'}</p>
                <p style={styles.infoRow}><span>在校生番号</span>{user.student_number || '-'}</p>
                <p style={styles.infoRow}><span>卒業年度</span>{user.graduation_year ? `${user.graduation_year}年` : '-'}</p>
                <p style={styles.infoRow}><span>免許種別</span>{(user.license_types || []).join(', ') || '-'}</p>
                <button style={styles.editBtn} onClick={() => navigate('/mypage/register', { state: { user } })}>
                  編集する
                </button>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 16, color: '#555', lineHeight: 1.7 }}>
                  在校生・卒業生として登録すると、求人のご紹介がスムーズになります。
                </p>
                <button style={styles.registerBtn} onClick={() => navigate('/mypage/register')}>
                  登録する
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'events' && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>説明会・イベント情報</h2>
            <p style={{ color: '#888', fontSize: 14 }}>現在予定されているイベントはありません。</p>
          </div>
        )}

        {tab === 'contact' && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>お問い合わせ</h2>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 16 }}>
              ご不明な点はお気軽にご連絡ください。
            </p>
            <a href="tel:0300000000" style={styles.telBtn}>📞 電話で問い合わせる</a>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5' },
  header: {
    background: '#1DB446', color: '#fff',
    padding: '20px 16px', display: 'flex',
    alignItems: 'center', gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: '50%', border: '2px solid #fff' },
  name: { fontSize: 16, fontWeight: 'bold' },
  userType: { fontSize: 12, marginTop: 2, opacity: 0.85 },
  tabs: {
    display: 'flex', background: '#fff',
    borderBottom: '1px solid #eee', overflowX: 'auto',
  },
  tab: {
    flex: '0 0 auto', padding: '12px 16px',
    border: 'none', background: 'none',
    fontSize: 13, color: '#666',
  },
  tabActive: {
    flex: '0 0 auto', padding: '12px 16px',
    border: 'none', background: 'none',
    fontSize: 13, color: '#1DB446',
    borderBottom: '2px solid #1DB446',
    fontWeight: 'bold',
  },
  body: { padding: '16px' },
  list: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  appCompany: { fontSize: 12, color: '#888', marginBottom: 2 },
  appTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
  statusBadge: {
    display: 'inline-block', fontSize: 12,
    border: '1px solid', borderRadius: 20,
    padding: '2px 10px', marginBottom: 6,
  },
  appDate: { fontSize: 12, color: '#aaa' },
  staffNote: { marginTop: 8, fontSize: 12, color: '#555', background: '#f9f9f9', padding: '8px', borderRadius: 6 },
  empty: { textAlign: 'center', padding: '40px 0', color: '#888' },
  linkBtn: {
    marginTop: 16, padding: '10px 24px',
    background: '#1DB446', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1DB446', marginBottom: 12 },
  infoRow: { fontSize: 14, marginBottom: 8, display: 'flex', gap: 8 },
  editBtn: {
    marginTop: 12, padding: '10px 20px',
    border: '1px solid #1DB446', color: '#1DB446',
    background: '#fff', borderRadius: 8, fontSize: 14,
  },
  registerBtn: {
    width: '100%', padding: '12px',
    background: '#1DB446', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 'bold',
  },
  telBtn: {
    display: 'block', textAlign: 'center',
    padding: '12px', background: '#f5f5f5',
    borderRadius: 8, fontSize: 15, color: '#333',
  },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#888' },
};
