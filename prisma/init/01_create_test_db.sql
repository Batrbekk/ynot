-- Run once on first container boot (only when the data volume is empty).
-- Creates the test database alongside ynot_dev.
-- If ynot_test is missing on a pre-existing volume, recreate the volume:
--   docker compose down --volumes && docker compose --profile dev up -d
SELECT 'CREATE DATABASE ynot_test OWNER ynot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ynot_test')\gexec
