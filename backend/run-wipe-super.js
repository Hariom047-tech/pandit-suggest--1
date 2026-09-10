const { Client } = require('pg');
const { assertDisposableTarget } = require('./src/config/destructiveGuard');

async function run() {
  assertDisposableTarget('postgresql://panditconnect:panditconnect_dev@localhost:5432/panditconnect', 'run-wipe-super.js');
  const client = new Client('postgresql://panditconnect:panditconnect_dev@localhost:5432/panditconnect');
  await client.connect();
  try {
    await client.query('BEGIN');
    
    const tables = [
      'reviews', 'pandit_services', 'pandit_temples', 'pandit_languages',
      'pandit_certificates', 'pandit_media', 'pandit_availability',
      'pandit_blocked_dates', 'pandit_analytics', 'pandit_subscriptions',
      'payment_transactions', 'saved_pandits', 'inquiries', 'pandits',
      'temple_services', 'temple_timings', 'temple_media', 'saved_temples',
      'temples', 'service_samagri', 'services', 'service_categories',
      'blog_posts', 'faqs'
    ];
    
    for (const table of tables) {
      await client.query(`DELETE FROM ${table}`);
    }
    
    await client.query(`DELETE FROM users WHERE role NOT IN ('admin', 'super_admin')`);
    
    await client.query('COMMIT');
    console.log('Database wiped as SUPERUSER successfully.');
  } catch(e) {
    await client.query('ROLLBACK');
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
