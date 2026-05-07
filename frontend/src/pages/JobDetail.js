import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL;

export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then(setJob)
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return <div style={styles.center}>読み込み中...</div>;
  if (!job) return <div style={styles.center}>求人が見つかりません</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.back}>← 戻る</button>
        <h1 style={styles.title}>{job.title}</h1>
        <p style={styles.company}>{job.companyName}</p>
      </header>

      <div style={styles.body}>
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>求人情報</h2>
          <table style={styles.table}>
            {[
              ['雇用形態', job.employmentType],
              ['勤務地', job.location],
              ['給与', job.salary],
              ['勤務時間', job.workingHours],
              ['休日', job.holiday],
              ['必要免許', job.requiredLicense],
            ].map(([label, value]) => (
              <tr key={label}>
                <th style={styles.th}>{label}</th>
                <td style={styles.td}>{value || '-'}</td>
              </tr>
            ))}
          </table>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>仕事内容</h2>
          <p style={styles.desc}>{job.description}</p>
        </section>

        {job.pr && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>PR・特徴</h2>
            <p style={styles.desc}>{job.pr}</p>
          </section>
        )}

        <div style={styles.hwNote}>
          ※ ハローワーク求人番号: {job.id}
        </div>
      </div>

      <div style={styles.footer}>
        <button style={styles.applyBtn} onClick={() => navigate(`/jobs/${jobId}/apply`, { state: { job } })}>
          上野自動車学校ライセンスジョブ経由で応募する
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5', paddingBottom: 80 },
  header: { background: '#1DB446', color: '#fff', padding: '12px 16px 20px' },
  back: { background: 'none', border: 'none', color: '#fff', fontSize: 14, marginBottom: 8, padding: 0 },
  title: { fontSize: 18, fontWeight: 'bold', lineHeight: 1.4 },
  company: { fontSize: 13, marginTop: 4, opacity: 0.9 },
  body: { padding: '16px' },
  section: { background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1DB446', marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { width: '35%', padding: '6px 0', fontSize: 13, color: '#888', textAlign: 'left', verticalAlign: 'top' },
  td: { padding: '6px 0', fontSize: 13 },
  desc: { fontSize: 14, lineHeight: 1.7, color: '#333' },
  hwNote: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 8 },
  footer: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fff', padding: '12px 16px',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
  },
  applyBtn: {
    width: '100%', padding: '14px',
    background: '#1DB446', color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: 15, fontWeight: 'bold',
  },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#888' },
};
