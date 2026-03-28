const { Pool } = require("pg");

async function executeQuery(dbUrl, query, params = []) {
  if (!dbUrl) {
    throw new Error("Missing PostgreSQL connection URL");
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    return await pool.query(query, params);
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

async function getData(dbUrl) {
  await executeQuery(dbUrl, INIT_SQL);
  const result = await executeQuery(dbUrl, "SELECT state FROM glow_state WHERE id = 1");
  return result.rows[0]?.state ?? null;
}

async function saveData(dbUrl, data) {
  await executeQuery(dbUrl, INIT_SQL);

  const upsertSql = `
    INSERT INTO glow_state (id, state) VALUES (1, $1)
    ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state;
  `;

  await executeQuery(dbUrl, upsertSql, [JSON.stringify(data)]);
}

module.exports = {
  getData,
  saveData
};
