require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { getData, saveData } = require("./lib/data-store");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/data", async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: "DATABASE_URL is not configured in .env" });
  }

  try {
    const data = await getData(dbUrl);
    return res.json({ data });
  } catch (err) {
    console.error("GET Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/data", async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: "DATABASE_URL is not configured in .env" });
  }

  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: "Missing data payload" });
  }

  try {
    await saveData(dbUrl, data);
    return res.json({ success: true });
  } catch (err) {
    console.error("POST Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Glow local server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
