import pg from 'C:/Users/USER/OneDrive/Desktop/999/node_modules/pg/lib/index.js';

async function main() {
  const client = new pg.Client({
    connectionString: 'postgresql://neondb_owner:npg_mluN3s5BWior@ep-falling-bar-b3nv1vt3-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });
  await client.connect();

  const events = await client.query('SELECT id, external_order_id, external_reference, customer_email, course_slug, access_tier, payment_status, event_status, failure_reason, processed_at FROM main_site_purchase_events');
  console.log('--- MAIN SITE PURCHASE EVENTS ---');
  console.log(JSON.stringify(events.rows, null, 2));

  const students = await client.query("SELECT id, email, full_name, role, account_status, email_verified, created_at FROM users WHERE email = 'ashinshiju@icloud.com'");
  console.log('--- STUDENT USER ---');
  console.log(JSON.stringify(students.rows, null, 2));

  const entitlements = await client.query('SELECT id, user_id, course_id, access_tier, status, source, granted_at, external_reference FROM course_entitlements');
  console.log('--- COURSE ENTITLEMENTS ---');
  console.log(JSON.stringify(entitlements.rows, null, 2));

  await client.end();
}

main().catch(console.error);
