import postgres from 'postgres';

let sqlClient = null;

function readDatabaseUrl() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be configured for the Supabase portal database.');
  }
  return databaseUrl;
}

/**
 * Uses Supabase's transaction pooler, which is designed for transient Vercel
 * invocations. Prepared statements are disabled because transaction pooling
 * cannot guarantee that sequential statements use the same database session.
 */
export function getSupabaseSql() {
  if (sqlClient) return sqlClient;

  sqlClient = postgres(readDatabaseUrl(), {
    ssl: 'require',
    prepare: false,
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
  });
  return sqlClient;
}
