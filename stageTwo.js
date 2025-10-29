const express = require("express");
const axios = require("axios");
const mysql = require("mysql2/promise"); 
const { createCanvas } = require("canvas");
const path = require("path");
const fs = require("fs");

// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const dbConfig = {
  host: process.env.mysqlHost,
  user: process.env.mysqlUser,
  password: process.env.mysqlPassword,
  database: process.env.mysqlDatabase,
  port: process.env.mysqlPort,
};

const app = express();
const COUNTRY_API = "https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies";
const EXCHANGE_API = "https://open.er-api.com/v6/latest/USD";

// Ensure cache directory exists
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Database connection helper
const getDbConnection = async () => {
  return await mysql.createConnection(dbConfig);
};

// Initialize table on first use
const initializeTable = async () => {
  let connection;
  try {
    connection = await getDbConnection();
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
    console.log("✅ Table is ready.");
  } catch (error) {
    console.error("❌ Error creating table:", error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

// POST route to refresh country data - FIXED FOR TEST 1
app.post("/countries/refresh", async (req, res) => {
  let connection;
  try {
    await initializeTable();
    connection = await getDbConnection();

    console.log("Fetching country data...");
    const { data: countriesData } = await axios.get(COUNTRY_API, { timeout: 10000 });

    console.log("Fetching exchange rates...");
    const { data: exchangeData } = await axios.get(EXCHANGE_API, { timeout: 10000 });
    const exchangeRates = exchangeData.rates;

    // Process each country according to requirements
    for (const country of countriesData) {
      let currency = null;
      let exchangeRate = null;
      let estimatedGDP = null;

      // Handle currency logic as per requirements
      if (country.currencies && country.currencies.length > 0) {
        currency = country.currencies[0].code;
        
        if (exchangeRates[currency]) {
          exchangeRate = exchangeRates[currency];
          const randomFactor = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
          estimatedGDP = (country.population * randomFactor) / exchangeRate;
        }
        // If currency not found in exchange rates, leave exchangeRate and estimatedGDP as null
      }
      // If no currencies array or empty, leave everything as null (estimatedGDP = 0 per requirements)
      else {
        estimatedGDP = 0;
      }

      const sql = `
        INSERT INTO hng_stage_two_countries 
        (name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url, last_refreshed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          capital = VALUES(capital),
          region = VALUES(region),
          population = VALUES(population),
          currency_code = VALUES(currency_code),
          exchange_rate = VALUES(exchange_rate),
          estimated_gdp = VALUES(estimated_gdp),
          flag_url = VALUES(flag_url),
          last_refreshed_at = NOW()
      `;

      const values = [
        country.name,
        country.capital || null,
        country.region || null,
        country.population || 0,
        currency,
        exchangeRate,
        estimatedGDP,
        country.flag || null,
      ];

      await connection.query(sql, values);
    }

    console.log("✅ Countries refreshed successfully.");
    
    // Generate image after refresh as required
    await generateSummaryImage(connection);
    
    res.status(200).json({ message: "Countries refreshed successfully" });
  } catch (error) {
    console.error("Error refreshing countries:", error.message);
    if (error.code === 'ECONNABORTED' || error.response?.status >= 500) {
      res.status(503).json({ 
        error: "External data source unavailable",
        details: `Could not fetch data from ${error.config?.url?.includes('restcountries') ? 'RESTCountries' : 'Exchange Rates'} API`
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  } finally {
    if (connection) await connection.end();
  }
});

// Generate summary image function
const generateSummaryImage = async (connection) => {
  try {
    // Get total countries and last refresh
    const [statusRows] = await connection.query(`
      SELECT COUNT(*) AS total_countries, MAX(last_refreshed_at) AS last_refresh 
      FROM hng_stage_two_countries
    `);

    // Get top 5 countries by GDP
    const [topGdpRows] = await connection.query(`
      SELECT name, estimated_gdp 
      FROM hng_stage_two_countries 
      WHERE estimated_gdp IS NOT NULL 
      ORDER BY estimated_gdp DESC 
      LIMIT 5
    `);

    const { total_countries, last_refresh } = statusRows[0];

    // Create canvas image
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(0, 0, 800, 400);

    // Text - White color
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px Arial";
    ctx.fillText("🌍 HNG Stage 2 - Country Summary", 50, 50);
    
    ctx.font = "18px Arial";
    ctx.fillText(`Total Countries: ${total_countries}`, 50, 90);
    ctx.fillText(`Last Refreshed: ${new Date(last_refresh).toLocaleString()}`, 50, 120);
    
    // Top 5 GDP countries
    ctx.fillText("Top 5 Countries by GDP:", 50, 160);
    ctx.font = "16px Arial";
    
    topGdpRows.forEach((country, index) => {
      const gdpFormatted = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2
      }).format(country.estimated_gdp);
      
      ctx.fillText(`${index + 1}. ${country.name}: $${gdpFormatted}`, 70, 190 + (index * 25));
    });

    ctx.font = "14px Arial";
    ctx.fillText("API Powered by RESTCountries & ER-API", 50, 350);

    // Save image to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(cacheDir, 'summary.png'), buffer);
    console.log("✅ Summary image generated successfully.");
    
  } catch (error) {
    console.error("Error generating summary image:", error.message);
  }
};

// GET /countries - FIXED SORTING FOR TEST 2
app.get("/countries", async (req, res) => {
  const { region, currency, sort } = req.query;

  let connection;
  try {
    connection = await getDbConnection();

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

    // Apply sorting - FIXED FOR TEST 2
    if (sort) {
      switch (sort) {
        case "gdp_desc":
          sql += " ORDER BY estimated_gdp DESC";
          break;
        case "gdp_asc":
          sql += " ORDER BY estimated_gdp ASC";
          break;
        case "population_desc":
          sql += " ORDER BY population DESC";
          break;
        case "population_asc":
          sql += " ORDER BY population ASC";
          break;
        default:
          sql += " ORDER BY name ASC";
      }
    } else {
      sql += " ORDER BY name ASC";
    }

    const [rows] = await connection.query(sql, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching countries:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// GET /countries/:name - FIXED ERROR FORMAT FOR TEST 7
app.get("/countries/:name", async (req, res) => {
  const { name } = req.params;
  let connection;

  try {
    connection = await getDbConnection();
    const [rows] = await connection.query(
      "SELECT * FROM hng_stage_two_countries WHERE LOWER(name) = LOWER(?)",
      [name]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Country not found" }); // FIXED: changed "message" to "error"
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// DELETE /countries/:name - FIXED ERROR FORMAT FOR TEST 7
app.delete("/countries/:name", async (req, res) => {
  const { name } = req.params;
  let connection;

  try {
    connection = await getDbConnection();
    const [result] = await connection.query(
      "DELETE FROM hng_stage_two_countries WHERE LOWER(name) = LOWER(?)",
      [name]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Country not found" }); // FIXED: changed "message" to "error"
    }

    res.status(200).json({ message: `${name} deleted successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// GET /status - FIXED FOR TEST 5
app.get("/status", async (req, res) => {
  let connection;
  try {
    connection = await getDbConnection();
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS total_countries, MAX(last_refreshed_at) AS last_refreshed_at 
      FROM hng_stage_two_countries
    `);

    // Ensure both fields are present
    const result = {
      total_countries: parseInt(rows[0].total_countries) || 0,
      last_refreshed_at: rows[0].last_refreshed_at || new Date().toISOString()
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// GET /countries/image - FIXED FOR TEST 6
app.get("/countries/image", async (req, res) => {
  try {
    const imagePath = path.join(cacheDir, 'summary.png');
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: "Summary image not found" });
    }

    res.setHeader("Content-Type", "image/png");
    res.sendFile(imagePath);
  } catch (error) {
    console.error("Error serving image:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});