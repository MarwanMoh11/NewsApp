// index.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { Groq } = require('groq-sdk');
const serverless = require('serverless-http');
// --- NEW IMPORTS for Auth0 JWT Validation ---
const { expressjwt: jwtMiddleware } = require('express-jwt'); // Renamed to avoid conflict
const jwksRsa = require('jwks-rsa');
// --- END NEW IMPORTS ---
const AUTH0_DOMAIN = 'dev-1uzu6bsvrd2mj3og.us.auth0.com'; // Your Auth0 domain
const AUTH0_AUDIENCE = 'chronically-backend-api'; // **REPLACE THIS** with your Auth0 API Identifier (Audience)

// ----------------------------------------------
//   CONFIGURATION (NO ENV VARIABLES)
// ----------------------------------------------
const app = express();
const router = express.Router();

const JWT_SECRET = 'your_jwt_secret_here'; // In production, store securely
const GROQ_API_KEY = process.env.GROQ_API_KEY; // Your Groq API Key

// ----------------------------------------------
//   CORS CONFIG
// ----------------------------------------------
const allowedOrigins = [
  'https://keen-alfajores-31c262.netlify.app',
  'http://localhost:8081',
];

const corsOptions = {
  origin: '*', // Allow all origins
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// ----------------------------------------------
//   Auth0 JWT Validation Middleware
// ----------------------------------------------
const checkJwt = jwtMiddleware({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
  }),
  audience: AUTH0_AUDIENCE,
  issuer: `https://${AUTH0_DOMAIN}/`,
  algorithms: ['RS256']
});

// ... (Your existing JWT helpers if needed for other routes) ...

// ----------------------------------------------
//   JWT HELPERS
// ----------------------------------------------
function signUserData(username, currentArticleId = null, currentTweetLink = null, tweettodisp = null) {
  const payload = {
    username,
    currentArticleId,
    currentTweetLink,
    tweettodisp,
  };
  return jwt.sign(payload, JWT_SECRET);
}

function verifyUserData(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ----------------------------------------------
//   MYSQL POOL (PROMISE-BASED & CALLBACK STYLE)
// ----------------------------------------------
const pool = mysql.createPool({
  host: 'monorail.proxy.rlwy.net',
  user: 'root',
  password: 'gDUjVJApPCahWwbpByGdbtjDSsLsRrTn',
  database: 'chronically',
  port: 55952,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// For the `/explain_tweet` route, we need promise-based queries:
const poolPromise = pool.promise();

// ----------------------------------------------
//   TEST ROUTES
// ----------------------------------------------
app.get('/test', (req, res) => {
  res.json({ message: 'CORS is working!' });
});
router.get('/test', (req, res) => {
  res.json({ message: 'CORS is working!' });
});

// -----------------------------------------------------------
//  EXPLAIN_TWEET ROUTE (Promise-based, NO streaming)
// -----------------------------------------------------------
router.post('/explain_tweet', async (req, res) => {
    try {
        const { tweetlink } = req.body;
        if (!tweetlink) {
            console.error('[Error] Missing tweetlink in request body.');
            return res
                .status(400)
                .json({ status: 'Error', message: "Missing 'tweetlink' in request body." });
        }

        console.log(`Received request to explain tweet: ${tweetlink}`);

        // 1) Check if the tweet already has an explanation
        const selectQuery = `
      SELECT Explanation, Tweet, Media_URL
      FROM Tweets
      WHERE Tweet_Link = ?
      LIMIT 1;
    `;
        console.log('Executing SELECT query to check existing explanation.');

        const [results] = await poolPromise.query(selectQuery, [tweetlink]);
        if (results.length === 0) {
            console.warn(`[Warning] Tweet not found for link: ${tweetlink}`);
            return res.status(404).json({ status: 'Error', message: 'Tweet not found.' });
        }

        const tweetData = results[0];
        console.log(`Tweet found. Explanation exists: ${tweetData.Explanation ? 'Yes' : 'No'}`);

        // If explanation already exists, return it
        if (tweetData.Explanation) {
            console.log('Returning existing explanation.');
            return res.status(200).json({ status: 'Success', explanation: tweetData.Explanation });
        }

        // 2) Generate a new explanation using Groq (non-streaming)
        console.log('Initializing Groq client.');
        const groq_client = new Groq({
            apiKey: process.env.GROQ_API_KEY, // Ensure this environment variable is set
        });

        const selectedModel = 'llama3-8b-8192';
        console.log('Creating chat completion with Groq (non-streaming).');

        // Create a content string that includes media information if available
        let userContent = tweetData.Tweet;
        if (tweetData.Media_URL) {
            userContent = `This tweet has an associated image/media at URL: ${tweetData.Media_URL}\n\nTweet content: ${tweetData.Tweet}`;
        }

        let completionResponse;
        try {
            completionResponse = await groq_client.chat.completions.create({
                model: selectedModel,
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a social media assistant. Explain the following tweet in a professional, article-friendly way. If there is an image/media mentioned, include it in your explanation context. Do not add unrelated content. Start your response straight away.', // Refined prompt with media instruction
                    },
                    {
                        role: 'user',
                        content: userContent,
                    },
                ],
                temperature: 0.4,
                max_tokens: 1024,
                top_p: 1,
                // No 'stream: true' here, so we'll get a single completion response.
                stop: null,
            });
            console.log('Groq completion successful.');
        } catch (initError) {
            console.error('Error initializing Groq completion:', initError);
            return res
                .status(500)
                .json({ status: 'Error', message: 'Failed to get explanation from Groq.' });
        }

        // 3) Extract the explanation from the Groq response
        console.log('Parsing explanation from Groq response.');
        const explanation = completionResponse?.choices?.[0]?.message?.content?.trim() || '';

        if (!explanation) {
            console.error('[Error] No explanation returned by Groq.');
            return res
                .status(500)
                .json({ status: 'Error', message: 'No valid explanation generated.' });
        }

        // 4) Update DB with new explanation
        const updateQuery = `
      UPDATE Tweets
      SET Explanation = ?
      WHERE Tweet_Link = ?;
    `;
        console.log('Updating the database with the new explanation.');

        try {
            const [updateResult] = await poolPromise.query(updateQuery, [explanation, tweetlink]);
            console.log(`Database update successful. Rows affected: ${updateResult.affectedRows}`);
        } catch (updateErr) {
            console.error('Database error while updating explanation:', updateErr);
            return res
                .status(500)
                .json({ status: 'Error', message: 'Error saving explanation in DB.' });
        }

        // 5) Return success with explanation
        console.log('Returning the generated explanation to the client.');
        return res.status(200).json({ status: 'Success', explanation });
    } catch (error) {
        console.error('Unexpected error in /explain_tweet route:', error);
        return res
            .status(500)
            .json({ status: 'Error', message: 'Internal Server Error' });
    }
});

// Add this inside your index.js where other router.get/router.post are

// --- TEMPORARY JWKS Connectivity Test Route ---
router.get('/test-jwks', (req, res) => {
    const https = require('https');
    const jwksUri = `https://${AUTH0_DOMAIN}/.well-known/jwks.json`; // Uses AUTH0_DOMAIN from your config
    console.log(`[test-jwks] Attempting to fetch: ${jwksUri}`);

    https.get(jwksUri, (apiRes) => {
        let data = '';
        console.log(`[test-jwks] Status Code: ${apiRes.statusCode}`);
        apiRes.on('data', (chunk) => { data += chunk; });
        apiRes.on('end', () => {
            try {
                const jsonData = JSON.parse(data);
                console.log('[test-jwks] Successfully fetched and parsed JWKS.');
                res.json({ status: 'Success', message: `JWKS fetched successfully. Found ${jsonData?.keys?.length || 0} keys.` });
            } catch(e) {
                console.error('[test-jwks] Error parsing JWKS JSON:', e);
                res.status(500).json({ status: 'Error', message: 'Failed to parse JWKS JSON', error: e.message });
            }
        });
    }).on('error', (err) => {
        console.error('[test-jwks] Error fetching JWKS URL:', err);
        res.status(500).json({ status: 'Error', message: 'Failed to fetch JWKS URL', error: err.message });
    });
});
// --- END TEMPORARY TEST ROUTE ---

// -----------------------------------------------------------
//  EXPLAIN_ARTICLE ROUTE (Promise-based, NO streaming)
// -----------------------------------------------------------
router.post('/explain_article', async (req, res) => {
    try {
        const { article_id } = req.body;
        if (!article_id) {
            console.error('[Error] Missing article_id in request body.');
            return res
                .status(400)
                .json({ status: 'Error', message: "Missing 'article_id' in request body." });
        }

        console.log(`Received request to explain article ID: ${article_id}`);

        // 1) Check if the article already has an explanation
        const selectQuery = `
            SELECT headline, short_description, Explanation, image_url
            FROM Articles
            WHERE id = ?
                LIMIT 1;
        `;
        console.log('Executing SELECT query to check existing explanation.');

        // Ensure poolPromise is correctly initialized and handles connections
        const [results] = await poolPromise.query(selectQuery, [article_id]);

        if (!results || results.length === 0) { // Check if results array exists and is not empty
            console.warn(`[Warning] Article not found for ID: ${article_id}`);
            return res.status(404).json({ status: 'Error', message: 'Article not found.' });
        }

        const articleData = results[0];
        // Check if the Explanation property exists and is not null/empty
        const existingExplanation = articleData.Explanation;
        console.log(
            `Article found. Explanation exists: ${existingExplanation ? 'Yes' : 'No'}`
        );

        // If explanation already exists and is not empty, return it
        if (existingExplanation) {
            console.log('Returning existing explanation.');
            return res
                .status(200)
                .json({ status: 'Success', explanation: existingExplanation });
        }

        // 2) Generate a new explanation using Groq (non-streaming)
        // Ensure GROQ_API_KEY is available in environment variables
        if (!process.env.GROQ_API_KEY) {
            console.error('[Error] GROQ_API_KEY environment variable not set.');
            return res.status(500).json({ status: 'Error', message: 'AI configuration error.' });
        }
        console.log('Initializing Groq client.');
        const groq_client = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });

        const selectedModel = 'llama3-8b-8192';
        const descriptionToExplain = articleData.short_description || articleData.headline || 'No description provided.'; // Use headline as fallback
        console.log(`Creating chat completion with Groq model ${selectedModel}. Content to explain length: ${descriptionToExplain.length}`);

        // Create a content string that includes image information if available
        let userContent = descriptionToExplain;
        if (articleData.image_url) {
            userContent = `This content has an associated image at URL: ${articleData.image_url}\n\nContent to explain: ${descriptionToExplain}`;
        }

        let completionResponse;
        try {
            completionResponse = await groq_client.chat.completions.create({
                model: selectedModel,
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a helpful assistant. Explain the following piece of text clearly. If there is an image mentioned, include it in your explanation context. Start off your response with the explanation straight away', // Refined prompt with image instruction
                    },
                    {
                        role: 'user',
                        content: userContent,
                    },
                ],
                temperature: 0.5, // Adjusted temperature slightly
                max_tokens: 150, // Reduced max tokens for concise explanation
                top_p: 1,
                stop: null,
            });
            console.log('Groq completion successful.');
        } catch (groqError) {
            console.error('Error calling Groq API:', groqError);
            return res
                .status(500)
                .json({ status: 'Error', message: 'Failed to get explanation from AI service.' });
        }

        // 3) Extract the explanation from the Groq response
        console.log('Parsing explanation from Groq response.');
        const explanation = completionResponse?.choices?.[0]?.message?.content?.trim() || '';

        if (!explanation) {
            console.error('[Error] No explanation content returned by Groq.');
            return res
                .status(500)
                .json({ status: 'Error', message: 'AI service did not generate an explanation.' });
        }
        console.log(`Generated explanation length: ${explanation.length}`);

        // 4) Update DB with new explanation
        const updateQuery = `
            UPDATE Articles
            SET Explanation = ?
            WHERE id = ?;
        `;
        console.log('Updating the database with the new explanation.');

        try {
            const [updateResult] = await poolPromise.query(updateQuery, [explanation, article_id]);
            // Check if the update actually affected a row
            if (updateResult.affectedRows > 0) {
                console.log(`Database update successful. Rows affected: ${updateResult.affectedRows}`);
            } else {
                console.warn(`Database update seemed successful but no rows were affected for article ID: ${article_id}. Explanation might not be saved.`);
                // Decide if this should be an error or just a warning
            }
        } catch (updateErr) {
            console.error('Database error while updating explanation:', updateErr);
            // Don't necessarily fail the whole request if DB update fails, could still return the generated explanation
            // return res.status(500).json({ status: 'Error', message: 'Error saving explanation in DB.' });
            console.warn(`Failed to save generated explanation to DB for article ID: ${article_id}. Returning explanation anyway.`);
        }

        // 5) Return success with explanation (even if DB update failed, maybe?)
        console.log('Returning the generated explanation to the client.');
        return res.status(200).json({ status: 'Success', explanation });

    } catch (error) {
        console.error('Unexpected error in /explain_article route:', error);
        return res
            .status(500)
            .json({ status: 'Error', message: 'Internal Server Error' });
    }
});


// Test route
// PASTE THIS into your backend router file, replacing the existing '/get-articles' route

router.post('/get-articles', (req, res) => {
  // Destructure categories, page, and limit from request body
  const { categories, page = 1, limit = 15 } = req.body; // Default to page 1, limit 15

  // Validate page and limit
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1) {
    return res.status(400).json({ status: 'Error', error: 'Invalid page or limit parameter.' });
  }

  // Calculate OFFSET for SQL query
  const offset = (pageNumber - 1) * limitNumber;

  let query, values = [];

  if (categories && Array.isArray(categories) && categories.length > 0) {
    // --- Query for specific categories with pagination ---
    const conditions = categories.map(() => `category LIKE ?`).join(' OR ');
    query = `
      SELECT id, link, headline, category, short_description, authors, date, clusterID, image_url
      FROM Articles
      WHERE ${conditions}
      ORDER BY DATE DESC
      LIMIT ? OFFSET ?;
    `;
    // Values include categories, then limit, then offset
    values = [...categories.map(cat => `%${cat}%`), limitNumber, offset];
  } else {
    // --- Query for "all" categories (or default) with pagination ---
    // Note: The original code had an 'all' string check, which might be unnecessary
    // if sending an empty categories array means "all". Assuming empty array means all for simplicity.
    // If you specifically need to handle the string "all", adjust the condition.
    query = `
      SELECT id, link, headline, category, short_description, authors, date, clusterID, image_url
      FROM Articles
      ORDER BY DATE DESC
      LIMIT ? OFFSET ?;
    `;
    // Values are just limit and offset
    values = [limitNumber, offset];
  }
  // Removed the check for `categories === 'all'` as sending an empty array or no array
  // should ideally trigger the default "fetch all (paginated)" case.
  // If you rely on the string 'all', you might need to adjust the conditional logic slightly.

  console.log(`Executing Article Query (Page: ${pageNumber}, Limit: ${limitNumber}):`, query); // Optional logging
  console.log(`With Values:`, values); // Optional logging

  pool.query(query, values, (fetchError, results) => {
    if (fetchError) {
      console.error("Article Fetch Error:", fetchError.message); // Log error
      return res.status(500).json({ status: 'Error', error: fetchError.message });
    }
    // Check if results is an array (it should be)
    if (Array.isArray(results)) {
        console.log(`Articles Found: ${results.length}`); // Optional logging
        return res.json({
            status: results.length > 0 ? 'Articles found' : 'No articles found',
            data: results,
            // Optionally include pagination info in response if needed by frontend
            // page: pageNumber,
            // limit: limitNumber,
            // hasMore: results.length === limitNumber // Simple check if more *might* exist
        });
    } else {
         // Handle unexpected result format
         console.error("Unexpected result format from DB:", results);
         return res.status(500).json({ status: 'Error', error: 'Unexpected database response format.' });
    }
  });
});

router.post('/get-allarticles', (req, res) => {
  const { categories } = req.body;
  let query, values = [];

  if (categories && Array.isArray(categories) && categories.length > 0) {
    const conditions = categories.map(() => `category LIKE ?`).join(' OR ');
    query = `
      SELECT id, link, headline, category, short_description, authors, date, clusterID, image_url
      FROM Articles
      WHERE ${conditions}
      ORDER BY date DESC;
    `;
    values = categories.map(cat => `%${cat}%`);
  } else if (categories && categories.toLowerCase() === 'all') {
    query = `
      SELECT id, link, headline, category, short_description, authors, date, clusterID, image_url
      FROM Articles
      ORDER BY date DESC;
    `;
  } else {
    return res.status(400).json({ status: 'Error', error: 'Please provide an array of categories or "all".' });
  }

  pool.query(query, values, (fetchError, results) => {
    if (fetchError) {
      return res.status(500).json({ status: 'Error', error: fetchError.message });
    }
    if (results.length > 0) {
      return res.json({ status: 'Articles found', data: results });
    } else {
      return res.json({ status: 'No articles found' });
    }
  });
});


// PASTE THIS into your backend router file, replacing the existing '/get-tweets' route

/**
 * @route POST /get-tweets
 * @description Gets tweets with optional category/region filters, pagination,
 * sorted by recent interaction count then date.
 * @access Public (or add authentication middleware as needed)
 */
router.post('/get-tweets', (req, res) => {
  // Destructure categories, region, page, and limit from request body
  const { categories, region, page = 1, limit = 15 } = req.body;

  // Validate page and limit
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1) {
    return res.status(400).json({ status: 'Error', error: 'Invalid page or limit parameter.' });
  }
  const offset = (pageNumber - 1) * limitNumber;

  // --- Build WHERE Clause Dynamically ---
  const whereClauses = [];
  const whereParams = []; // Parameters specifically for the WHERE clause

  // Add category conditions
  if (categories && Array.isArray(categories) && categories.length > 0) {
    const categoryConditions = categories.map(() => `T.categories LIKE ?`).join(' OR ');
    whereClauses.push(`(${categoryConditions})`);
    whereParams.push(...categories.map(cat => `%${cat}%`));
  }

  // Add region condition
  if (region && typeof region === 'string' && region.trim() !== '') {
    whereClauses.push('T.Region = ?');
    whereParams.push(region.trim());
  }

  // Construct the final WHERE clause string (or empty if no filters)
  const whereClauseSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // --- Construct Final SQL Query ---
  const query = `
    SELECT
        T.Username, T.Tweet, T.Created_At, T.Retweets, T.Favorites, T.Tweet_Link,
        T.Media_URL, T.Explanation, T.categories, T.Region,
        COALESCE(RecentActivity.interaction_count, 0) AS recent_interactions
    FROM
        Tweets T
    LEFT JOIN (
        -- Subquery to count recent interactions (last 7 days) for each tweet
        SELECT
            item_id, -- This should match the Tweet_Link
            COUNT(*) AS interaction_count
        FROM
            UserInteractions
        WHERE
            item_type = T.sourcename
            AND interaction_timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY
            item_id
    ) AS RecentActivity ON T.Tweet_Link = RecentActivity.item_id
    ${whereClauseSql} -- Add the dynamic WHERE clause here
    ORDER BY
        -- Sort by recent interaction count first, then by creation date
        recent_interactions DESC,
        T.Created_At DESC
    LIMIT ? OFFSET ?;
  `;

  // Combine WHERE parameters with pagination parameters
  const finalParams = [...whereParams, limitNumber, offset];

  console.log(`Executing /get-tweets Query (Page: ${pageNumber}, Limit: ${limitNumber}, Region: ${region || 'Any'})`);
  // console.log("SQL:", query); // Uncomment to debug SQL
  // console.log("Params:", finalParams); // Uncomment to debug parameters

  // Execute Query
  pool.query(query, finalParams, (err, results) => {
    if (err) {
      console.error("Tweet Fetch Error (/get-tweets):", err.message, err.sql);
      return res.status(500).json({ status: 'Error', error: 'Database error while fetching tweets.' });
    }

    if (Array.isArray(results)) {
        console.log(`/get-tweets Found: ${results.length}`);
        return res.json({
            status: results.length > 0 ? 'Tweets found' : 'No tweets found for the given criteria',
            data: results,
        });
    } else {
         console.error("Unexpected result format from DB (/get-tweets):", results);
         return res.status(500).json({ status: 'Error', error: 'Unexpected database response format.' });
    }
  });
});


router.post('/get-alltweets', (req, res) => {
  // Destructure categories and region from request body
  const { categories, region } = req.body;

  // --- Build WHERE Clause Dynamically ---
  const whereClauses = [];
  const whereParams = []; // Parameters specifically for the WHERE clause

  // Add category conditions (handle 'all' string explicitly if needed, otherwise assume array)
  const useCategoryFilter = categories && Array.isArray(categories) && categories.length > 0;
  if (useCategoryFilter) {
    const categoryConditions = categories.map(() => `T.categories LIKE ?`).join(' OR ');
    whereClauses.push(`(${categoryConditions})`);
    whereParams.push(...categories.map(cat => `%${cat}%`));
  } else if (categories && typeof categories === 'string' && categories.toLowerCase() === 'all') {
    // No category filter needed if 'all' is specified
  } else if (categories) {
    // Handle invalid categories input if necessary, or ignore
    console.warn("Received non-array/non-'all' categories for /get-alltweets:", categories);
    // Depending on desired behavior, you might return an error or just proceed without category filter
    // return res.status(400).json({ status: 'Error', error: 'Invalid format for categories. Provide an array or "all".' });
  }

  // Add region condition
  if (region && typeof region === 'string' && region.trim() !== '') {
    whereClauses.push('T.Region = ?');
    whereParams.push(region.trim());
  }

  // Construct the final WHERE clause string
  const whereClauseSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // --- Construct Final SQL Query ---
  const query = `
    SELECT
        T.Username, T.Tweet, T.Created_At, T.Retweets, T.Favorites, T.Tweet_Link,
        T.Media_URL, T.Explanation, T.categories, T.Region,
        COALESCE(RecentActivity.interaction_count, 0) AS recent_interactions
    FROM
        Tweets T
    LEFT JOIN (
        -- Subquery to count recent interactions (last 7 days) for each tweet
        SELECT
            item_id, COUNT(*) AS interaction_count
        FROM
            UserInteractions
        WHERE
            item_type = T.sourcename
            AND interaction_timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY item_id
    ) AS RecentActivity ON T.Tweet_Link = RecentActivity.item_id
    ${whereClauseSql} -- Add the dynamic WHERE clause here
    ORDER BY
        -- Sort by recent interaction count first, then by creation date
        recent_interactions DESC,
        T.Created_At DESC;
        -- Removed LIMIT/OFFSET for get-alltweets
  `;

  // Parameters are only those needed for the WHERE clause
  const finalParams = whereParams;

  console.log(`Executing /get-alltweets Query (Region: ${region || 'Any'})`);
  // console.log("SQL:", query); // Uncomment to debug SQL
  // console.log("Params:", finalParams); // Uncomment to debug parameters

  // Execute Query
  pool.query(query, finalParams, (err, results) => {
    if (err) {
      console.error("All Tweets Fetch Error (/get-alltweets):", err.message, err.sql);
      return res.status(500).json({ status: 'Error', error: 'Database error while fetching all tweets.' });
    }

    if (Array.isArray(results)) {
      console.log(`/get-alltweets Found: ${results.length}`);
      return res.json({
          status: results.length > 0 ? 'Tweets found' : 'No tweets found for the given criteria',
          data: results
      });
    } else {
      console.error("Unexpected result format from DB (/get-alltweets):", results);
      return res.status(500).json({ status: 'Error', error: 'Unexpected database response format.' });
    }
  });
});

// index.js (Backend)

// --- Ensure these are defined above ---
// const { expressjwt: jwtMiddleware } = require('express-jwt');
// const jwksRsa = require('jwks-rsa');
// const pool = require('./your-db-connection-setup'); // Make sure pool is correctly initialized
// const checkJwt = jwtMiddleware({ ... configuration ... }); // Make sure checkJwt middleware is defined

// --- Route Definition for Personalized Feed (using JWT Auth + Username Lookup) ---

// PASTE THIS into index.js, replacing the existing /get-for-you-feed

// PASTE THIS into index.js, replacing the previous /get-for-you-feed route

// PASTE THIS into index.js, replacing the /get-for-you-feed route handler AGAIN
// This version ONLY includes Tweets but uses the REPOST boost logic.

/**
 * @route POST /get-for-you-feed
 * @description Gets a personalized feed of **Tweets ONLY**, boosted by shares from followed users,
 * using the **CUSTOM** JWT system.
 * @access Private (Requires custom JWT in request body)
 */
// *** REMOVED 'checkJwt' MIDDLEWARE ***
// Assuming 'pool' is your database connection pool from 'db.js' or similar
// Assuming 'verifyUserData' function exists, takes a token, and returns { username: '...' } or null

/**
 * @route POST /get-for-you-feed
 * @description Gets a personalized feed of **Tweets ONLY**, boosted by shares, user interactions,
 * preferences, and user's region (fetched server-side). Uses **CUSTOM** JWT system.
 * @access Private (Requires custom JWT in request body)
 */
router.post('/get-for-you-feed', (req, res) => {
    // 1. Get token and pagination params from request BODY
    const { token, page = 1, limit = 15 } = req.body; // No longer need region from body

    if (!token) {
        return res.status(400).json({ status: 'Error', message: 'Token is required in request body.' });
    }

    // 2. Verify the custom token to get username
    const userPayload = verifyUserData(token); // Uses jwt.verify(token, JWT_SECRET)
    if (!userPayload || !userPayload.username) {
        console.error("Invalid or expired custom token received for /get-for-you-feed");
        return res.status(401).json({ status: 'Error', message: 'Invalid or expired token.' });
    }
    const currentUsername = userPayload.username;
    console.log(`Request /get-for-you-feed for User: ${currentUsername}. Fetching region...`);

    // --- Pagination Logic ---
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1) {
        return res.status(400).json({ status: 'Error', error: 'Invalid page or limit parameter.' });
    }
    const offset = (pageNumber - 1) * limitNumber;

    // --- 3. Fetch User's Region from DB ---
    // Adjust Table ('Users', 'Profiles', 'Preferences'?) and Column ('region', 'user_region'?) as needed
    const regionQuery = 'SELECT region FROM Users_new WHERE username = ? LIMIT 1';
    pool.query(regionQuery, [currentUsername], (regionErr, regionResults) => {

        if (regionErr) {
            console.error(`Database error fetching region for user ${currentUsername}:`, regionErr.message);
            // Decide strategy: return error or proceed without region boost?
            // Proceeding without boost might be better UX than failing the whole feed.
            console.warn(`Proceeding with /get-for-you-feed for ${currentUsername} without region data due to DB error.`);
            // Set region to null and continue
            executeFeedQuery(null);
        } else {
            let userRegionFromDB = null;
            if (regionResults && regionResults.length > 0 && regionResults[0].region) {
                userRegionFromDB = regionResults[0].region;
                console.log(`Found region '${userRegionFromDB}' for user ${currentUsername}`);
            } else {
                console.log(`No region found in DB for user ${currentUsername}.`);
            }
            // Execute the main query with the fetched region (or null)
            executeFeedQuery(userRegionFromDB);
        }
    }); // End region query callback

    // --- Function to execute the main feed query ---
    // This avoids deep nesting and makes error handling slightly cleaner
    const executeFeedQuery = (userRegion) => {
        const feedQuery = `
        WITH
          UserPreferences AS (
            SELECT preference
            FROM Preferences
            WHERE username = ?
          ),

          UserTweetCategoryInteraction AS (
            SELECT
              TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(T.categories, ',', numbers.n), ',', -1)) AS category,
              COUNT(DISTINCT UI.interaction_id)               AS user_category_interactions
            FROM UserInteractions UI
            JOIN Tweets T
              ON UI.item_type = T.sourcename
             AND UI.item_id   = T.Tweet_Link
            JOIN (
               SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3
               UNION ALL SELECT 4 UNION ALL SELECT 5
            ) AS numbers
              ON CHAR_LENGTH(T.categories)
                 - CHAR_LENGTH(REPLACE(T.categories, ',', ''))
                 >= numbers.n - 1
            WHERE
              UI.username             = ?
              AND UI.interaction_timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY category
          ),

          TweetRecentPopularity AS (
            SELECT UI.item_type,
                   UI.item_id,
                   COUNT(*) AS interaction_count
            FROM UserInteractions UI
            WHERE UI.interaction_timestamp
                  >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY UI.item_type, UI.item_id
          ),

          FollowingList AS (
            SELECT followed_username
            FROM follows
            WHERE follower_username = ? AND accepted = 1
          ),

          FollowedShares AS (
            SELECT
              st.tweet_link AS item_id,
              MAX(st.shared_at) AS last_shared_at
            FROM shared_tweets st
            JOIN FollowingList fl
              ON st.username = fl.followed_username
            GROUP BY st.tweet_link
          )

        SELECT
          T.sourcename   AS item_type,
          T.Tweet_Link   AS item_id,
          T.Created_At   AS created_at,
          T.Username     AS author,
          T.Tweet        AS text_content,
          T.Retweets,
          T.Favorites,
          T.Media_URL    AS media_url,
          T.Explanation,
          T.categories,
          T.Region,
          (
            IF(FS.item_id IS NOT NULL, 150, 0)
            + IF(
                (SELECT COUNT(*) FROM UserPreferences UP
                 WHERE FIND_IN_SET(UP.preference, T.categories) > 0
                ) > 0,
                50, 0
              )
            + COALESCE(
                (SELECT SUM(UCI.user_category_interactions)
                 FROM UserTweetCategoryInteraction UCI
                 WHERE FIND_IN_SET(UCI.category, T.categories) > 0
                ), 0
              )
            + COALESCE(TRP.interaction_count, 0) * 3
            + IF(T.Region = ?, 75, 0)
          ) AS score
        FROM Tweets T
        LEFT JOIN TweetRecentPopularity TRP
          ON T.sourcename = TRP.item_type
         AND T.Tweet_Link = TRP.item_id
        LEFT JOIN FollowedShares FS
          ON T.Tweet_Link = FS.item_id
        ORDER BY score DESC, created_at DESC
        LIMIT ? OFFSET ?
        `;

        const finalFeedParams = [
          currentUsername,  // UserPreferences
          currentUsername,  // UserTweetCategoryInteraction
          currentUsername,  // FollowingList
          userRegion,       // Region-match boost
          limitNumber,      // LIMIT
          offset            // OFFSET
        ];


        console.log(`Executing /get-for-you-feed SQL Query (User: ${currentUsername}, Page: ${pageNumber}, Limit: ${limitNumber}, DBRegion: ${userRegion || 'None'})`);
        // console.log("SQL with params:", pool.format(feedQuery, finalFeedParams)); // For debugging

        pool.query(feedQuery, finalFeedParams, (feedErr, feedResults) => {
            if (feedErr) {
                console.error(`Personalized Feed Fetch Error for user ${currentUsername}:`, feedErr.message, feedErr.sql);
                return res.status(500).json({ status: 'Error', error: 'Database error while fetching personalized feed.' });
            }
            if (Array.isArray(feedResults)) {
                console.log(`/get-for-you-feed Found: ${feedResults.length} rows for User: ${currentUsername}`);
                return res.json({
                    status: feedResults.length > 0 ? 'Content found' : 'No content found for your personalized feed',
                    data: feedResults,
                });
            } else {
                 console.error("Unexpected result format from personalized feed query:", feedResults);
                 return res.status(500).json({ status: 'Error', error: 'Unexpected database response format.' });
            }
        }); // End main feed query execution
    } // End executeFeedQuery function

}); // End of '/get-for-you-feed' route definition

/**
 * @route POST /get-chronological-feed
 * @description Gets Tweets, BlueSky posts, and/or Articles sorted strictly by creation date,
 * with optional category, region, and item type filters, and pagination.
 * @access Public
 */
router.post('/get-chronological-feed', (req, res) => {
    const { categories, region, page = 1, limit = 15, itemTypeFilter = 'all' } = req.body; // Added itemTypeFilter, default to 'all'

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1) {
        return res.status(400).json({ status: 'Error', error: 'Invalid page or limit parameter.' });
    }
    const offset = (pageNumber - 1) * limitNumber;

    const querySegments = [];
    const allQueryParams = [];

    const hasCategories = categories && Array.isArray(categories) && categories.length > 0;
    const hasRegion = region && typeof region === 'string' && region.trim() !== '';
    const trimmedRegion = hasRegion ? region.trim() : null;

    const validCategories = (hasCategories)
        ? categories.map(cat => String(cat).trim()).filter(cat => cat.length > 0)
        : [];

    // --- Tweets and BlueSky Posts Segment ---
    if (itemTypeFilter === 'all' || itemTypeFilter === 'tweet' || itemTypeFilter === 'bluesky') {
        const socialWhereParts = [];
        const socialParams = [];

        if (validCategories.length > 0) {
            socialWhereParts.push(`(${validCategories.map(() => `FIND_IN_SET(?, T.categories) > 0`).join(' OR ')})`);
            socialParams.push(...validCategories);
        }

        if (trimmedRegion) {
            socialWhereParts.push('T.Region = ?');
            socialParams.push(trimmedRegion);
        }

        // Filter by specific item type if not 'all'
        // This assumes T.sourcename (or another designated column) holds values like 'tweet', 'bluesky'
        // that directly match the itemTypeFilter values sent from the frontend.
        // If T.sourcename is "Twitter", "BlueSky Platform", you'd need to map:
        // e.g., if (itemTypeFilter === 'tweet') socialWhereParts.push(`T.sourcename = 'Twitter'`);
        // For simplicity here, we assume direct match or T.sourcename is already the item_type.
        if (itemTypeFilter === 'tweet' || itemTypeFilter === 'bluesky') {
            socialWhereParts.push('T.sourcename = ?'); // Or T.your_type_column = ?
            socialParams.push(itemTypeFilter);
        } else if (itemTypeFilter === 'all') {
            // If 'all' types are requested, ensure we only get known social types from this table
            // if the Tweets table could contain other non-feed sourcenames.
            socialWhereParts.push(`T.sourcename IN ('tweet', 'bluesky')`); // No params needed for this part if hardcoded
        }


        const socialWhereClause = socialWhereParts.length > 0 ? `WHERE ${socialWhereParts.join(' AND ')}` : '';

        querySegments.push(`
      (
        SELECT
            T.sourcename AS item_type, -- IMPORTANT: Ensure this column value is 'tweet' or 'bluesky'
            T.Tweet_Link AS item_id,
            T.Username AS author,
            T.Tweet AS text_content,
            T.Created_At AS created_at,
            T.Media_URL AS media_url,
            T.categories AS categories,
            T.Region AS region,
            T.Retweets,
            T.Favorites,
            T.Explanation
        FROM Tweets T  -- Assuming this table contains both Tweets and BlueSky posts
        ${socialWhereClause}
      )
    `);
        allQueryParams.push(...socialParams);
    }

    // --- Articles Segment ---
    const articlesHaveFilterableRegion = true; // SET THIS BASED ON YOUR Articles TABLE SCHEMA (e.g., true if A.Region exists)
    const articleRegionColumnName = 'A.Region';   // SET THIS to actual region column name in Articles table

    if (itemTypeFilter === 'all' || itemTypeFilter === 'article') {
        const articleWhereParts = [];
        const articleParams = [];

        if (validCategories.length > 0) {
            articleWhereParts.push(`(${validCategories.map(() => `A.category LIKE ?`).join(' OR ')})`);
            articleParams.push(...validCategories.map(cat => `%${cat}%`));
        }

        if (trimmedRegion && articlesHaveFilterableRegion) {
            articleWhereParts.push(`${articleRegionColumnName} = ?`);
            articleParams.push(trimmedRegion);
        }

        const articleWhereClause = articleWhereParts.length > 0 ? `WHERE ${articleWhereParts.join(' AND ')}` : '';

        querySegments.push(`
      (
        SELECT
            'article' AS item_type,
            A.id AS item_id,
            A.authors AS author,
            A.headline AS text_content,
            A.date AS created_at,
            A.image_url AS media_url,
            A.category AS categories,
            ${articlesHaveFilterableRegion ? articleRegionColumnName : 'NULL'} AS region,
            NULL AS Retweets,
            NULL AS Favorites,
            A.Explanation AS Explanation
        FROM Articles A
        ${articleWhereClause}
      )
    `);
        allQueryParams.push(...articleParams);
    }

    // --- Combine Segments and Execute ---
    if (querySegments.length === 0) {
        // This can happen if itemTypeFilter is invalid or doesn't match any segment
        return res.json({ status: 'No content found for the given criteria (no query segments)', data: [] });
    }

    const unionClause = querySegments.join(' UNION ALL ');
    const finalQuery = `
    SELECT * FROM (
      ${unionClause}
    ) AS CombinedFeed
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?;
  `;
    allQueryParams.push(limitNumber, offset);

    console.log(`Executing /get-chronological-feed (Page: ${pageNumber}, Limit: ${limitNumber}, TypeFilter: ${itemTypeFilter}, Categories: ${validCategories.join(',') || 'None'}, Region: ${trimmedRegion || 'None'})`);
    // For debugging, it's invaluable:
    // console.log("Formatted SQL:", pool.format(finalQuery, allQueryParams));

    pool.query(finalQuery, allQueryParams, (err, results) => {
        if (err) {
            console.error("Combined Chronological Feed Fetch Error:", err.message, "\nQuery attempted:", pool.format(finalQuery, allQueryParams));
            return res.status(500).json({ status: 'Error', error: 'Database error fetching combined chronological feed.' });
        }
        if (Array.isArray(results)) {
            console.log(`/get-chronological-feed Combined Found: ${results.length}`);
            return res.json({
                status: results.length > 0 ? 'Content found' : 'No content found for the given criteria',
                data: results,
            });
        } else {
            console.error("Unexpected result format from DB (/get-chronological-feed Combined):", results);
            return res.status(500).json({ status: 'Error', error: 'Unexpected database response format.' });
        }
    });
});

router.post('/check-login', (req, res) => {
  const { username, auth_token } = req.body;
  const query = `
      SELECT username, deactivated, auth_token
      FROM Users_new
      WHERE username = ? AND auth_token = ?;
  `;
  pool.query(query, [username, auth_token], (err, results) => {
      if (err) {
          return res.status(500).json({ status: 'Error', message: 'Internal server error' });
      }

      if (results.length > 0) {
          const user = results[0];
          if (user.deactivated === 1) {
              return res.status(403).json({ status: 'Error', message: 'Account is deactivated' });
          }
          return res.json({ status: 'Success', message: 'Login successful' });
      } else {
          return res.status(401).json({ status: 'Error', message: 'Invalid username or password' });
      }
  });
});

router.get('/get-full-name', (req, res) => {
    const { username } = req.query; // Assuming username is sent as a query parameter

    const query = `SELECT full_name FROM Users_new WHERE username = ?;`;

    pool.query(query, [username], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ status: 'Error', message: 'User not found' });
        }

        return res.json({ status: 'Success', full_name: results[0].full_name });
    });
});

router.get('/get-profile-picture', (req, res) => {
    const { username } = req.query; // Assuming username is sent as a query parameter

    const query = `SELECT profile_picture FROM Users_new WHERE username = ?;`;

    pool.query(query, [username], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ status: 'Error', message: 'User not found' });
        }

        return res.json({ status: 'Success', profile_picture: results[0].profile_picture });
    });
});


router.post('/sign-up', (req, res) => {
    const { auth_token, nickname, email, full_name, profile_picture } = req.body;

    const checkQuery = `SELECT id FROM Users_new WHERE username = ? OR email = ?;`;
    const insertQuery = `
        INSERT INTO Users_new (username, email, auth_token, full_name, profile_picture)
        VALUES (?, ?, ?, ?, ?);
    `;

    pool.query(checkQuery, [nickname, email], (checkErr, checkResults) => {
        if (checkErr) {
            return res.status(500).json({ status: 'Error', error: checkErr.message });
        }

        if (checkResults.length > 0) {
            return res.status(409).json({ status: 'Error', message: 'Username or email is already registered' });
        }

        pool.query(insertQuery, [nickname, email, auth_token, full_name, profile_picture], (insertErr) => {
            if (insertErr) {
                return res.status(500).json({ status: 'Error', error: insertErr.message });
            }
            return res.json({ status: 'Success', message: 'User registered successfully' });
        });
    });
});


router.post('/add-preference', (req, res) => {
  const { username, preference } = req.body;
  const insertQuery = `INSERT INTO Preferences (username, preference) VALUES (?, ?);`;

  pool.query(insertQuery, [username, preference], (err) => {
      if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
              return res.status(409).json({ status: 'Error', message: 'Preference already exists for this username' });
          }
          return res.status(500).json({ status: 'Error', error: err.message });
      }
      return res.json({ status: 'Success', message: 'Preference added successfully' });
  });
});

router.post('/check-preferences', (req, res) => {
  const { username } = req.body;
  const checkQuery = `SELECT preference FROM Preferences WHERE username = ?;`;
  pool.query(checkQuery, [username], (err, results) => {
      if (err) {
          return res.status(500).json({ status: 'Error', error: err.message });
      }

      if (results.length > 0) {
          return res.json({ status: 'Success', message: 'Preferences found', data: results });
      } else {
          return res.status(404).json({ status: 'Error', message: 'No preferences found for this username' });
      }
  });
});

// Initialize user data by generating a new JWT using auth_token to retrieve username
router.post('/set-username', async (req, res) => {
  const { auth_token } = req.body;

  // Ensure the auth_token is provided
  if (!auth_token) {
    return res.status(400).json({ status: 'Error', message: 'Auth token is required' });
  }

  try {
    // Query the database to find the username associated with the provided auth_token
    const query = 'SELECT username FROM Users_new WHERE auth_token = ? LIMIT 1';

    // Execute the query using the promise-based pool
    const [results] = await poolPromise.query(query, [auth_token]);

    // If no user is found with the provided auth_token
    if (results.length === 0) {
      return res.status(404).json({ status: 'Error', message: 'Invalid auth token' });
    }

    // Extract the username from the query result
    const username = results[0].username;

    // Create a fresh JWT token with the retrieved username and default values for other fields
    const token = signUserData(username, null, null, null);

    // Respond with the newly created token
    return res.json({ status: 'Success', token, message: 'User data initialized in token' });
  } catch (error) {
    console.error('Error in /set-username:', error);
    return res.status(500).json({ status: 'Error', message: 'An error occurred while processing the request' });
  }
});


// Set tweet data for a specific user
router.post('/set-tweettodisp', (req, res) => {
  const { token, tweet } = req.body;

  if (!token || !tweet) {
    return res.status(400).json({ status: 'Error', message: 'Token and Tweet data are required' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  // Update the tweet data in the token payload
  const newToken = signUserData(
    userPayload.username,
    userPayload.currentArticleId,
    userPayload.currentTweetLink,
    tweet
  );
  return res.json({ status: 'Success', token: newToken, message: 'Tweet Data stored successfully' });
});

// Get tweet data for a specific user
router.post('/get-tweettodisp', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ status: 'Error', message: 'Token is required' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  if (!userPayload.tweettodisp) {
    return res.status(404).json({ status: 'Error', message: 'No tweet data found for this user' });
  }

  return res.json({ status: 'Success', data: userPayload.tweettodisp });
});

// Get username (just returns what's in the token)
router.post('/get-username', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ status: 'Error', message: 'Token is required' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  return res.json({ status: 'Success', username: userPayload.username });
});

router.post('/set-article-id', (req, res) => {
  const { token, id } = req.body;
  if (!token || !id) {
    return res.status(400).json({ status: 'Error', message: 'Token and article ID are required' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  const newToken = signUserData(
    userPayload.username,
    id,
    userPayload.currentTweetLink,
    userPayload.tweettodisp
  );
  return res.json({ status: 'Success', token: newToken, message: 'Article ID set successfully' });
});

router.post('/get-article-id', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ status: 'Error', message: 'Token is required' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  if (userPayload.currentArticleId) {
    return res.json({ status: 'Success', articleId: userPayload.currentArticleId });
  } else {
    return res.json({ status: 'Error', message: 'No article ID set for this user' });
  }
});

router.post('/set-tweet-link', (req, res) => {
  const { token, link } = req.body;
  if (!token || !link) {
    return res.status(400).json({ status: 'Error', message: 'Token and link are required' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  const newToken = signUserData(
    userPayload.username,
    userPayload.currentArticleId,
    link,
    userPayload.tweettodisp
  );
  return res.json({ status: 'Success', token: newToken, message: 'Tweet link set successfully' });
});

router.post('/get-tweet-link', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ status: 'Error', message: 'Token is required' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  if (userPayload.currentTweetLink) {
    return res.json({ status: 'Success', tweetLink: userPayload.currentTweetLink });
  } else {
    return res.json({ status: 'Error', message: 'No tweet link set for this user' });
  }
});

// Endpoint 1: Update Full Name
router.post('/update_full_name', (req, res) => {
  const { token, newFullName } = req.body;
  if (!token || !newFullName) {
    return res.status(400).json({ status: 'Error', message: 'Token and new full name are required.' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token.' });
  }

  const updateFullNameSQL = `
    UPDATE Users_new
    SET full_name = ?
    WHERE username = ?;
  `;

  pool.query(updateFullNameSQL, [newFullName, userPayload.username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ status: 'Error', message: 'User not found.' });
    }

    const newToken = signUserData(
      userPayload.username,
      userPayload.currentArticleId,
      userPayload.currentTweetLink,
      userPayload.currentTweet
    );

    return res.status(200).json({ status: 'Success', token: newToken, message: 'Full name updated successfully.' });
  });
});

// Endpoint 2: Update Profile Picture
router.post('/update_profile_picture', (req, res) => {
  const { token, newProfilePicture } = req.body;
  if (!token || !newProfilePicture) {
    return res.status(400).json({ status: 'Error', message: 'Token and new profile picture URL are required.' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token.' });
  }

  const updateProfilePictureSQL = `
    UPDATE Users_new
    SET profile_picture = ?
    WHERE username = ?;
  `;

  pool.query(updateProfilePictureSQL, [newProfilePicture, userPayload.username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ status: 'Error', message: 'User not found.' });
    }

    const newToken = signUserData(
      userPayload.username,
      userPayload.currentArticleId,
      userPayload.currentTweetLink,
      userPayload.currentTweet
    );

    return res.status(200).json({ status: 'Success', token: newToken, message: 'Profile picture updated successfully.' });
  });
});

// Endpoint 3: Update Username
router.post('/update_username', (req, res) => {
  const { token, newUsername } = req.body;
  if (!token || !newUsername) {
    return res.status(400).json({ status: 'Error', message: 'Token and new username are required.' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token.' });
  }

  const updateUsernameSQL = `
    UPDATE Users_new
    SET username = ?
    WHERE username = ?;
  `;

  pool.query(updateUsernameSQL, [newUsername, userPayload.username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ status: 'Error', message: 'User not found.' });
    }

    const newToken = signUserData(
      newUsername,
      userPayload.currentArticleId,
      userPayload.currentTweetLink,
      userPayload.currentTweet
    );

    return res.status(200).json({ status: 'Success', token: newToken, message: 'Username updated successfully.' });
  });
});


// PASTE THIS into your backend router file, replacing the existing '/get_trending_tweets' route

// *** Changed from GET to POST to accept pagination & region in body ***
router.post('/get_trending_tweets', (req, res) => {
  const { region, page = 1, limit = 15 } = req.body;

  // validate paging
  const pageNumber  = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1) {
    return res.status(400).json({ status: 'Error', error: 'Invalid page or limit parameter.' });
  }
  const offset = (pageNumber - 1) * limitNumber;

  // build optional region filters
  const whereParams              = [];
  let regionFilterSubqueryWhere  = '';
  let regionFilterMainWhere      = '';
  if (region && typeof region === 'string' && region.trim() !== '') {
    regionFilterSubqueryWhere = 'WHERE sourcename = \'tweet\' AND Region = ?';
    regionFilterMainWhere     = 'AND T.Region = ?';
    whereParams.push(region.trim());
    whereParams.push(region.trim());
  } else {
    // always only trending “tweets”
    regionFilterSubqueryWhere = 'WHERE sourcename = \'tweet\'';
  }

  const query = `
    SELECT
      T.Username,
      T.Tweet,
      T.Created_At,
      T.Retweets,
      T.Favorites,
      T.Tweet_Link,
      T.Media_URL,
      T.Explanation,
      T.categories,
      T.Region,
      COALESCE(RA.interaction_count,0) AS recent_interactions
    FROM Tweets T

    -- pre‐aggregate all recent interactions by (item_type,item_id)
    LEFT JOIN (
      SELECT
        UI.item_type,
        UI.item_id,
        COUNT(*) AS interaction_count
      FROM UserInteractions UI
      WHERE UI.interaction_timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY UI.item_type, UI.item_id
    ) AS RA
      ON RA.item_type = T.sourcename
     AND RA.item_id   = T.Tweet_Link

    WHERE
      -- restrict to “tweets” from roughly the last 2 days of your latest tweet
      DATE(T.Created_At) >= DATE_SUB(
        ( SELECT MAX(Created_At)
            FROM Tweets
            ${regionFilterSubqueryWhere}
        ),
        INTERVAL 1 DAY
      )
      ${regionFilterMainWhere}
      AND T.sourcename = 'tweet'

    ORDER BY
      -- simple “trend” score: favorites + 5×recent interactions
      (COALESCE(T.Favorites,0) + COALESCE(RA.interaction_count,0) * 5) DESC,
      T.Created_At DESC

    LIMIT ? OFFSET ?
  `;

  // append pagination params
  const finalParams = [ ...whereParams, limitNumber, offset ];

  console.log(`Executing /get_trending_tweets (page=${pageNumber}, limit=${limitNumber}, region=${region||'any'})`);
  pool.query(query, finalParams, (err, results) => {
    if (err) {
      console.error('Trending Tweets Error:', err.message);
      return res.status(500).json({ status: 'Error', message: 'DB error fetching trending tweets.' });
    }
    return res.json({
      status:  results.length ? 'Success' : 'No trending tweets found',
      data:    results
    });
  });
});


/**
 * @route POST /track-interaction
 * @description Logs a user interaction with a content item.
 * @access Authenticated users (implicitly via username)
 * @param {string} req.body.username - User performing the action
 * @param {string} req.body.itemId - ID/Link of the item
 * @param {('tweet'|'article')} req.body.itemType - Type of item
 * @param {string} req.body.interactionType - Type of interaction (e.g., 'view', 'save')
 * @param {string} [req.body.region] - Optional: User's region at time of interaction
 * @returns {object} JSON response confirming success or detailing the error.
 */
router.post('/track-interaction', (req, res) => {
  const { username, itemId, itemType, interactionType, region } = req.body;

  // --- Basic Input Validation ---
  if (!username || !itemId || !itemType || !interactionType) {
    return res.status(400).json({ status: 'Error', message: 'Missing required interaction data (username, itemId, itemType, interactionType).' });
  }

   // Add more validation for interactionType if needed

  // --- Database Query ---
  const query = `
    INSERT INTO UserInteractions
      (username, item_id, item_type, interaction_type, region)
    VALUES (?, ?, ?, ?, ?)
  `;
  // Use null for region if not provided or empty
  const params = [username, itemId, itemType, interactionType, region || null];

  pool.query(query, params, (err, results) => {
    if (err) {
      // Log detailed error on the server
      console.error(`Error logging interaction for user ${username}, item ${itemId}:`, err);
      // Send generic error to client
      return res.status(500).json({ status: 'Error', message: 'Failed to log interaction.' });
    }

    // Check if insert was successful (affectedRows should be 1)
    if (results && results.affectedRows > 0) {
      console.log(`Interaction logged: User ${username}, Type ${interactionType}, Item ${itemId}`); // Server log
      // Send minimal success response - client usually doesn't need details
      return res.status(201).json({ status: 'Success', message: 'Interaction logged.' });
    } else {
      // This case might indicate an issue but not necessarily an error (e.g., DB trigger prevented insert)
      console.warn(`Interaction log for user ${username}, item ${itemId} resulted in 0 affected rows.`);
      return res.status(500).json({ status: 'Error', message: 'Interaction could not be logged.' });
    }
  });
});



router.post('/reactivate-user', (req, res) => {
  const { username } = req.body;
  const query = `
      UPDATE Users_new
      SET deactivated = 0
      WHERE username = ?;
  `;
  pool.query(query, [username], (err, results) => {
      if (err) {
          return res.status(500).json({ status: 'Error', message: 'Internal server error' });
      }

      if (results.affectedRows > 0) {
          return res.json({ status: 'Success', message: `User ${username} has been reactivated` });
      } else {
          return res.status(404).json({ status: 'Error', message: 'User not found' });
      }
  });
});

router.post('/deactivate-user', (req, res) => {
  // Extract username from the request body
  const { username } = req.body;

  // Basic validation: Check if username is provided
  if (!username) {
    return res.status(400).json({ status: 'Error', message: 'Username is required' });
  }

  // SQL query to update the 'deactivated' status for the given username
  // Assuming '1' represents a deactivated state
  const query = `
      UPDATE Users_new
      SET deactivated = 1
      WHERE username = ?;
  `;



  // Execute the query using the connection pool
  pool.query(query, [username], (err, results) => {
    // Handle potential database errors
    if (err) {
      console.error(`Error deactivating user ${username}:`, err); // Log the error server-side
      return res.status(500).json({ status: 'Error', message: 'Internal server error during deactivation' });
    }

    // Check if any rows were affected (i.e., if the user was found and updated)
    if (results && results.affectedRows > 0) {
      // Successfully deactivated
      console.log(`User ${username} deactivated successfully.`);
      return res.json({ status: 'Success', message: `User ${username} has been deactivated` });
    } else {
      // User not found or no change made
      console.log(`Attempted to deactivate non-existent user: ${username}`);
      return res.status(404).json({ status: 'Error', message: 'User not found' });
    }
  });
});

router.get('/get-region', (req, res) => {
  // Extract username from the query parameters
  const { username } = req.query;

  // Basic validation: Check if username is provided
  if (!username) {
    return res.status(400).json({ status: 'Error', message: 'Username query parameter is required' });
  }

  // SQL query to select the 'Region' for the given username
  const query = `
      SELECT Region
      FROM Users_new
      WHERE username = ?;
  `;

  // Execute the query using the connection pool
  pool.query(query, [username], (err, results) => {
    // Handle potential database errors
    if (err) {
      console.error(`Error getting region for user ${username}:`, err); // Log the error server-side
      return res.status(500).json({ status: 'Error', message: 'Internal server error while fetching region' });
    }

    // Check if any rows were returned (i.e., if the user was found)
    if (results && results.length > 0) {
      // Successfully found the user and their region
      const userRegion = results[0].Region; // Extract region from the first result row
      console.log(`Region '${userRegion}' retrieved for user ${username}.`);
      return res.json({ status: 'Success', username: username, region: userRegion });
    } else {
      // User not found
      console.log(`Attempted to get region for non-existent user: ${username}`);
      return res.status(404).json({ status: 'Error', message: 'User not found' });
    }
  });
});


router.post('/set-region', (req, res) => {
  // Extract username and new region from the request body
  const { username, region } = req.body;

  // Basic validation: Check if username and region are provided
  if (!username || !region) {
    return res.status(400).json({ status: 'Error', message: 'Username and region are required in the request body' });
  }

  // Optional: Add more validation for the region format if needed (e.g., check length, allowed characters)
  // Example: if (typeof region !== 'string' || region.length > 10) { ... }

  // SQL query to update the 'Region' for the given username
  const query = `
      UPDATE Users_new
      SET Region = ?
      WHERE username = ?;
  `;

  // Execute the query using the connection pool, passing region first, then username
  pool.query(query, [region, username], (err, results) => {
    // Handle potential database errors
    if (err) {
      console.error(`Error setting region for user ${username}:`, err); // Log the error server-side
      return res.status(500).json({ status: 'Error', message: 'Internal server error during region update' });
    }

    // Check if any rows were affected (i.e., if the user was found and updated)
    if (results && results.affectedRows > 0) {
      // Successfully updated
      console.log(`Region updated to '${region}' for user ${username}.`);
      return res.json({ status: 'Success', message: `Region updated successfully for user ${username}` });
    } else {
      // User not found or no change needed (maybe region was already set to this value)
      console.log(`Attempted to set region for non-existent user or no change needed: ${username}`);
      return res.status(404).json({ status: 'Error', message: 'User not found or region not updated' });
    }
  });
});

router.post('/delete-user', (req, res) => {
  const { username } = req.body;
  const query = `
      DELETE FROM Users_new
      WHERE username = ?;
  `;
  pool.query(query, [username], (err, results) => {
      if (err) {
          return res.status(500).json({ status: 'Error', message: 'Internal server error' });
      }

      if (results.affectedRows > 0) {
          return res.json({ status: 'Success', message: `User ${username} has been deleted.` });
      } else {
          return res.status(404).json({ status: 'Error', message: `User ${username} not found.` });
      }
  });
});

router.post('/get-article-by-id', (req, res) => {
  const { id } = req.body;

  if (!id) {
      return res.status(400).json({ status: 'Error', error: 'Article ID is required' });
  }

  const query = `
      SELECT id, link, headline, category, short_description, authors, date, clusterID, image_url
      FROM Articles
      WHERE id = ?;
  `;
  pool.query(query, [id], (fetchError, results) => {
      if (fetchError) {
          return res.status(500).json({ status: 'Error', error: fetchError.message });
      }

      if (results.length > 0) {
          return res.json({ status: 'Article found', data: results[0] });
      } else {
          return res.json({ status: 'No article found with the given ID' });
      }
  });
});

router.post('/get-tweet-by-link', (req, res) => {
  const { link } = req.body;

  if (!link) {
      return res.status(400).json({ status: 'Error', error: 'Tweet link is required' });
  }

  const query = `
      SELECT Username, Tweet, Created_At, Retweets, Favorites, Tweet_Link, Media_URL, Explanation, categories
      FROM Tweets
      WHERE Tweet_Link = ?;
  `;
  pool.query(query, [link], (err, results) => {
      if (err) {
          return res.status(500).json({ status: 'Error', error: err.message });
      }

      if (results.length > 0) {
          return res.json({ status: 'Tweet found', data: results[0] });
      } else {
          return res.json({ status: 'No tweet found with the given link' });
      }
  });
});

router.post('/delete-preferences', (req, res) => {
  const { username } = req.body;

  if (!username) {
      return res.status(400).json({ status: 'Error', message: 'Username is required' });
  }

  const deleteQuery = `DELETE FROM Preferences WHERE username = ?;`;
  pool.query(deleteQuery, [username], (err, results) => {
      if (err) {
          return res.status(500).json({ status: 'Error', error: err.message });
      }

      if (results.affectedRows > 0) {
          return res.json({ status: 'Success', message: 'Preferences deleted successfully' });
      } else {
          return res.status(404).json({ status: 'Error', message: 'No preferences found for this username' });
      }
  });
});

router.post('/get-related', (req, res) => {
  const { id } = req.body;

  if (!id) {
      return res.status(400).json({ status: 'Error', message: 'Article ID is required' });
  }

  const clusterQuery = `
      SELECT clusterID
      FROM Articles
      WHERE id = ?;
  `;
  pool.query(clusterQuery, [id], (clusterError, clusterResults) => {
      if (clusterError) {
          return res.status(500).json({ status: 'Error', message: clusterError.message });
      }

      if (clusterResults.length === 0) {
          return res.status(404).json({ status: 'Error', message: 'No article found with the given ID' });
      }

      const clusterID = clusterResults[0].clusterID;

      if (clusterID === -1 || clusterID === 0) {
          return res.json({ status: 'Success', data: [] });
      }

      const relatedQuery = `
          SELECT id, link, headline, category, short_description, authors, date, clusterID
          FROM Articles
          WHERE clusterID = ? AND id != ?
          LIMIT 1000;
      `;
      pool.query(relatedQuery, [clusterID, id], (relatedError, relatedResults) => {
          if (relatedError) {
              return res.status(500).json({ status: 'Error', message: relatedError.message });
          }

          if (relatedResults.length > 0) {
              return res.json({ status: 'Success', data: relatedResults });
          } else {
              return res.status(404).json({ status: 'Error', message: 'No related articles found' });
          }
      });
  });
});

// 1) Follow a user
router.post('/follow_Users', (req, res) => {
  const { follower_username, followed_username } = req.body;

  if (!follower_username || !followed_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'Both follower_username and followed_username are required.'
    });
  }

  // Check if the followed user exists
  const checkUserQuery = 'SELECT username FROM Users_new WHERE username = ?';
  pool.query(checkUserQuery, [followed_username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ status: 'Error', message: 'The username you are trying to follow does not exist.' });
    }

    // Insert a new row in follows (accepted defaults to false unless you want auto-accept)
    const followQuery = `
      INSERT INTO follows (follower_username, followed_username)
      VALUES (?, ?)
    `;
    pool.query(followQuery, [follower_username, followed_username], err => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({
            status: 'Error',
            message: 'You are already following this user.'
          });
        }
        return res.status(500).json({ status: 'Error', error: err.message });
      }

      return res
        .status(200)
        .json({ status: 'Success', message: 'Successfully followed the user.' });
    });
  });
});

// 2) Unfollow a user
router.post('/remove_follow_Users', (req, res) => {
  const { follower_username, followed_username } = req.body;

  if (!follower_username || !followed_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'Both follower_username and followed_username are required.'
    });
  }

  // Check if the user to unfollow exists
  const checkUserQuery = 'SELECT username FROM Users_new WHERE username = ?';
  pool.query(checkUserQuery, [followed_username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ status: 'Error', message: 'The username you are trying to unfollow does not exist.' });
    }

    // Delete the row from follows
    const removeFollowQuery = `
      DELETE FROM follows
      WHERE follower_username = ? AND followed_username = ?
    `;
    pool.query(removeFollowQuery, [follower_username, followed_username], (err, results) => {
      if (err) {
        return res.status(500).json({ status: 'Error', error: err.message });
      }

      if (results.affectedRows === 0) {
        return res
          .status(400)
          .json({ status: 'Error', message: 'You are not following this user.' });
      }

      return res
        .status(200)
        .json({ status: 'Success', message: 'Successfully unfollowed the user.' });
    });
  });
});

// 3) Get the users a given user is following
// PASTE THIS into your backend router file, replacing the existing '/get_followed_users' route

router.post('/get_followed_users', (req, res) => {
  const { follower_username } = req.body;

  if (!follower_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'follower_username is required.'
    });
  }

  const getFollowedQuery = `
    SELECT followed_username
    FROM follows
    WHERE follower_username = ? AND accepted = TRUE;
  `; // Added semicolon for consistency

  pool.query(getFollowedQuery, [follower_username], (err, results) => {
    if (err) {
      console.error(`Error fetching followed users for ${follower_username}:`, err);
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    // Check if results is actually an array (it should be from mysql2)
    if (!Array.isArray(results)) {
        console.error(`Unexpected non-array result fetching followed users for ${follower_username}:`, results);
         return res.status(500).json({ status: 'Error', error: 'Unexpected database result format.' });
    }

    // If results array is empty (no friends found) OR contains data, map it.
    // This works correctly whether results.length is 0 or more.
    const followedUsernames = results.map(result => result.followed_username);

    // Always return 200 OK with the expected structure
    return res.status(200).json({
      status: 'Success',
      // followedUsernames will be [] if results was empty, or contain names otherwise
      followedUsernames: followedUsernames
    });
  });
});

// PASTE THIS NEW ROUTE into your index.js backend file

/**
 * @route POST /get_friends_reposts_feed
 * @description Gets a paginated feed of reposts (tweets & articles) from users the current user follows.
 * @access Private (Requires custom JWT token)
 */
router.post('/get_friends_reposts_feed', (req, res) => {
  // --- Detailed Log: Start & Input ---
  console.log('--- /get_friends_reposts_feed: Request Received ---');
  console.log('Request Body:', req.body);

  const { token, page = 1, limit = 10 } = req.body;

  // --- Token Validation ---
  if (!token) {
     console.error('/get_friends_reposts_feed: Validation Error - Token missing');
    return res.status(400).json({ status: 'Error', message: 'Token is required.' });
  }
  const userPayload = verifyUserData(token); // Use your existing JWT verification
  if (!userPayload || !userPayload.username) {
     console.error('/get_friends_reposts_feed: Validation Error - Invalid Token');
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token.' });
  }
  const currentUsername = userPayload.username;

  // --- Pagination Validation ---
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1 || limitNumber > 50) {
     console.error(`/get_friends_reposts_feed: Validation Error - Invalid page (${page}) or limit (${limit})`);
    return res.status(400).json({ status: 'Error', message: 'Invalid page or limit parameter (max 50).' });
  }
  const offset = (pageNumber - 1) * limitNumber;

   // --- Detailed Log: Parameters ---
   console.log(`/get_friends_reposts_feed: Calculated - Page: ${pageNumber}, Limit: ${limitNumber}, Offset: ${offset}`);


  // --- SQL Query (Corrected with TRIM on JOINs and full JSON_OBJECT) ---
  const query = `
    WITH FollowingList AS (
        SELECT followed_username
        FROM follows
        WHERE follower_username = ? AND accepted = TRUE
    )
    SELECT reposted_by_username, reposted_at, content_type, original_content
    FROM (
        -- Shared Tweets by followed users
        ( SELECT
              st.username AS reposted_by_username,
              st.shared_at AS reposted_at,
              T.sourcename AS content_type,
              JSON_OBJECT(
                  'type', T.sourcename,
                  'Tweet_Link', T.Tweet_Link,
                  'Username', T.Username,
                  'Tweet', T.Tweet,
                  'Created_At', T.Created_At,
                  'Retweets', T.Retweets,
                  'Favorites', T.Favorites,
                  'Media_URL', T.Media_URL,
                  'Explanation', T.Explanation,
                  'categories', T.categories,
                  'Region', T.Region
              ) AS original_content
          FROM shared_tweets st
          -- ***** ADDED TRIM() TO THIS JOIN *****
          JOIN Tweets T ON TRIM(st.tweet_link) = TRIM(T.Tweet_Link)
          JOIN FollowingList fl ON st.username = fl.followed_username
        )
        UNION ALL
        -- Shared Articles by followed users
        ( SELECT
              sa.username AS reposted_by_username,
              sa.shared_at AS reposted_at,
              'article' AS content_type,
              JSON_OBJECT(
                   'type', 'article',
                   'id', A.id,
                   'link', A.link,
                   'headline', A.headline,
                   'category', A.category,
                   'short_description', A.short_description,
                   'authors', A.authors,
                   'date', A.date,
                   'clusterID', A.clusterID,
                   'image_url', A.image_url,
                   'Explanation', A.Explanation
                   -- Note: No Retweets/Favorites fields for articles
              ) AS original_content
          FROM shared_articles sa
           -- ***** ADDED TRIM() TO THIS JOIN (assuming IDs are VARCHAR) *****
          JOIN Articles A ON TRIM(sa.article_id) = TRIM(A.id)
          -- If article_id and A.id are INTEGER, use this instead:
          -- JOIN Articles A ON sa.article_id = A.id
          JOIN FollowingList fl ON sa.username = fl.followed_username
        )
    ) AS CombinedFriendsReposts
    ORDER BY reposted_at DESC
    LIMIT ? OFFSET ?;
  `;

  // --- Parameters ---
  const params = [
    currentUsername, // For FollowingList subquery
    limitNumber,     // For LIMIT
    offset           // For OFFSET
  ];

  // --- Detailed Log: Query Execution ---
  console.log(`Executing /get_friends_reposts_feed for ${currentUsername} (Page: ${pageNumber}, Limit: ${limitNumber}) with TRIM fix`);

  // --- Execute Query ---
  pool.query(query, params, (err, results) => {
    // --- Detailed Log: Query Callback Entered ---
    console.log(`/get_friends_reposts_feed: Query callback executed.`);

    if (err) {
      // --- Detailed Log: Query Error ---
      console.error(`Error fetching friends' reposts for ${currentUsername}:`, err);
      return res.status(500).json({ status: 'Error', message: 'Database error fetching friends\' reposts.' });
    }

    // --- Detailed Log: Query Success & Raw Results ---
    console.log(`/get_friends_reposts_feed: Query successful for user '${currentUsername}'.`);
    if (!Array.isArray(results)) {
      console.error("/get_friends_reposts_feed: Unexpected result format from DB (not an array):", results);
      return res.status(500).json({ status: 'Error', message: 'Unexpected database response format.' });
    }
     console.log(`/get_friends_reposts_feed: Raw results count: ${results.length}`);
      if (results.length > 0 && results[0].original_content !== undefined) {
        console.log(`/get_friends_reposts_feed: Type of raw original_content[0]: ${typeof results[0].original_content}`);
    }


    // --- Process Results (Corrected: Check type before parsing) ---
    console.log(`/get_friends_reposts_feed: Processing ${results.length} raw results...`);
    const processedResults = results.map(row => {
        // Check if original_content exists and is a string before parsing
        if (typeof row.original_content === 'string') {
            try {
                const originalContent = JSON.parse(row.original_content);
                // Ensure essential fields exist after parsing (optional robustness check)
                if(!originalContent || (!originalContent.Tweet_Link) || (row.content_type === 'article' && !originalContent.id) ){
                   console.warn(`/get_friends_reposts_feed: Parsed original_content missing essential ID. Skipping row:`, row);
                   return null;
                }
                return {
                    reposted_by_username: row.reposted_by_username,
                    reposted_at: row.reposted_at,
                    content_type: row.content_type,
                    original_content: originalContent
                };
            } catch (parseError) {
                console.error(`/get_friends_reposts_feed: Failed to parse original_content JSON. Error:`, parseError.message, `Row content string:`, row.original_content);
                return null; // Mark for filtering
            }
        } else if (typeof row.original_content === 'object' && row.original_content !== null) {
             // If the driver already parsed it
             console.log(`/get_friends_reposts_feed: original_content already an object for a row, using directly.`);
             // Ensure essential fields exist (optional robustness check)
             if((!row.original_content.Tweet_Link) || (row.content_type === 'article' && !row.original_content.id)){
                 console.warn(`/get_friends_reposts_feed: Pre-parsed original_content missing essential ID. Skipping row:`, row);
                 return null;
             }
             return {
                 reposted_by_username: row.reposted_by_username,
                 reposted_at: row.reposted_at,
                 content_type: row.content_type,
                 original_content: row.original_content // Use the object directly
             };
        } else {
             // Handle unexpected types or null
             console.warn(`/get_friends_reposts_feed: Skipping row due to unexpected original_content type (${typeof row.original_content}) or null value. Row:`, row);
             return null;
        }
    }).filter(item => item !== null);


    // --- Detailed Log: Final Results & Response ---
    console.log(`/get_friends_reposts_feed: Processing complete. Found ${processedResults.length} valid items for user '${currentUsername}'.`);
    console.log(`/get_friends_reposts_feed: Sending success response for user '${currentUsername}'.`);
    return res.json({
      status: 'Success',
      data: processedResults,
    });
  });
});


/**
 * @route POST /set-user-bio
 * @description Allows an authenticated user to update their bio.
 * @access Private (Requires valid user token)
 */
router.post('/set-user-bio', (req, res) => {
  console.log('--- /set-user-bio: Request Received ---');
  const { token, bio } = req.body;

  // --- Input Validation ---
  if (!token) {
    console.error('/set-user-bio: Validation Error - Token missing');
    return res.status(400).json({ status: 'Error', message: 'Authentication token is required.' });
  }
  // Validate bio: Allow empty string ("") to clear bio, but check type and reasonable length
  if (typeof bio !== 'string' && bio !== null) { // Allow explicit null too? Let's allow string or null.
      console.error('/set-user-bio: Validation Error - Bio must be a string or null.');
      return res.status(400).json({ status: 'Error', message: 'Bio must be a string or null.' });
  }
  if (typeof bio === 'string' && bio.length > 500) { // Example length limit
       console.error('/set-user-bio: Validation Error - Bio exceeds 500 characters.');
       return res.status(400).json({ status: 'Error', message: 'Bio cannot exceed 500 characters.' });
  }

  // --- Authentication ---
  const userPayload = verifyUserData(token); // Use your existing JWT verification
  if (!userPayload || !userPayload.username) {
    console.error('/set-user-bio: Authentication Error - Invalid Token');
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token.' });
  }
  const username = userPayload.username;
  console.log(`/set-user-bio: Authenticated user: ${username}`);

  // --- Database Update ---
  const query = `
    UPDATE Users_new
    SET bio = ?
    WHERE username = ?;
  `;
  // Pass `bio` directly (handles string or null)
  const params = [bio, username];

  console.log(`/set-user-bio: Executing update query for user '${username}'.`);

  pool.query(query, params, (err, results) => {
    console.log(`/set-user-bio: Query callback executed.`);
    if (err) {
      console.error(`/set-user-bio: Database Error updating bio for user '${username}':`, err);
      return res.status(500).json({ status: 'Error', message: 'Database error updating bio.' });
    }

    // Check if any row was actually updated
    if (results.affectedRows === 0) {
        // This might happen if the username from the token doesn't exist (unlikely if token verified)
         console.warn(`/set-user-bio: No rows updated for user '${username}'. User might not exist.`);
         // Decide if this is an error or just info. Let's treat as success but log warning.
         // return res.status(404).json({ status: 'Error', message: 'User not found to update bio.' });
    }

    console.log(`/set-user-bio: Bio updated successfully for user '${username}'.`);
    return res.json({
      status: 'Success',
      message: 'Bio updated successfully.'
    });
  });
});

/**
 * @route GET /get-user-bio
 * @description Gets the bio for a specific user.
 * @access Public
 * @queryParam {string} username - The username to fetch the bio for.
 */
router.get('/get-user-bio', (req, res) => {
    console.log('--- /get-user-bio: Request Received ---');
    const { username } = req.query;

    // --- Input Validation ---
    if (!username || typeof username !== 'string') {
        console.error('/get-user-bio: Validation Error - Username query parameter is required.');
        return res.status(400).json({ status: 'Error', message: 'Username query parameter is required.' });
    }
     console.log(`/get-user-bio: Fetching bio for username: '${username}'`);

    // --- Database Select ---
    const query = `
        SELECT bio
        FROM Users_new
        WHERE username = ?;
    `;
    const params = [username];

    pool.query(query, params, (err, results) => {
         console.log(`/get-user-bio: Query callback executed for '${username}'.`);
         if (err) {
            console.error(`/get-user-bio: Database Error fetching bio for user '${username}':`, err);
            return res.status(500).json({ status: 'Error', message: 'Database error fetching bio.' });
         }

         // Check results
         if (!Array.isArray(results)) {
             console.error("/get-user-bio: Unexpected result format from DB:", results);
             return res.status(500).json({ status: 'Error', message: 'Unexpected database response.' });
         }

         if (results.length === 0) {
             // User not found
             console.log(`/get-user-bio: User not found: '${username}'.`);
             return res.status(404).json({ status: 'Error', message: 'User not found.' });
         }

         // User found, return bio (which might be null)
         const userBio = results[0].bio;
         console.log(`/get-user-bio: Found bio for '${username}':`, userBio);
         return res.json({
             status: 'Success',
             bio: userBio // Send the bio (could be string or null)
         });
    });
});


// Add this block alongside your other router.post definitions in index.js

/**
 * @route POST /get_reposts_by_user
 * @description Gets paginated reposts (shared tweets & articles) made by a specific user,
 * including the original content details. Ordered by repost time descending.
 * @access Public (or add auth middleware if needed)
 */
router.post('/get_reposts_by_user', (req, res) => {
  // --- Detailed Log: Start & Input ---
  console.log('--- /get_reposts_by_user: Request Received ---');
  console.log('Request Body:', req.body);

  const { username, page = 1, limit = 10 } = req.body;

  // --- Input Validation ---
  if (!username) {
    console.error('/get_reposts_by_user: Validation Error - Username missing');
    return res.status(400).json({ status: 'Error', message: 'Username is required.' });
  }
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1 || limitNumber > 50) {
    console.error(`/get_reposts_by_user: Validation Error - Invalid page (${page}) or limit (${limit})`);
    return res.status(400).json({ status: 'Error', message: 'Invalid page or limit parameter (max 50).' });
  }
  const offset = (pageNumber - 1) * limitNumber;

  // --- Detailed Log: Parameters ---
  console.log(`/get_reposts_by_user: Calculated - Page: ${pageNumber}, Limit: ${limitNumber}, Offset: ${offset}`);

  // --- SQL Query (Corrected with TRIM) ---
  const query = `
    SELECT reposted_at, content_type, original_content
    FROM (
        -- Shared Tweets
        ( SELECT
              st.shared_at           AS reposted_at,
              T.sourcename               AS content_type,
              JSON_OBJECT(
                  'type', T.sourcename, 'Tweet_Link', T.Tweet_Link, 'Username', T.Username,
                  'Tweet', T.Tweet, 'Created_At', T.Created_At, 'Retweets', T.Retweets,
                  'Favorites', T.Favorites, 'Media_URL', T.Media_URL, 'Explanation', T.Explanation,
                  'categories', T.categories, 'Region', T.Region
              ) AS original_content
          FROM shared_tweets st
          JOIN Tweets T ON TRIM(st.tweet_link) = TRIM(T.Tweet_Link)
          WHERE st.username = ?
        )
        UNION ALL
        -- Shared Articles
        ( SELECT
              sa.shared_at           AS reposted_at,
              'article'              AS content_type,
              JSON_OBJECT(
                   'type', 'article', 'id', A.id, 'link', A.link,
                   'headline', A.headline, 'category', A.category, 'short_description', A.short_description,
                   'authors', A.authors, 'date', A.date, 'clusterID', A.clusterID,
                   'image_url', A.image_url, 'Explanation', A.Explanation
              ) AS original_content
          FROM shared_articles sa
          JOIN Articles A ON sa.article_id = A.id
          WHERE sa.username = ?
        )
    ) AS CombinedReposts
    ORDER BY reposted_at DESC
    LIMIT ? OFFSET ?;
  `;

  // --- Parameters ---
  const params = [
    username,      // For shared_tweets WHERE clause
    username,      // For shared_articles WHERE clause
    limitNumber,   // For LIMIT
    offset         // For OFFSET
  ];

  // --- Detailed Log: Query Execution ---
  console.log(`/get_reposts_by_user: Executing query for user '${username}' with params:`, params);
  console.log(`/get_reposts_by_user: Using TRIM fix.`); // Reminder that the fix is included

  // --- Execute Query ---
  pool.query(query, params, (err, results) => {
    // --- Detailed Log: Query Callback Entered ---
    console.log(`/get_reposts_by_user: Query callback executed.`);

    if (err) {
      // --- Detailed Log: Query Error ---
      console.error(`/get_reposts_by_user: Database Error for user '${username}':`, err); // Log full error object
      return res.status(500).json({ status: 'Error', message: 'Database error while fetching reposts.' });
    }

    // --- Detailed Log: Query Success & Raw Results ---
    console.log(`/get_reposts_by_user: Query successful for user '${username}'.`);
    if (!Array.isArray(results)) {
      console.error("/get_reposts_by_user: Unexpected result format from DB (not an array):", results);
      return res.status(500).json({ status: 'Error', message: 'Unexpected database response format.' });
    }
    console.log(`/get_reposts_by_user: Raw results count: ${results.length}`);
    // Log raw results only if needed for deep debugging - can be very verbose
    // console.log(`/get_reposts_by_user: Raw results:`, JSON.stringify(results, null, 2));
    // Log the type of original_content in the first result if it exists
    if (results.length > 0 && results[0].original_content !== undefined) {
        console.log(`/get_reposts_by_user: Type of raw original_content[0]: ${typeof results[0].original_content}`);
    }


    // --- Process Results (Parse JSON_OBJECT string) ---
    console.log(`/get_reposts_by_user: Processing ${results.length} raw results...`);
    const processedResults = results.map(row => {
        // Check if original_content exists and is a string before parsing
        if (typeof row.original_content === 'string') {
            try {
                const originalContent = JSON.parse(row.original_content);
                return {
                    reposted_at: row.reposted_at, // Explicitly include needed fields
                    content_type: row.content_type,
                    original_content: originalContent
                };
            } catch (parseError) {
                // --- Detailed Log: JSON Parse Error ---
                console.error(`/get_reposts_by_user: Failed to parse original_content JSON for row. Error:`, parseError.message, `Row content:`, row.original_content);
                return null; // Mark for filtering
            }
        } else if (typeof row.original_content === 'object' && row.original_content !== null) {
             // If the driver already parsed it (mysql2 might do this)
             console.log(`/get_reposts_by_user: original_content already an object for a row, using directly.`);
             return {
                 reposted_at: row.reposted_at,
                 content_type: row.content_type,
                 original_content: row.original_content // Use the object directly
             };
        } else {
             // Handle unexpected types or null
             console.warn(`/get_reposts_by_user: Skipping row due to unexpected original_content type (${typeof row.original_content}) or null value. Row:`, row);
             return null;
        }
    }).filter(item => item !== null); // Filter out items where processing failed or content was invalid

    // --- Detailed Log: Final Results & Response ---
    console.log(`/get_reposts_by_user: Processing complete. Found ${processedResults.length} valid items for user '${username}'.`);
    // Log final results only if needed for deep debugging
    // console.log(`/get_reposts_by_user: Final processed results:`, JSON.stringify(processedResults, null, 2));

    console.log(`/get_reposts_by_user: Sending success response for user '${username}'.`);
    return res.json({
      status: 'Success',
      data: processedResults,
    });
  });
});

// 4) Get the users who follow a given user
router.post('/get_followers', (req, res) => {
  const { followed_username } = req.body;

  if (!followed_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'followed_username is required.'
    });
  }

  const getFollowersQuery = `
    SELECT follower_username
    FROM follows
    WHERE followed_username = ? AND accepted = TRUE
  `;
  pool.query(getFollowersQuery, [followed_username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ status: 'Error', message: 'No users are following you.' });
    }

    const followerUsernames = results.map(result => result.follower_username);
    return res.status(200).json({
      status: 'Success',
      followerUsernames
    });
  });
});

// 5) Get outgoing pending follow requests for a user
router.post('/get_outgoing_pending_requests', (req, res) => {
  const { follower_username } = req.body;

  if (!follower_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'follower_username is required.'
    });
  }

  const query = `
    SELECT followed_username
    FROM follows
    WHERE follower_username = ? AND accepted = FALSE
  `;
  pool.query(query, [follower_username], (err, results) => {
    if (err) {
      console.error('Error fetching outgoing pending requests:', err);
      return res.status(500).json({
        status: 'Error',
        error: err.message
      });
    }

    // Even if length is 0, respond with an empty array
    const pendingFollowRequests = results.map(row => row.followed_username);
    return res.status(200).json({
      status: 'Success',
      pendingFollowRequests
    });
  });
});

// 6) Cancel (remove) an outgoing pending follow request
router.post('/cancel_follow_request', (req, res) => {
  const { follower_username, followed_username } = req.body;

  if (!follower_username || !followed_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'Both follower_username and followed_username are required.'
    });
  }

  const query = `
    DELETE FROM follows
    WHERE follower_username = ?
      AND followed_username = ?
      AND accepted = FALSE
  `;
  pool.query(query, [follower_username, followed_username], (err, results) => {
    if (err) {
      console.error('Error cancelling follow request:', err);
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        status: 'Error',
        message: 'No pending follow request found to cancel.'
      });
    }

    return res.status(200).json({
      status: 'Success',
      message: `Your follow request to ${followed_username} has been cancelled.`
    });
  });
});

// 7) Get incoming pending follow requests for a user
router.post('/get_pending_users', (req, res) => {
  const { followed_username } = req.body;

  if (!followed_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'followed_username is required.'
    });
  }

  const getPendingQuery = `
    SELECT follower_username
    FROM follows
    WHERE followed_username = ? AND accepted = FALSE
  `;

  pool.query(getPendingQuery, [followed_username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    // Even if 0 results, respond with empty array to avoid 404 confusion
    const pendingUsernames = results.map(result => result.follower_username);
    return res.status(200).json({
      status: 'Success',
      pendingUsernames
    });
  });
});

// 8) Accept a follow request
router.post('/accept_follow_request', (req, res) => {
  const { follower_username, followed_username } = req.body;

  if (!follower_username || !followed_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'Both follower_username and followed_username are required.'
    });
  }

  const acceptFollowRequestQuery = `
    UPDATE follows
    SET accepted = TRUE
    WHERE follower_username = ? AND followed_username = ?
  `;
  pool.query(acceptFollowRequestQuery, [follower_username, followed_username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        status: 'Error',
        message: 'Follow request not found or already accepted.'
      });
    }

    return res.status(200).json({
      status: 'Success',
      message: 'Follow request accepted.'
    });
  });
});

// 9) Reject a follow request
router.post('/reject_follow_request', (req, res) => {
  const { follower_username, followed_username } = req.body;

  if (!follower_username || !followed_username) {
    return res.status(400).json({
      status: 'Error',
      message: 'Both follower_username and followed_username are required.'
    });
  }

  const rejectFollowRequestQuery = `
    DELETE FROM follows
    WHERE follower_username = ?
      AND followed_username = ?
      AND accepted = FALSE
  `;

  pool.query(rejectFollowRequestQuery, [follower_username, followed_username], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        status: 'Error',
        message: 'No pending follow request found to reject.'
      });
    }

    return res.status(200).json({
      status: 'Success',
      message: `Follow request from ${follower_username} has been rejected.`
    });
  });
});


router.post('/share_articles', (req, res) => {
  const { token, article_id } = req.body;

  if (!token || !article_id) {
    return res.status(400).json({ status: 'Error', message: 'Token and article_id are required.' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  const username = userPayload.username;

  const shareArticleQuery = `
    INSERT INTO shared_articles (username, article_id, shared_at)
    VALUES (?, ?, CURRENT_TIMESTAMP);
  `;
  pool.query(shareArticleQuery, [username, article_id], (err) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }
    return res.status(200).json({ status: 'Success', message: 'Article successfully shared.' });
  });
});

router.post('/share_tweets', (req, res) => {
  const { token, tweet_link } = req.body;

  if (!token || !tweet_link) {
    return res.status(400).json({ status: 'Error', message: 'Token and tweet_link are required.' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  const username = userPayload.username;

  const shareTweetQuery = `
    INSERT INTO shared_tweets (username, tweet_link, shared_at)
    VALUES (?, ?, CURRENT_TIMESTAMP);
  `;
  pool.query(shareTweetQuery, [username, tweet_link], (err) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }
    return res.status(200).json({ status: 'Success', message: 'Tweet successfully shared.' });
  });
});

router.post('/get_shared_content', (req, res) => {
  const { follower_username } = req.body;

  if (!follower_username) {
    return res.status(400).json({ status: 'Error', message: 'follower_username is required.' });
  }

  // First, get the union of:
  //   - Users that follower_username is following (accepted = true)
  //   - Users that follow follower_username (accepted = true)
  const getFriendsQuery = `
    SELECT username FROM (
      SELECT followed_username AS username
      FROM follows
      WHERE follower_username = ? AND accepted = TRUE
      UNION
      SELECT follower_username AS username
      FROM follows
      WHERE followed_username = ? AND accepted = TRUE
    ) AS friends
  `;

  pool.query(getFriendsQuery, [follower_username, follower_username], (err, friendsResults) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    // Create an array of friend usernames and include the user themself.
    let friendUsernames = [];
    if (friendsResults.length > 0) {
      friendUsernames = friendsResults.map(result => result.username);
    }
    friendUsernames.push(follower_username);

    // If still empty (shouldn't happen because we always push follower_username), then return a message
    if (friendUsernames.length === 0) {
      return res.status(404).json({ status: 'Error', message: 'No shared content found.' });
    }

    const getSharedContentQuery = `
      SELECT username, article_id AS content_id, 'article' AS content_type, shared_at
      FROM shared_articles
      WHERE username IN (?)
      UNION
      SELECT username, tweet_link AS content_id, T.sourcename AS content_type, shared_at
      FROM shared_tweets
      WHERE username IN (?)
      ORDER BY shared_at DESC;
    `;

    pool.query(getSharedContentQuery, [friendUsernames, friendUsernames], (fetchError, sharedContentResults) => {
      if (fetchError) {
        return res.status(500).json({ status: 'Error', error: fetchError.message });
      }

      return res.status(200).json({
        status: 'Success',
        shared_content: sharedContentResults
      });
    });
  });
});


router.post('/get-similar_users_searched', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ status: 'Error', message: 'Username is required.' });
  }

  const getSimilarUsersQuery = `
      SELECT username
      FROM Users_new
      WHERE username LIKE ?;
  `;
  const searchPattern = `%${username}%`;

  pool.query(getSimilarUsersQuery, [searchPattern], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ status: 'Error', message: 'No similar users found.' });
    }

    return res.status(200).json({
      status: 'Success',
      similar_users: results.map(result => result.username)
    });
  });
});

/**
 * @route   POST /is-tweet-saved
 * @desc    Check if a tweet has already been saved by the user
 * @access  Private (requires token)
 */
router.post('/is-tweet-saved', (req, res) => {
    const { token, tweet_link } = req.body;

    // 1. Validate input
    if (!token || !tweet_link) {
        return res.status(400).json({ status: 'Error', message: 'Token and tweet_link are required.' });
    }

    // 2. Verify token and get username
    const userPayload = verifyUserData(token);
    if (!userPayload) {
        return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
    }
    const username = userPayload.username;

    // 3. Formulate the database query to check for existence
    // We use COUNT(*) as it's more efficient than selecting all columns.
    // Make sure your table is named `Saved_Tweets` or change it here.
    const checkQuery = `
    SELECT COUNT(*) AS savedCount FROM Saved_Tweets WHERE username = ? AND tweet_link = ?;
  `;

    // 4. Execute the query
    pool.query(checkQuery, [username, tweet_link], (err, results) => {
        if (err) {
            console.error('Database error checking saved tweet:', err);
            return res.status(500).json({ status: 'Error', message: 'Database query failed.' });
        }

        // 5. Process the result and send response
        // results will be an array like [{ savedCount: 1 }] or [{ savedCount: 0 }]
        const count = results[0].savedCount;
        const tweetIsSaved = count > 0; // This converts the count (0 or 1) to a boolean (false or true)

        // This response format matches exactly what the frontend expects
        return res.status(200).json({
            status: 'Success',
            isSaved: tweetIsSaved
        });
    });
});

router.post('/save-articles', (req, res) => {
  const { token, article_id } = req.body;

  if (!token || !article_id) {
    return res.status(400).json({ status: 'Error', message: 'Token and article_id are required.' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  const username = userPayload.username;

  const saveArticleQuery = `
    INSERT INTO Saved_Articles (username, article_id, saved_time)
    VALUES (?, ?, CURRENT_TIMESTAMP);
  `;
  pool.query(saveArticleQuery, [username, article_id], (err) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }
    return res.status(200).json({ status: 'Success', message: 'Article successfully saved.' });
  });
});

router.post('/save-tweets', (req, res) => {
  const { token, tweet_link } = req.body;

  if (!token || !tweet_link) {
    return res.status(400).json({ status: 'Error', message: 'Token and tweet_link are required.' });
  }

  const userPayload = verifyUserData(token);
  if (!userPayload) {
    return res.status(401).json({ status: 'Error', message: 'Invalid or expired token' });
  }

  const username = userPayload.username;

  const saveTweetQuery = `
    INSERT INTO Saved_Tweets (username, tweet_link, saved_time)
    VALUES (?, ?, CURRENT_TIMESTAMP);
  `;
  pool.query(saveTweetQuery, [username, tweet_link], (err) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }
    return res.status(200).json({ status: 'Success', message: 'Tweet successfully saved.' });
  });
});

router.post('/unsave-tweet', (req, res) => {
    const { token, tweet_link } = req.body;

    // 1. Validate input
    if (!token || !tweet_link) {
        return res.status(400).json({
            status: 'Error',
            message: 'Token and tweet_link are required.'
        });
    }

    // 2. Authenticate the user
    const userPayload = verifyUserData(token);
    if (!userPayload) {
        return res.status(401).json({
            status: 'Error',
            message: 'Invalid or expired token.'
        });
    }

    const username = userPayload.username;

    // 3. Construct and execute the DELETE query
    const unsaveTweetQuery = `
    DELETE FROM Saved_Tweets
    WHERE username = ? AND tweet_link = ?;
  `;

    pool.query(unsaveTweetQuery, [username, tweet_link], (err, result) => {
        if (err) {
            console.error("Database error during unsave:", err);
            return res.status(500).json({
                status: 'Error',
                message: 'An internal server error occurred.',
                error: err.message
            });
        }

        // 4. Check if a row was actually deleted
        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'Error',
                message: 'Tweet not found in your saved list or already unsaved.'
            });
        }

        // 5. Respond with success
        return res.status(200).json({
            status: 'Success',
            message: 'Tweet successfully unsaved.'
        });
    });
});


router.post('/show-saved', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ status: 'Error', message: 'Username is required.' });
  }

  const showSavedQuery = `
    SELECT *
    FROM (
      -- saved articles
      SELECT
        'article'          AS type,
        sa.article_id      AS id,
        sa.saved_time      AS saved_time
      FROM Saved_Articles sa
      WHERE sa.username = ?

      UNION ALL

      -- saved tweets (or Bluesky items)
      SELECT
        t.sourcename       AS type,
        st.tweet_link      AS id,
        st.saved_time      AS saved_time
      FROM Saved_Tweets st
      JOIN Tweets t
        ON st.tweet_link = t.Tweet_Link
      WHERE st.username = ?
    ) AS combined
    ORDER BY saved_time DESC;
  `;

  pool.query(showSavedQuery, [username, username], (err, results) => {
    if (err) {
      console.error('Error fetching saved items:', err);
      return res.status(500).json({ status: 'Error', error: err.message });
    }
    return res.status(200).json({ status: 'Success', data: results });
  });
});


// PASTE THIS into your backend router file, replacing the existing '/search_content' route

router.post('/search_content', (req, res) => {
  const { searchQuery, page = 1, limit = 15 } = req.body;
  if (!searchQuery) {
    return res.status(400).json({ status: 'Error', message: 'Search query is required.' });
  }

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  if (isNaN(pageNumber) || pageNumber < 1 || isNaN(limitNumber) || limitNumber < 1) {
    return res.status(400).json({ status: 'Error', message: 'Invalid page or limit parameter.' });
  }
  const offset = (pageNumber - 1) * limitNumber;
  const q = `%${searchQuery}%`;

  // We UNION both tables, aliasing the same set of columns for the frontend
  const sql = `
    SELECT
      'article' AS item_type,
      A.id             AS item_id,
      A.date           AS created_at,
      A.authors        AS author,
      A.headline       AS text_content,
      A.image_url      AS media_url,
      A.category       AS categories,
      NULL             AS region,
      NULL             AS Retweets,
      NULL             AS Favorites,
      A.Explanation    AS Explanation
    FROM Articles A
    WHERE
      A.headline        LIKE ?
      OR A.short_description LIKE ?
      OR A.authors       LIKE ?
      OR A.category      LIKE ?

    UNION ALL

    SELECT
      T.sourcename       AS item_type,
      T.Tweet_Link   AS item_id,
      T.Created_At   AS created_at,
      T.Username     AS author,
      T.Tweet        AS text_content,
      T.Media_URL    AS media_url,
      T.categories   AS categories,
      T.Region       AS region,
      T.Retweets     AS Retweets,
      T.Favorites    AS Favorites,
      T.Explanation  AS Explanation
    FROM Tweets T
    WHERE
      T.Tweet      LIKE ?
      OR T.Username LIKE ?
      OR T.categories LIKE ?

    ORDER BY created_at DESC
    LIMIT ? OFFSET ?;
  `;

  const params = [
    q, q, q, q,        // 4 for Articles
    q, q, q,           // 3 for Tweets
    limitNumber,
    offset
  ];

  console.log('Search SQL:', sql);
  console.log('Params:', params);

  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error('Search Error:', err);
      return res.status(500).json({ status: 'Error', message: err.message });
    }
    if (!Array.isArray(results)) {
      console.error('Unexpected result format from DB during search:', results);
      return res.status(500).json({ status: 'Error', message: 'Unexpected database response.' });
    }

    return res.json({
      status: results.length > 0 ? 'Success' : 'No results found',
      data: results,
    });
  });
});


router.post('/comment_article', (req, res) => {
  const { article_id, username, content, parent_comment_id } = req.body;
  if (!article_id || !username || !content) {
    return res.status(400).json({ status: 'Error', message: 'article_id, username, and content are required.' });
  }

  const commentArticleQuery = `
      INSERT INTO comments (article_id, username, content, parent_comment_id, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
  `;
  pool.query(
    commentArticleQuery,
    [article_id, username, content, parent_comment_id || null],
    (err, results) => {
      if (err) {
        return res.status(500).json({ status: 'Error', error: err.message });
      }

      return res.status(201).json({
        status: 'Success',
        message: 'Comment successfully added.',
        data: {
          comment_id: results.insertId,
          article_id,
          username,
          content,
          parent_comment_id,
        },
      });
    }
  );
});

router.post('/get_comments_article', (req, res) => {
  const { article_id } = req.body;
  if (!article_id) {
    return res.status(400).json({ status: 'Error', message: 'article_id is required.' });
  }

  const getCommentsArticleQuery = `
      SELECT c.comment_id, c.article_id, c.username, c.content, c.parent_comment_id, c.created_at
      FROM comments c
      WHERE c.article_id = ?
      ORDER BY c.created_at ASC;
  `;
  pool.query(getCommentsArticleQuery, [article_id], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }

    return res.status(200).json({ status: 'Success', data: results });
  });
});

router.post('/comment_tweet', (req, res) => {
  const { tweet_link, username, content, parent_comment_id } = req.body;
  if (!tweet_link || !username || !content) {
    return res.status(400).json({ status: 'Error', message: 'tweet_link, username, and content are required.' });
  }

  const commentTweetQuery = `
      INSERT INTO comments_tweets (tweet_link, username, content, parent_comment_id, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
  `;
  pool.query(
    commentTweetQuery,
    [tweet_link, username, content, parent_comment_id || null],
    (err, results) => {
      if (err) {
        return res.status(500).json({ status: 'Error', error: err.message });
      }

      return res.status(201).json({
        status: 'Success',
        message: 'Comment successfully added.',
        data: {
          comment_id: results.insertId,
          tweet_link,
          username,
          content,
          parent_comment_id,
        },
      });
    }
  );
});

router.post('/get_comments_tweet', (req, res) => {
  const { tweet_link } = req.body;
  if (!tweet_link) {
    return res.status(400).json({ status: 'Error', message: 'tweet_link is required.' });
  }

  const getCommentsTweetQuery = `
      SELECT c.comment_id, c.tweet_link, c.username, c.content, c.parent_comment_id, c.created_at
      FROM comments_tweets c
      WHERE c.tweet_link = ?
      ORDER BY c.created_at ASC;
  `;
  pool.query(getCommentsTweetQuery, [tweet_link], (err, results) => {
    if (err) {
      return res.status(500).json({ status: 'Error', error: err.message });
    }
    return res.status(200).json({ status: 'Success', data: results });
  });
});

// Attach the router
app.use('/.netlify/functions/index', router);


// Export for serverless
module.exports = app;
module.exports.handler = serverless(app);
