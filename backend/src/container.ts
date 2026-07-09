import { Pool } from 'pg';
import Redis from 'ioredis';
import { env } from './config/env';
import { createLogger, Logger } from './infrastructure/logging/logger';
import { createPool } from './infrastructure/db/pool';

import { PostgresEmployeeRepository } from './infrastructure/db/repositories/employee.repository';
import { PostgresDeviceRepository } from './infrastructure/db/repositories/device.repository';
import { PostgresSessionRepository } from './infrastructure/db/repositories/session.repository';
import { PostgresActivityRepository } from './infrastructure/db/repositories/activity.repository';
import { PostgresScreenshotRepository } from './infrastructure/db/repositories/screenshot.repository';
import { PostgresConfigurationRepository } from './infrastructure/db/repositories/configuration.repository';
import { PostgresAdminRepository } from './infrastructure/db/repositories/admin.repository';
import { PostgresRefreshTokenRepository } from './infrastructure/db/repositories/refresh-token.repository';
import { PostgresAuditLogRepository } from './infrastructure/db/repositories/audit-log.repository';
import { PostgresAppVersionRepository } from './infrastructure/db/repositories/app-version.repository';

import { LocalScreenshotStorage } from './infrastructure/storage/local-screenshot-storage';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { SystemClock } from './infrastructure/security/system-clock';
import { SignedStorageUrlService } from './infrastructure/security/signed-storage-url.service';

import { AuthenticateEmployeeService } from './application/auth/authenticate-employee.service';
import { AuthenticateAdminService } from './application/auth/authenticate-admin.service';
import { RefreshTokenService } from './application/auth/refresh-token.service';
import { RegisterDeviceService } from './application/devices/register-device.service';
import { SessionLifecycleService } from './application/tracking/session-lifecycle.service';
import { RecordHeartbeatService } from './application/tracking/record-heartbeat.service';
import { RecordActivityBatchService } from './application/tracking/record-activity-batch.service';
import { QueryActivityService } from './application/tracking/query-activity.service';
import { CreateUploadUrlService } from './application/screenshots/create-upload-url.service';
import { ConfirmScreenshotService } from './application/screenshots/confirm-screenshot.service';
import { QueryScreenshotsService } from './application/screenshots/query-screenshots.service';
import { CleanupOldScreenshotsService } from './application/screenshots/cleanup-old-screenshots.service';
import { GetDeviceConfigService } from './application/config/get-device-config.service';
import { ManageConfigurationService } from './application/config/manage-configuration.service';
import { GetLiveEmployeesService } from './application/dashboard/get-live-employees.service';
import { GetEmployeeReportService } from './application/dashboard/get-employee-report.service';
import { ManageEmployeesService } from './application/admin/manage-employees.service';
import { ManageAdminsService } from './application/admin/manage-admins.service';
import { QueryAuditLogsService } from './application/admin/query-audit-logs.service';
import { ManageAppVersionsService } from './application/admin/manage-app-versions.service';

import { AuditLogRepository } from './application/ports/audit-log-repository.port';

export interface Container {
  logger: Logger;
  pool: Pool;
  redis: Redis;
  tokenService: JwtTokenService;
  auditLogRepository: AuditLogRepository;
  signedStorageUrls: SignedStorageUrlService;
  localScreenshotStorage: LocalScreenshotStorage;

  auth: {
    authenticateEmployee: AuthenticateEmployeeService;
    authenticateAdmin: AuthenticateAdminService;
    refreshToken: RefreshTokenService;
  };
  devices: { registerDevice: RegisterDeviceService };
  tracking: {
    sessionLifecycle: SessionLifecycleService;
    recordHeartbeat: RecordHeartbeatService;
    recordActivityBatch: RecordActivityBatchService;
    queryActivity: QueryActivityService;
  };
  screenshots: {
    createUploadUrl: CreateUploadUrlService;
    confirmScreenshot: ConfirmScreenshotService;
    queryScreenshots: QueryScreenshotsService;
    cleanupOldScreenshots: CleanupOldScreenshotsService;
  };
  config: {
    getDeviceConfig: GetDeviceConfigService;
    manageConfiguration: ManageConfigurationService;
  };
  dashboard: {
    getLiveEmployees: GetLiveEmployeesService;
    getEmployeeReport: GetEmployeeReportService;
  };
  admin: {
    manageEmployees: ManageEmployeesService;
    manageAdmins: ManageAdminsService;
    queryAuditLogs: QueryAuditLogsService;
    manageAppVersions: ManageAppVersionsService;
  };
}

export function buildContainer(): Container {
  const logger = createLogger();
  const pool = createPool();
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });

  const tokenService = new JwtTokenService(env.JWT_ACCESS_SECRET);
  const passwordHasher = new Argon2PasswordHasher();
  const clock = new SystemClock();
  const signedStorageUrls = new SignedStorageUrlService(env.STORAGE_SIGNING_SECRET);
  const localScreenshotStorage = new LocalScreenshotStorage(
    env.SCREENSHOT_STORAGE_DIR,
    env.PUBLIC_API_URL,
    signedStorageUrls
  );
  const screenshotStorage = localScreenshotStorage;

  const employeeRepository = new PostgresEmployeeRepository(pool);
  const deviceRepository = new PostgresDeviceRepository(pool);
  const sessionRepository = new PostgresSessionRepository(pool);
  const activityRepository = new PostgresActivityRepository(pool);
  const screenshotRepository = new PostgresScreenshotRepository(pool);
  const configurationRepository = new PostgresConfigurationRepository(pool);
  const adminRepository = new PostgresAdminRepository(pool);
  const refreshTokenRepository = new PostgresRefreshTokenRepository(pool);
  const auditLogRepository = new PostgresAuditLogRepository(pool);
  const appVersionRepository = new PostgresAppVersionRepository(pool);

  return {
    logger,
    pool,
    redis,
    tokenService,
    auditLogRepository,
    signedStorageUrls,
    localScreenshotStorage,

    auth: {
      authenticateEmployee: new AuthenticateEmployeeService(
        employeeRepository,
        deviceRepository,
        refreshTokenRepository,
        passwordHasher,
        tokenService
      ),
      authenticateAdmin: new AuthenticateAdminService(adminRepository, refreshTokenRepository, passwordHasher, tokenService),
      refreshToken: new RefreshTokenService(refreshTokenRepository, tokenService, employeeRepository, adminRepository, clock),
    },
    devices: { registerDevice: new RegisterDeviceService(deviceRepository) },
    tracking: {
      sessionLifecycle: new SessionLifecycleService(sessionRepository, deviceRepository),
      recordHeartbeat: new RecordHeartbeatService(sessionRepository, activityRepository, configurationRepository, clock),
      recordActivityBatch: new RecordActivityBatchService(activityRepository),
      queryActivity: new QueryActivityService(activityRepository),
    },
    screenshots: {
      createUploadUrl: new CreateUploadUrlService(screenshotRepository, screenshotStorage),
      confirmScreenshot: new ConfirmScreenshotService(screenshotRepository),
      queryScreenshots: new QueryScreenshotsService(screenshotRepository, screenshotStorage, auditLogRepository),
      cleanupOldScreenshots: new CleanupOldScreenshotsService(
        screenshotRepository,
        screenshotStorage,
        clock,
        env.SCREENSHOT_RETENTION_DAYS
      ),
    },
    config: {
      getDeviceConfig: new GetDeviceConfigService(configurationRepository, deviceRepository),
      manageConfiguration: new ManageConfigurationService(configurationRepository),
    },
    dashboard: {
      getLiveEmployees: new GetLiveEmployeesService(sessionRepository, configurationRepository),
      getEmployeeReport: new GetEmployeeReportService(activityRepository, screenshotRepository, screenshotStorage),
    },
    admin: {
      manageEmployees: new ManageEmployeesService(employeeRepository, passwordHasher),
      manageAdmins: new ManageAdminsService(adminRepository, passwordHasher),
      queryAuditLogs: new QueryAuditLogsService(auditLogRepository),
      manageAppVersions: new ManageAppVersionsService(appVersionRepository),
    },
  };
}
