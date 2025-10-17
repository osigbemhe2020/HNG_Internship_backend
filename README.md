# HNG_Internship_backend

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
