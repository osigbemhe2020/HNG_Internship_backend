# HNG_Internship_backend

## Stage 1 String Analyzer API
A RESTful API service that analyzes strings and stores their computed properties including palindrome detection, character frequency, word count, and SHA-256 hashing.

### Features
* String Analysis: Computes length, palindrome status, unique characters, word count, SHA-256 hash, and character frequency

* CRUD Operations: Create, read, and delete string analyses

* Advanced Filtering: Filter strings by various properties via query parameters

* Natural Language Processing: Interpret natural language queries for filtering

* In-Memory Storage: Fast data storage using Map data structure

### Prerequisites
* Node.js (v14 or higher)

* npm or yarn

### Installation & Local Setup
1. Clone the repository
```
bash
git clone https://github.com/osigbemhe2020/HNG_Internship_backend.git
cd HNG_Internship_backend
```
2. Install dependencies
```
bash
npm install
```
3. Set up environment variables
Create a .env file in the root directory with the following variables:
```
env
PORT=3000
```
4. Run the application
```
bash
node stageOne.js
or
npm start
```
### Dependencies
* express - Web framework for Node.js

* crypto - Built-in module for SHA-256 hashing

* dotenv - Load environment variables from .env file

### API Endpoints

#### POST /strings
Analyze and store a new string.

##### Request:
```
json
{
  "value": "hello world"
}
```
##### Success Response (201 Created):

```
json
{
  "id": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  "value": "hello world",
  "properties": {
    "length": 11,
    "is_palindrome": false,
    "unique_characters": 8,
    "word_count": 2,
    "sha256_hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    "character_frequency_map": {
      "h": 1,
      "e": 1,
      "l": 3,
      "o": 2,
      " ": 1,
      "w": 1,
      "r": 1,
      "d": 1
    }
  },
  "created_at": "2025-10-17T11:33:07.182Z"
}
```
##### Error Responses:

* 400 Bad Request - Missing "value" field

* 422 Unprocessable Entity - Value must be a string

* 409 Conflict - String already exists

####  GET /strings/{string_value}
Retrieve analysis for a specific string.

##### Success Response (200 OK):
```
json
{
  "id": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  "value": "hello world",
  "properties": {
    "length": 11,
    "is_palindrome": false,
    "unique_characters": 8,
    "word_count": 2,
    "sha256_hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    "character_frequency_map": {
      "h": 1,
      "e": 1,
      "l": 3,
      "o": 2,
      " ": 1,
      "w": 1,
      "r": 1,
      "d": 1
    }
  },
  "created_at": "2025-10-17T11:33:07.182Z"
}
```
##### Error Response:

* 404 Not Found - String does not exist

#### GET /strings
Retrieve all strings with optional filtering.

##### Query Parameters:

* is_palindrome (boolean) - Filter by palindrome status

* min_length (integer) - Minimum string length

* max_length (integer) - Maximum string length

* word_count (integer) - Exact word count

* contains_character (string) - Single character to search for

##### Example Request:
```
text
GET /strings?is_palindrome=true&min_length=5&max_length=20&word_count=1&contains_character=a
```
##### Success Response (200 OK):
```
json
{
  "data": [
    {
      "id": "hash1",
      "value": "racecar",
      "properties": { ... },
      "created_at": "2025-10-17T11:33:07.182Z"
    }
  ],
  "count": 1,
  "filters_applied": {
    "is_palindrome": true,
    "min_length": 5,
    "max_length": 20,
    "word_count": 1,
    "contains_character": "a"
  }
}
```
#### GET /strings/filter-by-natural-language
Filter strings using natural language queries.

##### Query Parameters:

* query (string) - Natural language query

##### Example Queries:

* all single word palindromic strings

* strings longer than 10 characters

* palindromic strings that contain the first vowel

* strings containing the letter z

#### Success Response (200 OK):

```
json
{
  "data": [
    {
      "id": "hash1",
      "value": "racecar",
      "properties": { ... },
      "created_at": "2025-10-17T11:33:07.182Z"
    }
  ],
  "count": 1,
  "interpreted_query": {
    "original": "all single word palindromic strings",
    "parsed_filters": {
      "word_count": 1,
      "is_palindrome": true
    }
  }
}
```
##### Error Responses:

* 400 Bad Request - Unable to parse natural language query

* 422 Unprocessable Entity - Query parsed but resulted in conflicting filters

#### DELETE /strings/{string_value}
Delete a string analysis.

##### Success Response: 204 No Content (empty response body)

##### Error Response:

404 Not Found - String does not exist

### Testing
Tested the endpoints with your browser or postman:

```
text
http://localhost:3000/strings
```

### Live At
* Base URL: hnginternshipbackend-production.up.railway.app

#### Example Live Endpoints:

* hnginternshipbackend-production.up.railway.app/strings

* hnginternshipbackend-production.up.railway.app/strings/hello%20world

* hnginternshipbackend-production.up.railway.app/strings/filter-by-natural-language?query=palindromic%20strings


##  Stage 0 Profile API

 A task to build a simple RESTful API endpoint that returns your profile information along with a dynamic cat fact fetched from an external API

 ### Features

- Created with javascript(node.js) and express library
- GET `/me` endpoint returning profile information
- Returns JSON data with Content-Type: application/json
- Integration with Cat Facts API for dynamic cat facts
- Proper error handling and fallback responses

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

###  Installation & Local Setup

#### 1. Clone the repository
```bash
git clone https://github.com/osigbemhe2020/HNG_Internship_backend.git
cd HNG_Internship_backend
```

#### 2. Install dependencies
```bash
npm install
```
#### 3. Set up environment variables
Create a .env file in the root directory with the following variables:
```.env
CAT_FACT_API_URL=https://catfact.ninja/fact
PORT=3000
```
#### 4.Run the application
```bash
node stageZero.js
or
npm start
```
### Dependencies
- express - Web framework for Node.js
- axios - HTTP client for making API requests
- dotenv - Load environment variables from .env file
- express-rate-limit - For t rate limiting

### API Endpoints
#### GET /me
Returns profile information with a dynamic cat fact.
##### Response:
```json
{
  "status": "success",
  "user": {
    "email": "dirisupaul16@gmail.com",
    "name": "Dirisu Paul",
    "stack": "Node.js/Express.js, MongoDB, MySQL"
  },
  "timestamp": "2025-10-17T11:33:07.182Z",
  "fact": "Researchers are unsure exactly how a cat purrs. Most veterinarians believe that a cat purrs by vibrating vocal folds deep in the throat. To do this, a muscle in the larynx opens and closes the air passage about 25 times per second."
}

```
### Testing
tested the end point with my browser
```text
http://localhost:3000/me
```
### Live At
hnginternshipbackend-production.up.railway.app/me
