require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory store
const strlist = new Map();

/**
 * Analyze a string and compute its properties
 */
function analyzeStr(value) {
  const length = value.length;
  const cleaned = value.toLowerCase().replace(/\s+/g, '');
  const is_palindrome = cleaned === cleaned.split('').reverse().join('');
  const unique_characters = new Set(value).size;
  const word_count = value.trim() === '' ? 0 : value.trim().split(/\s+/).length;

  // Character frequency map
  const character_frequency_map = {};
  for (const char of value) {
    character_frequency_map[char] = (character_frequency_map[char] || 0) + 1;
  }

  // SHA256 hash
  const sha256_hash = crypto.createHash('sha256').update(value, 'utf8').digest('hex');

  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash,
    character_frequency_map,
  };
}

/**
 * POST /strings — create a new string
 */
app.post('/strings', (req, res) => {
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Missing "value" field' });
  }
  if (typeof value !== 'string') {
    return res.status(422).json({ error: 'Value must be a string' });
  }

  const props = analyzeStr(value);
  const id = props.sha256_hash;

  if (strlist.has(id)) {
    return res.status(409).json({ error: 'String already exists' });
  }

  const record = {
    id,
    value,
    properties: props,
    created_at: new Date().toISOString(),
  };

  strlist.set(id, record);
  res.setHeader('Content-Type', 'application/json');
  return res.status(201).json(record);
});

/**
 * GET /strings/:value — fetch a specific string
 */
app.get('/strings/:value', (req, res) => {
  const searchValue = req.params.value;
  const record = Array.from(strlist.values()).find((r) => r.value === searchValue);

  if (!record) {
    return res.status(404).json({ error: 'String not found' });
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(record);
});

/**
 * GET /strings — get all strings with optional filters
 */
app.get('/strings', (req, res) => {
  const { is_palindrome, min_length, max_length, word_count, contains_character } = req.query;
  let results = Array.from(strlist.values());

  if (is_palindrome !== undefined) {
    const boolVal = is_palindrome === 'true';
    results = results.filter((r) => r.properties.is_palindrome === boolVal);
  }
  if (min_length) {
    results = results.filter((r) => r.properties.length >= Number(min_length));
  }
  if (max_length) {
    results = results.filter((r) => r.properties.length <= Number(max_length));
  }
  if (word_count) {
    results = results.filter((r) => r.properties.word_count === Number(word_count));
  }
  if (contains_character) {
    results = results.filter((r) =>
      r.value.toLowerCase().includes(contains_character.toLowerCase())
    );
  }

  const response = {
    data: results,
    count: results.length,
    filters_applied: {
      is_palindrome: is_palindrome ? is_palindrome === 'true' : undefined,
      min_length: min_length ? Number(min_length) : undefined,
      max_length: max_length ? Number(max_length) : undefined,
      word_count: word_count ? Number(word_count) : undefined,
      contains_character: contains_character || undefined,
    },
  };

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(response);
});

/**
 * GET /strings/filter-by-natural-language — interpret human-readable query
 */
app.get('/strings/filter-by-natural-language', (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const q = query.toLowerCase();
  const filters = {};

  // Match known natural language patterns
  if (q.includes('single word')) filters.word_count = 1;
  if (q.includes('palindromic') || q.includes('palindrome')) filters.is_palindrome = true;

  const longerThan = q.match(/longer than (\d+)/);
  if (longerThan) filters.min_length = Number(longerThan[1]) + 1;

  const letterMatch = q.match(/letter\s+([a-z])/);
  if (letterMatch) filters.contains_character = letterMatch[1];

  if (q.includes('contain the first vowel')) filters.contains_character = 'a';

  // If nothing parsed, return 400
  if (Object.keys(filters).length === 0) {
    return res.status(400).json({ error: 'Unable to parse natural language query' });
  }

  // Apply filters
  let results = Array.from(strlist.values());
  if (filters.is_palindrome !== undefined) {
    results = results.filter((r) => r.properties.is_palindrome === filters.is_palindrome);
  }
  if (filters.min_length) {
    results = results.filter((r) => r.properties.length >= filters.min_length);
  }
  if (filters.word_count) {
    results = results.filter((r) => r.properties.word_count === filters.word_count);
  }
  if (filters.contains_character) {
    results = results.filter((r) =>
      r.value.toLowerCase().includes(filters.contains_character.toLowerCase())
    );
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters: filters,
    },
  });
});

/**
 * DELETE /strings/:value — remove a string
 */
app.delete('/strings/:value', (req, res) => {
  const searchValue = req.params.value;
  const entry = Array.from(strlist.entries()).find(([, r]) => r.value === searchValue);

  if (!entry) {
    return res.status(404).json({ error: 'String not found' });
  }

  const [id] = entry;
  strlist.delete(id);

  return res.status(204).send();
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
