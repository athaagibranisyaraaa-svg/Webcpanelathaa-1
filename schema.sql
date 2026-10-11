CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS panel_requests (
  id BIGSERIAL PRIMARY KEY,
  request_code TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  requested_username TEXT NOT NULL,
  ram_mb INTEGER NOT NULL,
  cpu_percent INTEGER NOT NULL,
  disk_mb INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (status IN ('PENDING_APPROVAL','PROCESSING','APPROVED','REJECTED','FAILED')),
  telegram_message_id BIGINT,
  ptero_user_id BIGINT,
  ptero_server_id BIGINT,
  ptero_server_identifier TEXT,
  error_public TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_requests_user_created ON panel_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status ON panel_requests(status);
CREATE TABLE IF NOT EXISTS panels (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL UNIQUE REFERENCES panel_requests(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ptero_user_id BIGINT NOT NULL,
  ptero_server_id BIGINT NOT NULL,
  ptero_server_identifier TEXT,
  server_name TEXT NOT NULL,
  ram_mb INTEGER NOT NULL,
  cpu_percent INTEGER NOT NULL,
  disk_mb INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  request_id BIGINT REFERENCES panel_requests(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
