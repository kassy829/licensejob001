import React from 'react';
import { useLocation } from 'react-router-dom';
import liff from '@line/liff';

export default function ApplyDone() {
  const { state } = useLocation();
  const job = state?.job || {};

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>✅</div>
        <h1 style={styles.title}>応募を受け付けました</h1>
        <p style={styles.sub}>{job.companyName}</p>
        <p style={styles.sub}>{job.title}</p>
        <p style={styles.body}>
          上野自動車学校ライセンスジョブの担当者より、LINEまたはお電話にてご連絡いたします。
        </p>
        <button style={styles.closeBtn} onClick={() => liff.closeWindow()}>
          閉じる
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#f5f5f5', padding: 20,
  },
  card: {
    background: '#fff', borderRadius: 16,
    padding: '32px 24px', textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    maxWidth: 360, width: '100%',
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  sub: { fontSize: 14, color: '#666', marginBottom: 4 },
  body: { fontSize: 14, color: '#555', lineHeight: 1.7, margin: '20px 0 28px' },
  closeBtn: {
    width: '100%', padding: '12px',
    background: '#1DB446', color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: 15, fontWeight: 'bold',
  },
};
