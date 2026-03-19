import db from './config/database.js';

const products = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'EP_CLASSIC',
    name: 'Endowment Plan Classic',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    code: 'MB_20',
    name: 'Money Back Plan (20yr)',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    code: 'ULIP_GROWTH',
    name: 'ULIP Growth Fund',
  },
];

(async () => {
  try {
    for (const p of products) {
      await db.query(
        `INSERT INTO products (id, code, name, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE`,
        [p.id, p.code, p.name]
      );
      console.log(`✅ Seeded: ${p.name}`);
    }

    // Verify
    const { rows } = await db.query('SELECT id, code, name, is_active FROM products ORDER BY code');
    console.log('\nAll products in DB:');
    rows.forEach(r => console.log(`  ${r.is_active ? '✅' : '❌'} [${r.code}] ${r.name} (${r.id})`));

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
})();
