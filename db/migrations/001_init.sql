-- ユーザー（在校生・卒業生）
CREATE TABLE IF NOT EXISTS users (
  line_user_id    VARCHAR(64)   PRIMARY KEY,
  display_name    VARCHAR(100)  NOT NULL,
  student_number  VARCHAR(30),
  graduation_year SMALLINT,
  license_types   TEXT[],                       -- 例: ['普通自動車第一種', '大型']
  user_type       VARCHAR(10)   NOT NULL CHECK (user_type IN ('student', 'alumni')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 応募情報
CREATE TABLE IF NOT EXISTS applications (
  id               UUID          PRIMARY KEY,
  line_user_id     VARCHAR(64)   NOT NULL REFERENCES users(line_user_id),
  hellowork_job_id VARCHAR(20)   NOT NULL,       -- ハローワーク求人番号
  job_title        VARCHAR(200)  NOT NULL,
  company_name     VARCHAR(200)  NOT NULL,
  applicant_name   VARCHAR(100)  NOT NULL,
  phone            VARCHAR(20)   NOT NULL,
  email            VARCHAR(200),
  license_status   VARCHAR(20)   NOT NULL CHECK (license_status IN ('holding','in_training','planned')),
  license_types    TEXT[]        NOT NULL,
  preferred_start  VARCHAR(50),
  self_pr          TEXT,
  status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','contacted','recommended','rejected','hired')),
  staff_note       TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_line_user_id ON applications(line_user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status        ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at    ON applications(created_at DESC);
