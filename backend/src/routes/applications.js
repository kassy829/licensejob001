const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const { notifyStaff } = require('../services/lineNotify');

const router = express.Router();

// 応募登録（上野自動車学校ライセンスジョブ経由）
router.post(
  '/',
  [
    body('lineUserId').notEmpty().isString(),
    body('jobId').notEmpty().isString(),          // ハローワーク求人番号
    body('jobTitle').notEmpty().isString(),
    body('companyName').notEmpty().isString(),
    body('name').notEmpty().isString(),
    body('phone').notEmpty().isMobilePhone('ja-JP'),
    body('email').optional().isEmail(),
    body('licenseStatus').isIn(['holding', 'in_training', 'planned']),
    body('licenseTypes').isArray({ min: 1 }),
    body('preferredStart').optional().isString(),
    body('selfPR').optional().isString().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      lineUserId, jobId, jobTitle, companyName,
      name, phone, email,
      licenseStatus, licenseTypes, preferredStart, selfPR,
    } = req.body;

    try {
      const applicationId = uuidv4();
      const result = await db.query(
        `INSERT INTO applications
           (id, line_user_id, hellowork_job_id, job_title, company_name,
            applicant_name, phone, email,
            license_status, license_types, preferred_start, self_pr, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
         RETURNING *`,
        [
          applicationId, lineUserId, jobId, jobTitle, companyName,
          name, phone, email,
          licenseStatus, licenseTypes, preferredStart, selfPR,
        ]
      );

      // 担当者へLINE通知
      await notifyStaff(result.rows[0]);

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// 応募状況一覧（ユーザー別）
router.get('/user/:lineUserId', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM applications WHERE line_user_id = $1 ORDER BY created_at DESC`,
      [req.params.lineUserId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// 応募詳細
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM applications WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ステータス更新（管理者用）
router.patch('/:id/status', async (req, res, next) => {
  const { status, staffNote } = req.body;
  const validStatuses = ['pending', 'contacted', 'recommended', 'rejected', 'hired'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await db.query(
      `UPDATE applications SET status = $1, staff_note = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, staffNote, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
