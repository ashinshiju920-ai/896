import pg from 'C:/Users/USER/OneDrive/Desktop/999/node_modules/pg/lib/index.js';

async function main() {
  const client = new pg.Client({
    connectionString: 'postgresql://neondb_owner:npg_mluN3s5BWior@ep-falling-bar-b3nv1vt3-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });
  await client.connect();

  console.log('Adding external_reference column...');
  await client.query('ALTER TABLE "main_site_purchase_events" ADD COLUMN IF NOT EXISTS "external_reference" text');

  try {
    await client.query('ALTER TABLE "main_site_purchase_events" ADD CONSTRAINT "main_site_purchase_events_external_reference_unique" UNIQUE("external_reference")');
    console.log('Unique constraint added.');
  } catch (e) {
    console.log('Unique constraint notice:', e.message);
  }

  console.log('Updating course_entitlements constraint...');
  await client.query('ALTER TABLE "course_entitlements" DROP CONSTRAINT IF EXISTS "course_entitlements_source_check"');
  await client.query("ALTER TABLE \"course_entitlements\" ADD CONSTRAINT \"course_entitlements_source_check\" CHECK (source IN ('CASHFREE', 'ADMIN', 'PROMOTION', 'IMPORT', 'MIGRATION', 'MAIN_SITE_PURCHASE'))");

  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'main_site_purchase_events'");
  console.log('Updated columns:', res.rows.map(x => x.column_name));

  await client.end();
}

main().catch(console.error);
