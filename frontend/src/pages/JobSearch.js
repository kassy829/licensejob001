import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiff } from '../hooks/useLiff';

const API = process.env.REACT_APP_API_URL;
const LIFF_ID = process.env.REACT_APP_LIFF_ID_JOB_SEARCH;

const CATEGORIES = [
  { label: 'すべて', value: '' },
  { label: 'トラックドライバー', value: '09010' },
  { label: 'バスドライバー', value: '09020' },
  { label: 'タクシードライバー', value: '09030' },
  { label: '配送・運搬', value: '09040' },
];

export default function JobSearch() {
  const { ready, error } = useLiff(LIFF_ID);
  const [category, setCategory] = useState('');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    fetchJobs();
  }, [ready, category]);

  async function fetchJobs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category, prefecture: '13' });
      const res = await fetch(`${API}/api/jobs?${params}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } finally {
      setLoading(false);
    }
  }

  if (error) return <div style={styles.center}>初期化に失敗しました</div>;
  if (!ready) return <div style={styles.center}>読み込み中...</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>求人を探す</h1>
        <p style={styles.headerSub}>上野自動車学校 ライセンスジョブ</p>
      </header>

      <div style={styles.filterRow}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            style={category === c.value ? styles.filterActive : styles.filter}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.center}>検索中...</div>
      ) : jobs.length === 0 ? (
        <div style={styles.center}>求人が見つかりませんでした</div>
      ) : (
        <ul style={styles.list}>
          {jobs.map((job) => (
            <li key={job.id} style={styles.card} onClick={() => navigate(`/jobs/${job.id}`)}>
              <div style={styles.company}>{job.companyName}</div>
              <div style={styles.jobTitle}>{job.title}</div>
              <div style={styles.meta}>
                <span>{job.prefecture}</span>
                <span style={styles.salary}>{job.salary}</span>
              </div>
              <div style={styles.employType}>{job.employmentType}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5' },
  header: {
    background: '#1DB446', color: '#fff',
    padding: '20px 16px 16px',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSub: { fontSize: 12, marginTop: 4, opacity: 0.85 },
  filterRow: {
    display: 'flex', gap: 8, padding: '12px 16px',
    overflowX: 'auto', background: '#fff',
    borderBottom: '1px solid #eee',
  },
  filter: {
    flexShrink: 0, padding: '6px 14px',
    border: '1px solid #ccc', borderRadius: 20,
    background: '#fff', fontSize: 13,
  },
  filterActive: {
    flexShrink: 0, padding: '6px 14px',
    border: '1px solid #1DB446', borderRadius: 20,
    background: '#1DB446', color: '#fff', fontSize: 13,
  },
  list: { listStyle: 'none', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#fff', borderRadius: 10,
    padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    cursor: 'pointer',
  },
  company: { fontSize: 12, color: '#888', marginBottom: 4 },
  jobTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  meta: { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  salary: { color: '#1DB446', fontWeight: 'bold' },
  employType: { marginTop: 6, fontSize: 12, color: '#666' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#888' },
};
