const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../services/db');

const router = express.Router();

// 在校生・OB登録 or 情報取得（LINE IDをキーにupsert）
router.post(
  '/register',
  [
    body('lineUserId').notEmpty().isString(),
    body('displayName').notEmpty().isString(),
    body('studentNumber').optional().isString(),
    body('graduationYear').optional().isInt({ min: 1990, max: 2100 }).toInt(),
    body('licenseTypes').optional().isArray(),
    body('userType').isIn(['student', 'alumni']),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { lineUserId, displayName, studentNumber, graduationYear, licenseTypes, userType } = req.body;

    try {
      const result = await db.query(
        `INSERT INTO users (line_user_id, display_name, student_number, graduation_year, license_types, user_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (line_user_id) DO UPDATE
           SET display_name = EXCLUDED.display_name,
               student_number = COALESCE(EXCLUDED.student_number, users.student_number),
               graduation_year = COALESCE(EXCLUDED.graduation_year, users.graduation_year),
               license_types = COALESCE(EXCLUDED.license_types, users.license_types),
               user_type = EXCLUDED.user_type,
               updated_at = NOW()
         RETURNING *`,
        [lineUserId, displayName, studentNumber, graduationYear, licenseTypes, userType]
      );
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ユーザー情報取得
router.get('/:lineUserId', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE line_user_id = $1',
      [req.params.lineUserId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
