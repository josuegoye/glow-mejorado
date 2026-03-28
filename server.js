require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname)); // Sirve las páginas HTML (admin.html, cliente.html...) directamente

// Helper to get a pool for the supplied DB URL
// In a real app we might cache these pools by URL, but for this proxy
// we will just create a quick client to execute the query.
async function executeQuery(dbUrl, query, params = []) {
  if (!dbUrl) throw new Error("Missing PostgreSQL connection URL");
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Required by most cloud DBs like Neon/Supabase
  });

  try {
    const res = await pool.query(query, params);
    return res;
  } finally {
    await pool.end();
  }
}

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS glow_state (
    id integer PRIMARY KEY,
    state jsonb NOT NULL
  );
`;

app.get('/api/data', async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'DATABASE_URL is not configured in .env' });
  }

  try {
    // Ensure table exists
    await executeQuery(dbUrl, INIT_SQL);

    // Fetch data
    const result = await executeQuery(dbUrl, 'SELECT state FROM glow_state WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({ data: null });
    }
    return res.json({ data: result.rows[0].state });
  } catch (err) {
    console.error("GET Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data', async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'DATABASE_URL is not configured in .env' });
  }

  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Missing data payload' });
  }

  try {
    // Ensure table exists
    await executeQuery(dbUrl, INIT_SQL);

    // Upsert data
    const upsertSql = `
      INSERT INTO glow_state (id, state) VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state;
    `;
    await executeQuery(dbUrl, upsertSql, [JSON.stringify(data)]);

    res.json({ success: true });
  } catch (err) {
    console.error("POST Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend proxy running on http://localhost:${PORT}`);
  console.log('Ensure you send x-database-url header from the frontend.');
});
