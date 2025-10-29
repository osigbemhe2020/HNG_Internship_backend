const express = require("express");
const axios = require("axios");
const mysql = require("mysql2/promise"); 
const { createCanvas } = require("canvas");
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config();
const dbConfig = {
  host: process.env.mysqlHost,
  user: process.env.mysqlUser,
  password: process.env.mysqlPassword,
  database: process.env.mysqlDatabase,
  port: process.env.mysqlPort,
};

const app = express();
app.use(express.json());

const COUNTRY_API = "https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies";
const EXCHANGE_API = "https://open.er-api.com/v6/latest/USD";

const cacheDir = path.join(__dirname, 'cache');

// Initialize cache directory
(async () => {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
  } catch (err) {
    console.error('Error creating cache directory:', err);
  }
})();

// Initialize database table
(async () => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS hng_stage_two_countries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        capital VARCHAR(100),
        region VARCHAR(100),
        population BIGINT NOT NULL,
        currency_code VARCHAR(10),
        exchange_rate DECIMAL(10,4),
        estimated_gdp DECIMAL(20,2),
        flag_url VARCHAR(255),
        last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await connection.query(createTableQuery);
    console.log("Table is ready.");
  } catch (error) {
    console.error("Error creating table:", error.message);
  } finally {
    if (connection) await connection.end();
  }
})();

// Helper function to generate summary image
async function generateSummaryImage(totalCountries, topCountries, timestamp) {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('Country Data Summary', 50, 60);

  // Total countries
  ctx.font = '24px Arial';
  ctx.fillStyle = '#00d4ff';
  ctx.fillText(`Total Countries: ${totalCountries}`, 50, 120);

  // Last refresh timestamp
  ctx.font = '18px Arial';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(`Last Refreshed: ${new Date(timestamp).toLocaleString()}`, 50, 160);

  // Top 5 countries header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Top 5 Countries by Estimated GDP:', 50, 220);

  // Top 5 countries list
  ctx.font = '20px Arial';
  topCountries.forEach((country, index) => {
    const y = 270 + (index * 60);
    ctx.fillStyle = '#00d4ff';
    ctx.fillText(`${index + 1}. ${country.name}`, 70, y);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px Arial';
    const gdpValue = country.estimated_gdp ? country.estimated_gdp.toLocaleString() : 'N/A';
    ctx.fillText(`GDP: $${gdpValue}`, 90, y + 25);
    ctx.font = '20px Arial';
  });

  // Save image
  const buffer = canvas.toBuffer('image/png');
  const imagePath = path.join(cacheDir, 'summary.png');
  await fs.writeFile(imagePath, buffer);
}

// POST route to refresh country data
app.post("/countries/refresh", async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    console.log("Fetching country data...");
    const countriesResponse = await axios.get(COUNTRY_API, { timeout: 10000 });
    const countriesData = countriesResponse.data;

    console.log("Fetching exchange rates...");
    const exchangeResponse = await axios.get(EXCHANGE_API, { timeout: 10000 });
    const exchangeRates = exchangeResponse.data.rates;

    const timestamp = new Date();

    // Process each country
    for (const country of countriesData) {
      let currencyCode = null;
      let exchangeRate = null;
      let estimatedGDP = null;

      // Handle currency according to requirements
      if (country.currencies && country.currencies.length > 0) {
        currencyCode = country.currencies[0].code;
        
        // Get exchange rate if currency exists in rates
        if (exchangeRates[currencyCode]) {
          exchangeRate = exchangeRates[currencyCode];
          const randomFactor = Math.random() * (2000 - 1000) + 1000;
          estimatedGDP = (country.population * randomFactor) / exchangeRate;
        } else {
          // Currency not found in exchange rates
          exchangeRate = null;
          estimatedGDP = null;
        }
      } else {
        // Empty currencies array
        currencyCode = null;
        exchangeRate = null;
        estimatedGDP = 0;
      }

      // Check if country exists (case-insensitive)
      const [existing] = await connection.query(
        "SELECT id FROM hng_stage_two_countries WHERE LOWER(name) = LOWER(?)",
        [country.name]
      );

      if (existing.length > 0) {
        // Update existing record with new random multiplier
        await connection.query(
          `UPDATE hng_stage_two_countries 
           SET capital = ?, region = ?, population = ?, currency_code = ?, 
               exchange_rate = ?, estimated_gdp = ?, flag_url = ?, last_refreshed_at = ?
           WHERE id = ?`,
          [
            country.capital || null,
            country.region || null,
            country.population,
            currencyCode,
            exchangeRate,
            estimatedGDP,
            country.flag || null,
            timestamp,
            existing[0].id
          ]
        );
      } else {
        // Insert new record
        await connection.query(
          `INSERT INTO hng_stage_two_countries 
           (name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url, last_refreshed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            country.name,
            country.capital || null,
            country.region || null,
            country.population,
            currencyCode,
            exchangeRate,
            estimatedGDP,
            country.flag || null,
            timestamp
          ]
        );
      }
    }

    // Generate summary image after successful refresh
    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM hng_stage_two_countries');
    const totalCountries = countResult[0].total;

    const [topCountries] = await connection.query(
      'SELECT name, estimated_gdp FROM hng_stage_two_countries WHERE estimated_gdp IS NOT NULL ORDER BY estimated_gdp DESC LIMIT 5'
    );

    await generateSummaryImage(totalCountries, topCountries, timestamp);

    console.log("✅ Countries refreshed successfully.");
    res.status(200).json({
      message: "Countries data refreshed successfully",
      total_countries: totalCountries,
      last_refreshed_at: timestamp.toISOString()
    });

  } catch (error) {
    console.error("Error refreshing countries:", error.message);
    
    // Check if it's an external API error
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.response) {
      const apiName = error.config?.url.includes('restcountries') ? 'RestCountries API' : 'ER-API';
      return res.status(503).json({
        error: "External data source unavailable",
        details: `Could not fetch data from ${apiName}`
      });
    }
    
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) await connection.end();
  }
});

// GET all countries with filters and sorting
app.get("/countries", async (req, res) => {
  const { region, currency, sort } = req.query;

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    let sql = "SELECT * FROM hng_stage_two_countries WHERE 1=1";
    const params = [];

    // Apply filters
    if (region) {
      sql += " AND region = ?";
      params.push(region);
    }
    if (currency) {
      sql += " AND currency_code = ?";
      params.push(currency);
    }

    // Apply sorting
    if (sort === "gdp_desc") {
      sql += " ORDER BY estimated_gdp DESC";
    } else if (sort === "gdp_asc") {
      sql += " ORDER BY estimated_gdp ASC";
    } else {
      sql += " ORDER BY name ASC";
    }

    const [rows] = await connection.query(sql, params);
    res.status(200).json(rows);

  } catch (error) {
    console.error("Error fetching countries:", error.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) await connection.end();
  }
});

// GET single country by name
app.get("/countries/:name", async (req, res) => {
  const { name } = req.params;
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(
      "SELECT * FROM hng_stage_two_countries WHERE LOWER(name) = LOWER(?)",
      [name]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Country not found" });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching country:", error.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) await connection.end();
  }
});

// DELETE country by name
app.delete("/countries/:name", async (req, res) => {
  const { name } = req.params;
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.query(
      "DELETE FROM hng_stage_two_countries WHERE LOWER(name) = LOWER(?)",
      [name]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Country not found" });
    }

    res.status(200).json({ message: "Country deleted successfully" });
  } catch (error) {
    console.error("Error deleting country:", error.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) await connection.end();
  }
});

// GET status
app.get("/status", async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS total_countries, MAX(last_refreshed_at) AS last_refreshed_at 
      FROM hng_stage_two_countries
    `);

    res.status(200).json({
      total_countries: rows[0].total_countries,
      last_refreshed_at: rows[0].last_refreshed_at
    });
  } catch (error) {
    console.error("Error fetching status:", error.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) await connection.end();
  }
});

// GET summary image
app.get("/countries/image", async (req, res) => {
  try {
    const imagePath = path.join(cacheDir, 'summary.png');
    
    // Check if image exists
    await fs.access(imagePath);
    
    // Send the image file
    res.sendFile(imagePath);
  } catch (error) {
    console.error("Error serving image:", error.message);
    res.status(404).json({ error: "Summary image not found" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});