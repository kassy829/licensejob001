import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import liff from '@line/liff';

const API = process.env.REACT_APP_API_URL;
const LICENSE_OPTIONS = ['普通自動車第一種', '準中型', '中型', '大型', '大型特殊', '牽引', '二種免許'];

export default function Register() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const existing = state?.user;

  const [form, setForm] = useState({
    userType: existing?.user_type || 'student',
    studentNumber: existing?.student_number || '',
    graduationYear: existing?.graduation_year || '',
    licenseTypes: existing?.license_types || [],
  });
  const [submitting, setSubmitting] = useState(false);

  function toggleLicense(lic) {
    setForm((prev) => ({
      ...prev,
      licenseTypes: prev.licenseTypes.includes(lic)
        ? prev.licenseTypes.filter((l) => l !== lic)
        : [...prev.licenseTypes, lic],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const profile = await liff.getProfile();
      await fetch(`${API}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: profile.userId,
          displayName: profile.displayName,
          ...form,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
        }),
      });
      navigate('/mypage');
    } catch {
      alert('登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.back}>← 戻る</button>
        <h1 style={styles.title}>{existing ? '登録情報を編集' : '在校生・OB登録'}</h1>
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>種別 *</label>
          <div style={styles.radioGroup}>
            <label style={styles.radio}>
              <input type="radio" value="student" checked={form.userType === 'student'} onChange={() => setForm((p) => ({ ...p, userType: 'student' }))} />
              在校生
            </label>
            <label style={styles.radio}>
              <input type="radio" value="alumni" checked={form.userType === 'alumni'} onChange={() => setForm((p) => ({ ...p, userType: 'alumni' }))} />
              卒業生・OB
            </label>
          </div>
        </div>

        {form.userType === 'student' && (
          <div style={styles.field}>
            <label style={styles.label}>在校生番号（任意）</label>
            <input style={styles.input} placeholder="例: 2024-0123" value={form.studentNumber} onChange={(e) => setForm((p) => ({ ...p, studentNumber: e.target.value }))} />
          </div>
        )}

        {form.userType === 'alumni' && (
          <div style={styles.field}>
            <label style={styles.label}>卒業年度（任意）</label>
            <input style={styles.input} type="number" placeholder="例: 2022" min="1990" max="2099" value={form.graduationYear} onChange={(e) => setForm((p) => ({ ...p, graduationYear: e.target.value }))} />
          </div>
        )}

        <div style={styles.field}>
          <label style={styles.label}>保有・取得予定免許（複数可）</label>
          <div style={styles.checkGroup}>
            {LICENSE_OPTIONS.map((l) => (
              <label key={l} style={styles.check}>
                <input type="checkbox" checked={form.licenseTypes.includes(l)} onChange={() => toggleLicense(l)} />
                {l}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" style={styles.submitBtn} disabled={submitting}>
          {submitting ? '保存中...' : '保存する'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5' },
  header: { background: '#1DB446', color: '#fff', padding: '12px 16px 20px' },
  back: { background: 'none', border: 'none', color: '#fff', fontSize: 14, marginBottom: 8, padding: 0 },
  title: { fontSize: 18, fontWeight: 'bold' },
  form: { padding: '20px 16px' },
  field: { marginBottom: 20 },
  label: { display: 'block', fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#555' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 15, background: '#fff' },
  radioGroup: { display: 'flex', gap: 20 },
  radio: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 },
  checkGroup: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px' },
  submitBtn: { width: '100%', padding: '14px', background: '#1DB446', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold' },
};
