require('dotenv').config()

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// In-memory store
const strlist = new Map();

// Analyze a string and compute its properties
function analyzeStr(value) {
  const length = value.length;
  const cleaned = value.toLowerCase().replace(/\s+/g, '');
  const is_palindrome = cleaned === cleaned.split('').reverse().join('');
  const unique_characters = new Set(value).size;
  const word_count = value.trim() === '' ? 0 : value.trim().split(/\s+/).length;

  // Count frequency of each character
  const character_frequency_map = {};
  for (const char of value) {
    character_frequency_map[char] = (character_frequency_map[char] || 0) + 1;
  }

  // Create SHA256 hash
  const sha256_hash = crypto
    .createHash('sha256')
    .update(value, 'utf8')
    .digest('hex');

  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash,
    character_frequency_map,
  };
}

// POST /string — create and store a new string
app.post('/strings', (req, res) => {
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Missing "value" field' });
  }
  if (typeof value !== 'string') {
    return res.status(422).json({ error: 'Value must be a string' });
  }
  if (strlist.has(value)) {
    return res.status(409).json({ error: 'String already exists' });
  }

  const props = analyzeStr(value);
  const record = {
    id: props.sha256_hash,
    value,
    properties: props,
    created_at: new Date().toISOString(),
  };

  strlist.set(value, record);
  res.setHeader('Content-Type', 'application/json');
  return res.status(201).json(record);
});

// GET /string/:value — fetch a specific string
app.get('/strings/:value', (req, res) => {
  const record = strlist.get(req.params.value);
  if (!record) {
    return res.status(404).json({ error: 'String not found' });
  }
  return res.json(record);
});

// ✅ NEW: GET /strings — fetch all strings with filtering
app.get('/strings', (req, res) => {
  const {
    is_palindrome,
    min_length,
    max_length,
    word_count,
    contains_character,
  } = req.query;

  let results = Array.from(strlist.values());

  // Apply filters if provided
  if (is_palindrome !== undefined) {
    const boolVal = is_palindrome === 'true';
    results = results.filter(
      (item) => item.properties.is_palindrome === boolVal
    );
  }

  if (min_length) {
    results = results.filter(
      (item) => item.properties.length >= Number(min_length)
    );
  }

  if (max_length) {
    results = results.filter(
      (item) => item.properties.length <= Number(max_length)
    );
  }

  if (word_count) {
    results = results.filter(
      (item) => item.properties.word_count === Number(word_count)
    );
  }

  if (contains_character) {
    results = results.filter((item) =>
      item.value.toLowerCase().includes(contains_character.toLowerCase())
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

app.get('/strings/filter-by-natural-language', (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const lowerQuery = query.toLowerCase();
  let filters = {};

  // Interpret natural language into filters
  if (lowerQuery.includes('single word')) {
    filters.word_count = 1;
  }
  if (lowerQuery.includes('palindromic')) {
    filters.is_palindrome = true;
  }
  if (lowerQuery.includes('longer than')) {
    const match = lowerQuery.match(/longer than (\d+)/);
    if (match) filters.min_length = Number(match[1]) + 1;
  }
  if (lowerQuery.includes('containing the letter')) {
    const match = lowerQuery.match(/letter\s+([a-z])/);
    if (match) filters.contains_character = match[1];
  }
  if (lowerQuery.includes('contain the first vowel')) {
    filters.contains_character = 'a'; // simple heuristic
  }

  // Handle no matches
  if (Object.keys(filters).length === 0) {
    return res.status(400).json({
      error: 'Unable to parse natural language query',
    });
  }

  // Apply the filters to your string data
  let results = Array.from(strlist.values());

  if (filters.is_palindrome !== undefined) {
    results = results.filter(
      (item) => item.properties.is_palindrome === filters.is_palindrome
    );
  }
  if (filters.min_length) {
    results = results.filter(
      (item) => item.properties.length >= filters.min_length
    );
  }
  if (filters.word_count) {
    results = results.filter(
      (item) => item.properties.word_count === filters.word_count
    );
  }
  if (filters.contains_character) {
    results = results.filter((item) =>
      item.value
        .toLowerCase()
        .includes(filters.contains_character.toLowerCase())
    );
  }

  // Conflict check: e.g. impossible filters
  if (filters.min_length && filters.word_count === 0) {
    return res.status(422).json({
      error: 'Query parsed but resulted in conflicting filters',
    });
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

// DELETE /string/:value — remove a string
app.delete('/strings/:value', (req, res) => {
  if (!strlist.has(req.params.value)) {
    return res.status(404).json({ error: 'String not found' });
  }
  strlist.delete(req.params.value);
  return res.status(204).send();
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
