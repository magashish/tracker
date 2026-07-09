// Bootstraps the first 'owner' admin account so someone can log into the
// dashboard at all (the /admin/admins API requires an existing admin, so
// the very first one can't be created through the API).
//
// Usage: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npx tsx scripts/seed-admin.ts
import { createPool } from '../src/infrastructure/db/pool';
import { Argon2PasswordHasher } from '../src/infrastructure/security/argon2-password-hasher';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME ?? 'Owner';

  if (!email || !password) {
    console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables are required');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  const pool = createPool();
  const hasher = new Argon2PasswordHasher();

  try {
    const existing = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);
    if (existing.rows[0]) {
      console.log(`Admin ${email} already exists, skipping.`);
      return;
    }

    const role = await pool.query("SELECT id FROM roles WHERE name = 'owner'");
    if (!role.rows[0]) {
      throw new Error("Role 'owner' not found — run migrations first");
    }

    const passwordHash = await hasher.hash(password);
    await pool.query(
      'INSERT INTO admins (email, password_hash, full_name, role_id, status) VALUES ($1, $2, $3, $4, $5)',
      [email, passwordHash, fullName, role.rows[0].id, 'active']
    );
    console.log(`Created owner admin: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
