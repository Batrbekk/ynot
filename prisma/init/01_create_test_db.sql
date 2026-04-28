-- Run once on first container boot. Creates the test database alongside ynot_dev.
SELECT 'CREATE DATABASE ynot_test OWNER ynot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ynot_test')\gexec
