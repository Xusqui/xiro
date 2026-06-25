-- Migration: add performance indexes for admin_users and custom_games
-- UP
CREATE INDEX IF NOT EXISTS idx_admin_users_id ON admin_users(id);
CREATE INDEX IF NOT EXISTS idx_custom_games_created_by ON custom_games(created_by_user_id);

-- DOWN
-- DROP INDEX IF EXISTS idx_admin_users_id;
-- DROP INDEX IF EXISTS idx_custom_games_created_by;
