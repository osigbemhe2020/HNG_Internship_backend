const express = require('express');
const axios = require('axios');

const app = express();

const myProfile = {
        email: 'dirisupaul16@gmail.com',
        name: 'Dirisu Paul',
        stack: 'Node.js/Express.js, MongoDB, MySQL',
}

const CAT_FACT_API_URL = process.env.CAT_FACT_API_URL || 'https://catfact.ninja/fact';

// Define the /me endpoint
app.get('/me', async (req, res) => {

  try {
    // Fetch a random cat fact with a 3-second timeout
      const APIresponse = await axios.get(CAT_FACT_API_URL, { timeout: 3000 });

      // Construct of the response
      const response = {
        status: 'success',
        user: myProfile,       
        timestamp: new Date().toISOString(),
        fact: APIresponse.data.fact, 
      };
      res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(response);
    }
   catch (error) {
      console.error('Error fetching cat fact:', error.message);

    // Fallback: return response with a default fact if API fails
      const fallbackResponse = {
        status: "failed",
        user: myProfile,
        timestamp: getCurrentUTC(),
        fact: "could not fetch any fact because the API call failed"
      };

      // Handle timeout errors specifically
      if (error.code === 'ECONNABORTED') {
        res.setHeader('Content-Type', 'application/json');
        return res.status(504).json({fallbackResponse});
      }

      // Handle all other API failures
      return res.status(503).json(fallbackResponse);
  }
});
// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
