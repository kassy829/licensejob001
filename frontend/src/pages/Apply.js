import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import liff from '@line/liff';

const API = process.env.REACT_APP_API_URL;

const LICENSE_OPTIONS = ['普通自動車第一種', '準中型', '中型', '大型', '大型特殊', '牽引', '二種免許'];
const LICENSE_STATUS = [
  { value: 'holding', label: '取得済み' },
  { value: 'in_training', label: '教習中（取得予定あり）' },
  { value: 'planned', label: '取得予定' },
];

export default function Apply() {
  const { jobId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const job = state?.job || {};

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    licenseStatus: 'holding',
    licenseTypes: [],
    preferredStart: '',
    selfPR: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleLicense(lic) {
    setForm((prev) => ({
      ...prev,
      licenseTypes: prev.licenseTypes.includes(lic)
        ? prev.licenseTypes.filter((l) => l !== lic)
        : [...prev.licenseTypes, lic],
    }));
  }

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = '氏名を入力してください';
    if (!form.phone.match(/^0\d{9,10}$/)) errors.phone = '正しい電話番号を入力してください';
    if (form.licenseTypes.length === 0) errors.licenseTypes = '免許種別を1つ以上選択してください';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    setSubmitting(true);
    try {
      const profile = await liff.getProfile();
      const res = await fetch(`${API}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: profile.userId,
          jobId,
          jobTitle: job.title,
          companyName: job.companyName,
          ...form,
        }),
      });
      if (!res.ok) throw new Error('応募に失敗しました');
      navigate('/apply/done', { state: { job } });
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.back}>← 戻る</button>
        <h1 style={styles.title}>応募フォーム</h1>
        <p style={styles.sub}>{job.companyName} / {job.title}</p>
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>
        <Field label="氏名 *" error={fieldErrors.name}>
          <input style={styles.input} placeholder="山田 太郎" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>

        <Field label="電話番号 *" error={fieldErrors.phone}>
          <input style={styles.input} type="tel" placeholder="09012345678" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>

        <Field label="メールアドレス（任意）">
          <input style={styles.input} type="email" placeholder="example@mail.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>

        <Field label="免許の状況 *">
          {LICENSE_STATUS.map((s) => (
            <label key={s.value} style={styles.radio}>
              <input type="radio" name="licenseStatus" value={s.value} checked={form.licenseStatus === s.value} onChange={() => set('licenseStatus', s.value)} />
              {s.label}
            </label>
          ))}
        </Field>

        <Field label="免許種別 *（複数可）" error={fieldErrors.licenseTypes}>
          <div style={styles.checkGroup}>
            {LICENSE_OPTIONS.map((l) => (
              <label key={l} style={styles.check}>
                <input type="checkbox" checked={form.licenseTypes.includes(l)} onChange={() => toggleLicense(l)} />
                {l}
              </label>
            ))}
          </div>
        </Field>

        <Field label="入社希望時期（任意）">
          <input style={styles.input} placeholder="例：免許取得後すぐ / 2025年4月" value={form.preferredStart} onChange={(e) => set('preferredStart', e.target.value)} />
        </Field>

        <Field label="自己PR（任意・500字以内）">
          <textarea
            style={{ ...styles.input, height: 100, resize: 'vertical' }}
            placeholder="運転が好きで安全運転を心がけています..."
            maxLength={500}
            value={form.selfPR}
            onChange={(e) => set('selfPR', e.target.value)}
          />
          <div style={styles.charCount}>{form.selfPR.length}/500</div>
        </Field>

        <div style={styles.notice}>
          上野自動車学校ライセンスジョブ経由での応募となります。担当者より折り返しご連絡いたします。
        </div>

        <button type="submit" style={styles.submitBtn} disabled={submitting}>
          {submitting ? '送信中...' : '応募する'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#555' }}>{label}</label>
      {children}
      {error && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5' },
  header: { background: '#1DB446', color: '#fff', padding: '12px 16px 20px' },
  back: { background: 'none', border: 'none', color: '#fff', fontSize: 14, marginBottom: 8, padding: 0 },
  title: { fontSize: 18, fontWeight: 'bold' },
  sub: { fontSize: 12, marginTop: 4, opacity: 0.9 },
  form: { padding: '20px 16px' },
  input: {
    width: '100%', padding: '10px 12px',
    border: '1px solid #ddd', borderRadius: 8,
    fontSize: 15, background: '#fff',
  },
  radio: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 14 },
  checkGroup: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  check: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
    background: '#fff', border: '1px solid #ddd', borderRadius: 6,
    padding: '6px 10px',
  },
  charCount: { textAlign: 'right', fontSize: 11, color: '#aaa', marginTop: 2 },
  notice: {
    background: '#e8f5e9', border: '1px solid #a5d6a7',
    borderRadius: 8, padding: '12px', fontSize: 13,
    color: '#2e7d32', marginBottom: 20, lineHeight: 1.6,
  },
  submitBtn: {
    width: '100%', padding: '14px',
    background: '#1DB446', color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: 16, fontWeight: 'bold',
    opacity: 1,
  },
};
