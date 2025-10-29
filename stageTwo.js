const express = require("express");
const axios = require("axios");
const mysql = require("mysql2/promise"); 
const { createCanvas } = require("canvas");

require('dotenv').config();
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

(async () => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS hng_stage_two_countries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        capital VARCHAR(100),
        region VARCHAR(100),
        population BIGINT NOT NULL,
        currency_code VARCHAR(10) NOT NULL,
        exchange_rate DECIMAL(10,4) NOT NULL,
        estimated_gdp DECIMAL(20,2) NOT NULL,
        flag_url VARCHAR(255),
        last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await connection.query(createTableQuery);
    console.log("Table is ready.");
  } catch (error) {
    console.error(" Error creating table:", error.message);
  } finally {
    if (connection) await connection.end();
  }
})();

//POST route to refresh country data
app.post("/countries/refresh", async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    console.log("Fetching country data...");
    const { data: countriesData } = await axios.get(COUNTRY_API, { timeout: 10000 });

    console.log(" Fetching exchange rates...");
    const { data: exchangeData } = await axios.get(EXCHANGE_API, { timeout: 10000 });
    const exchangeRates = exchangeData.rates;

    // ✅ Clear old data to prevent duplicates
    await connection.query("DELETE FROM hng_stage_two_countries");

    // ✅ Insert new country data
    for (const country of countriesData) {
      const currency = country.currencies?.[0]?.code || "USD";
      const exchangeRate = exchangeRates[currency] || 1; // default to 1 if not found
      const randomFactor = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
      const estimatedGDP = (country.population * randomFactor) / exchangeRate;

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
    res.status(200).json({ message: "Countries refreshed successfully" });
  } catch (error) {
    console.error(" Error refreshing countries:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});


app.get("/countries", async (req, res) => {
  const { region, currency, sort } = req.query;

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    let sql = "SELECT * FROM hng_stage_two_countries WHERE 1=1";
    const params = [];

    // ✅ Apply filters
    if (region) {
      sql += " AND region = ?";
      params.push(region);
    }
    if (currency) {
      sql += " AND currency_code = ?";
      params.push(currency);
    }

    // ✅ Apply sorting
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
      return res.status(404).json({ message: "Country not found" });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

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
      return res.status(404).json({ message: "Country not found" });
    }

    res.status(200).json({ message: `${name} deleted successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});


app.get("/status", async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS total_countries, MAX(last_refreshed_at) AS last_refresh 
      FROM hng_stage_two_countries
    `);

    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});


app.get("/countries/image", async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS total_countries, MAX(last_refreshed_at) AS last_refresh 
      FROM hng_stage_two_countries
    `);

    const { total_countries, last_refresh } = rows[0];

    // Create canvas image
    const canvas = createCanvas(600, 300);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(0, 0, 600, 300);

    // Text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px Arial";
    ctx.fillText("🌍 HNG Stage 2 - Country Summary", 50, 70);
    ctx.font = "18px Arial";
    ctx.fillText(`Total Countries: ${total_countries}`, 50, 130);
    ctx.fillText(`Last Refreshed: ${new Date(last_refresh).toLocaleString()}`, 50, 180);
    ctx.fillText("API Powered by RESTCountries & ER-API", 50, 240);

    // Send as PNG
    res.setHeader("Content-Type", "image/png");
    canvas.createPNGStream().pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

  const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
    console.log(` Server running on http://localhost:${PORT}`);
    });