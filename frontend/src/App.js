import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JobSearch from './pages/JobSearch';
import JobDetail from './pages/JobDetail';
import Apply from './pages/Apply';
import ApplyDone from './pages/ApplyDone';
import MyPage from './pages/MyPage';
import Register from './pages/Register';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 求人を探す・応募する LIFF */}
        <Route path="/" element={<JobSearch />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/jobs/:jobId/apply" element={<Apply />} />
        <Route path="/apply/done" element={<ApplyDone />} />

        {/* マイページ LIFF */}
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/mypage/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}
