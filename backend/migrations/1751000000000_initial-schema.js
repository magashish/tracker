/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS citext');

  pgm.sql(`
    CREATE TABLE roles (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT UNIQUE NOT NULL,
        permissions JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE admins (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email          CITEXT UNIQUE NOT NULL,
        password_hash  TEXT NOT NULL,
        full_name      TEXT NOT NULL,
        role_id        UUID NOT NULL REFERENCES roles(id),
        status         TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'disabled')),
        last_login_at  TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE employees (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email          CITEXT UNIQUE NOT NULL,
        password_hash  TEXT NOT NULL,
        full_name      TEXT NOT NULL,
        team           TEXT,
        status         TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'suspended', 'deactivated')),
        monitoring_consent_at TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE devices (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        device_uuid    UUID NOT NULL UNIQUE,
        hostname       TEXT NOT NULL,
        os             TEXT NOT NULL CHECK (os IN ('windows', 'linux')),
        os_version     TEXT,
        agent_version  TEXT NOT NULL,
        status         TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'revoked')),
        last_seen_at   TIMESTAMPTZ,
        registered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_devices_employee_id ON devices(employee_id);

    CREATE TABLE refresh_tokens (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        principal_type TEXT NOT NULL CHECK (principal_type IN ('employee', 'admin')),
        principal_id   UUID NOT NULL,
        device_id      UUID REFERENCES devices(id) ON DELETE CASCADE,
        token_hash     TEXT NOT NULL UNIQUE,
        issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at     TIMESTAMPTZ NOT NULL,
        revoked_at     TIMESTAMPTZ,
        replaced_by    UUID REFERENCES refresh_tokens(id)
    );
    CREATE INDEX idx_refresh_tokens_principal ON refresh_tokens(principal_type, principal_id);

    CREATE TABLE sessions (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        device_id    UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        ended_at     TIMESTAMPTZ,
        end_reason   TEXT CHECK (end_reason IN ('logout', 'idle_timeout', 'device_offline', 'app_closed')),
        last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_sessions_employee_started ON sessions(employee_id, started_at DESC);
    CREATE INDEX idx_sessions_open ON sessions(device_id) WHERE ended_at IS NULL;

    CREATE TABLE activity (
        id             BIGSERIAL PRIMARY KEY,
        session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        device_id      UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        window_start   TIMESTAMPTZ NOT NULL,
        window_end     TIMESTAMPTZ NOT NULL,
        app_name       TEXT NOT NULL,
        window_title   TEXT,
        active_seconds INT NOT NULL DEFAULT 0,
        idle_seconds   INT NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (window_end >= window_start)
    );
    CREATE INDEX idx_activity_employee_window ON activity(employee_id, window_start DESC);
    CREATE INDEX idx_activity_session ON activity(session_id);

    CREATE TABLE screenshots (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        device_id        UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        storage_key      TEXT NOT NULL,
        thumbnail_key    TEXT,
        captured_at      TIMESTAMPTZ NOT NULL,
        uploaded_at      TIMESTAMPTZ,
        activity_percent SMALLINT CHECK (activity_percent BETWEEN 0 AND 100),
        app_name         TEXT,
        window_title     TEXT,
        file_size_bytes  INT,
        is_blurred       BOOLEAN NOT NULL DEFAULT false
    );
    CREATE INDEX idx_screenshots_employee_captured ON screenshots(employee_id, captured_at DESC);
    CREATE INDEX idx_screenshots_session ON screenshots(session_id);
    CREATE INDEX idx_screenshots_captured_at ON screenshots(captured_at);

    CREATE TABLE configurations (
        id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope_employee_id            UUID REFERENCES employees(id) ON DELETE CASCADE,
        scope_device_id              UUID REFERENCES devices(id) ON DELETE CASCADE,
        heartbeat_interval_seconds   INT NOT NULL DEFAULT 30,
        screenshot_interval_seconds  INT NOT NULL DEFAULT 600,
        screenshot_quality           SMALLINT NOT NULL DEFAULT 70 CHECK (screenshot_quality BETWEEN 10 AND 100),
        idle_threshold_seconds       INT NOT NULL DEFAULT 300,
        api_url                      TEXT NOT NULL DEFAULT 'http://localhost:3000',
        updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by_admin_id          UUID REFERENCES admins(id),
        CHECK (
            (scope_employee_id IS NULL AND scope_device_id IS NULL) OR
            (scope_employee_id IS NOT NULL AND scope_device_id IS NULL) OR
            (scope_employee_id IS NULL AND scope_device_id IS NOT NULL)
        )
    );
    CREATE UNIQUE INDEX uq_config_global ON configurations ((true)) WHERE scope_employee_id IS NULL AND scope_device_id IS NULL;
    CREATE UNIQUE INDEX uq_config_employee ON configurations (scope_employee_id) WHERE scope_employee_id IS NOT NULL;
    CREATE UNIQUE INDEX uq_config_device ON configurations (scope_device_id) WHERE scope_device_id IS NOT NULL;

    CREATE TABLE app_versions (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform       TEXT NOT NULL CHECK (platform IN ('windows', 'linux')),
        version        TEXT NOT NULL,
        download_url   TEXT NOT NULL,
        checksum_sha256 TEXT NOT NULL,
        release_notes  TEXT,
        is_mandatory   BOOLEAN NOT NULL DEFAULT false,
        published_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (platform, version)
    );
    CREATE INDEX idx_app_versions_latest ON app_versions(platform, published_at DESC);

    CREATE TABLE audit_logs (
        id              BIGSERIAL PRIMARY KEY,
        actor_admin_id  UUID REFERENCES admins(id),
        action          TEXT NOT NULL,
        entity_type     TEXT NOT NULL,
        entity_id       TEXT,
        metadata        JSONB NOT NULL DEFAULT '{}',
        ip_address      INET,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_admin_id, created_at DESC);
    CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

    INSERT INTO roles (name, permissions) VALUES
        ('owner', '{"all": true}'),
        ('admin', '{"manage_admins": true, "manage_employees": true, "manage_config": true, "view_audit_logs": true}'),
        ('manager', '{"manage_employees": true, "view_screenshots": true}'),
        ('viewer', '{"view_only": true}');

    INSERT INTO configurations (heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url)
    VALUES (30, 600, 70, 300, 'http://localhost:3000');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS app_versions;
    DROP TABLE IF EXISTS configurations;
    DROP TABLE IF EXISTS screenshots;
    DROP TABLE IF EXISTS activity;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS refresh_tokens;
    DROP TABLE IF EXISTS devices;
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS admins;
    DROP TABLE IF EXISTS roles;
  `);
};
