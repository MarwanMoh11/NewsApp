const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

let currentArticleId = null;
let currentUsername = null;
let currentTweetLink = null;
let tweettodisp = null;
const app = express();
app.use(cors());
app.use(bodyParser.json());


const pool = mysql.createPool({
    host: "databaseprojectm3.cfuockog8tb5.eu-north-1.rds.amazonaws.com",
    user: "admin",
    password: "adminadmi",
    database: "chronically",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
app.post('/get-articles', (req, res) => {
    const { category } = req.body;
    const query = `
        SELECT id ,link, headline, category, short_description, authors, date, clusterID
        FROM Articles
        WHERE category LIKE ?
        LIMIT 1000;
    `;
    pool.query(query, [`%${category}%`], (fetchError, results) => {
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
app.post('/get-allarticles', (req, res) => {
    const { category } = req.body;
    const query = `
        SELECT  id, link, headline, category, short_description, authors, date, clusterID
        FROM Articles
        WHERE category LIKE ?
    `;
    pool.query(query, [`%${category}%`], (fetchError, results) => {
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
app.post('/get-tweets', (req, res) => {
    const { category } = req.body;

    const query = `
        SELECT Username, Tweet, Created_At, Retweets, Favorites, Tweet_Link, Media_URL, Explanation, categories
        FROM Tweets
        WHERE categories LIKE ?
        LIMIT 100;
    `;

    const values = [`%${category || ''}%`];

    pool.query(query, values, (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        if (results.length > 0) {
            return res.json({ status: 'Tweets found', data: results });
        } else {
            return res.json({ status: 'No tweets found' });
        }
    });
});
app.post('/get-alltweets', (req, res) => {
    const { category } = req.body;

    const query = `
        SELECT Username, Tweet, Created_At, Retweets, Favorites, Tweet_Link, Media_URL, Explanation, categories
        FROM Tweets
        WHERE categories LIKE ?
    `;

    const values = [`%${category || ''}%`];

    pool.query(query, values, (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        if (results.length > 0) {
            return res.json({ status: 'Tweets found', data: results });
        } else {
            return res.json({ status: 'No tweets found' });
        }
    });
});
app.post('/check-login', (req, res) => {
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
app.post('/sign-up', (req, res) => {
console.log('Request Body:', req.body);
    const { auth_token, nickname, email } = req.body;

    console.log('Received data:', { auth_token, nickname, email });

    const checkQuery = `SELECT id FROM Users_new WHERE username = ? OR email = ?;`;
    const insertQuery = `INSERT INTO Users_new (username, email, auth_token) VALUES (?, ?, ?);`;

    pool.query(checkQuery, [nickname, email], (checkErr, checkResults) => {
        if (checkErr) {
            console.error('Database error during check:', checkErr);  // Log the error
            return res.status(500).json({ status: 'Error', error: checkErr.message });
        }

        if (checkResults.length > 0) {
            console.log('Username or email already registered');
            return res.status(409).json({ status: 'Error', message: 'Username or email is already registered' });
        }

        pool.query(insertQuery, [nickname, email, auth_token], (insertErr) => {
            if (insertErr) {
                console.error('Database error during insert:', insertErr);  // Log the error
                return res.status(500).json({ status: 'Error', error: insertErr.message });
            }
            return res.json({ status: 'Success', message: 'User registered successfully' });
        });
    });
});
app.post('/add-preference', (req, res) => {
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
app.post('/check-preferences', (req, res) => {
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
app.post('/set-username', (req, res) => {
    const { username } = req.body;

    // Check if username is provided
    if (!username) {
        return res.status(400).json({ status: 'Error', message: 'Username is required' });
    }

    // Set the username to the global variable
    currentUsername = username;

    // Log the updated username for debugging
    console.log('Current Username Set:', currentUsername);

    return res.json({ status: 'Success', message: 'Username set successfully' });
});

app.post('/set-tweettodisp', (req, res) => {
    const { tweet } = req.body;

    // Check if tweet is provided
    if (!tweet) {
        return res.status(400).json({ status: 'Error', message: 'Tweet data is required' });
    }

    // Set the tweet to the global variable
    tweettodisp = tweet;

    // Log the updated tweet for debugging
    console.log('Tweet Data:', tweettodisp);

    return res.json({ status: 'Success', message: 'Tweet Data Stored successfully' });
});

app.get('/get-tweettodisp', (req, res) => {
    if (!tweettodisp) {
        return res.status(404).json({ status: 'Error', message: 'No tweet data found' });
    }

    return res.json({ status: 'Success', data: tweettodisp });
});

app.get('/get-username', (req, res) => {
    if (currentUsername) {
        return res.json({ username: currentUsername });
    } else {
        return res.json({ status: 'No username set' });
    }
});
app.post('/set-article-id', (req, res) => {
    const { id } = req.body;
    currentArticleId = id;
    return res.json({ status: 'Success', message: 'Article ID set successfully' });
});
app.get('/get-article-id', (req, res) => {
    if (currentArticleId) {
        return res.json({ articleId: currentArticleId });
    } else {
        return res.json({ status: 'Error', message: 'No article ID set' });
    }
});
app.post('/set-tweet-link', (req, res) => {
    const { link } = req.body;
    currentTweetLink = link;
    return res.json({ status: 'Success', message: 'Tweet link set successfully' });
});
app.get('/get-tweet-link', (req, res) => {
    if (currentTweetLink) {
        return res.json({ tweetLink: currentTweetLink });
    } else {
        return res.json({ status: 'Error', message: 'No tweet link set' });
    }
});
app.get('/get_trending_tweets', (req, res) => {
    const query = `
        WITH LatestDate AS (
            SELECT DATE(MAX(Created_At)) AS max_date
            FROM Tweets
        )
        SELECT Username, Tweet, Created_At, Retweets, Favorites, Tweet_Link, Media_URL, Explanation, categories
        FROM Tweets
        WHERE DATE(Created_At) >= (SELECT max_date FROM LatestDate) - INTERVAL 1 DAY
        ORDER BY Favorites DESC
        LIMIT 100;
    `;

    pool.query(query, (error, results) => {
        if (error) {
            return res.status(500).json({ status: 'Error', message: error.message });
        }

        if (results.length > 0) {
            return res.json({ status: 'Success', data: results });
        } else {
            return res.json({ status: 'No tweets found' });
        }
    });
});
app.post('/deactivate-user', (req, res) => {
    const { username } = req.body;

    const query = `
        UPDATE Users_new
        SET deactivated = 1
        WHERE username = ?;
    `;

    pool.query(query, [username], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', message: 'Internal server error' });
        }

        if (results.affectedRows > 0) {
            return res.json({ status: 'Success', message: `User ${username} has been deactivated` });
        } else {
            return res.status(404).json({ status: 'Error', message: 'User not found' });
        }
    });
});
app.post('/reactivate-user', (req, res) => {
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
app.post('/delete-user', (req, res) => {
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
app.post('/get-article-by-id', (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ status: 'Error', error: 'Article ID is required' });
    }

    const query = `
        SELECT id, link, headline, category, short_description, authors, date, clusterID
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
app.post('/get-tweet-by-link', (req, res) => {
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
app.post('/delete-preferences', (req, res) => {
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
app.post('/get-related', (req, res) => {
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

        // If clusterID is -1, return an empty response.
        if (clusterID === -1||clusterID==0) {
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
app.post('/follow_Users', (req, res) => {
    const { follower_username, followed_username } = req.body;

    if (!follower_username || !followed_username) {
        return res.status(400).json({ status: 'Error', message: 'Both follower_username and followed_username are required.' });
    }

    const checkUserQuery = 'SELECT username FROM Users_new WHERE username = ?';
    pool.query(checkUserQuery, [followed_username], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ status: 'Error', message: 'The username you are trying to follow does not exist.' });
        }

        const followQuery = `
            INSERT INTO follows (follower_username, followed_username)
            VALUES (?, ?)
        `;
        pool.query(followQuery, [follower_username, followed_username], (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ status: 'Error', message: 'You are already following this user.' });
                }
                return res.status(500).json({ status: 'Error', error: err.message });
            }

            return res.status(200).json({ status: 'Success', message: 'Successfully followed the user.' });
        });
    });
});
app.post('/remove_follow_Users', (req, res) => {
    const { follower_username, followed_username } = req.body;

    if (!follower_username || !followed_username) {
        return res.status(400).json({ status: 'Error', message: 'Both follower_username and followed_username are required.' });
    }

    const checkUserQuery = 'SELECT username FROM Users_new WHERE username = ?';
    pool.query(checkUserQuery, [followed_username], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ status: 'Error', message: 'The username you are trying to unfollow does not exist.' });
        }

        const removeFollowQuery = `
            DELETE FROM follows
            WHERE follower_username = ? AND followed_username = ?
        `;
        pool.query(removeFollowQuery, [follower_username, followed_username], (err, results) => {
            if (err) {
                return res.status(500).json({ status: 'Error', error: err.message });
            }

            if (results.affectedRows === 0) {
                return res.status(400).json({ status: 'Error', message: 'You are not following this user.' });
            }

            return res.status(200).json({ status: 'Success', message: 'Successfully unfollowed the user.' });
        });
    });
});
app.post('/get_followed_users', (req, res) => {
    const { follower_username } = req.body;

    if (!follower_username) {
        return res.status(400).json({ status: 'Error', message: 'follower_username is required.' });
    }

    const getFollowedQuery = `
        SELECT followed_username
        FROM follows
        WHERE follower_username = ?
    `;

    pool.query(getFollowedQuery, [follower_username], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ status: 'Error', message: 'You are not following any users.' });
        }

        const followedUsernames = results.map(result => result.followed_username);

        return res.status(200).json({ status: 'Success', followedUsernames: followedUsernames });  // corrected here
    });
});

app.post('/share_articles', (req, res) => {
    const { username, article_id } = req.body;

    if (!username || !article_id) {
        return res.status(400).json({ status: 'Error', message: 'Both username and article_id are required.' });
    }

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
app.post('/share_tweets', (req, res) => {
    const { username, tweet_link } = req.body;

    if (!username || !tweet_link) {
        return res.status(400).json({ status: 'Error', message: 'Both username and tweet_link are required.' });
    }

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
app.post('/get_shared_content', (req, res) => {
    const { follower_username } = req.body;

    if (!follower_username) {
        return res.status(400).json({ status: 'Error', message: 'follower_username is required.' });
    }

    const getFollowedUsersQuery = `
        SELECT followed_username
        FROM follows
        WHERE follower_username = ?
    `;

    pool.query(getFollowedUsersQuery, [follower_username], (err, followedUsersResults) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        if (followedUsersResults.length === 0) {
            return res.status(404).json({ status: 'Error', message: 'You are not following any users.' });
        }

        const followedUsernames = followedUsersResults.map(result => result.followed_username);
        followedUsernames.push(follower_username);

        const getSharedArticlesQuery = `
            SELECT username, article_id AS content_id, 'article' AS content_type, shared_at
            FROM shared_articles
            WHERE username IN (?)
            UNION
            SELECT username, tweet_link AS content_id, 'tweet' AS content_type, shared_at
            FROM shared_tweets
            WHERE username IN (?)
            ORDER BY shared_at DESC;
        `;

        pool.query(getSharedArticlesQuery, [followedUsernames, followedUsernames], (fetchError, sharedContentResults) => {
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
    app.post('/get-similar_users_searched', (req, res) => {
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
app.post('/save-articles', (req, res) => {
    const { username, article_id } = req.body;

    if (!username || !article_id) {
        return res.status(400).json({ status: 'Error', message: 'Both username and article_id are required.' });
    }

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
app.post('/save-tweets', (req, res) => {
    const { username, tweet_link } = req.body;

    if (!username || !tweet_link) {
        return res.status(400).json({ status: 'Error', message: 'Both username and tweet_link are required.' });
    }

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
app.post('/show-saved', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ status: 'Error', message: 'Username is required.' });
    }

    const showSavedQuery = `
        SELECT 'article' AS type, article_id AS id, saved_time
        FROM Saved_Articles
        WHERE username = ?
        UNION
        SELECT 'tweet' AS type, tweet_link AS id, saved_time
        FROM Saved_Tweets
        WHERE username = ?
        ORDER BY saved_time DESC;
    `;

    pool.query(showSavedQuery, [username, username], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        return res.status(200).json({ status: 'Success', data: results });
    });
});
app.post('/search_content', (req, res) => {
    const { searchQuery } = req.body;

    if (!searchQuery) {
        return res.status(400).json({ status: 'Error', message: 'Search query is required.' });
    }

    const searchQueryFormatted = `%${searchQuery}%`;

    const searchQuerySQL = `
        SELECT 'article' AS type, id AS id, date AS time
        FROM Articles
        WHERE headline LIKE ?
        UNION
        SELECT 'tweet' AS type, Tweet_Link AS id, Created_At AS time
        FROM Tweets
        WHERE Tweet LIKE ?
        ORDER BY time DESC
        LIMIT 50;
    `;

    pool.query(searchQuerySQL, [searchQueryFormatted, searchQueryFormatted], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 'Error', error: err.message });
        }

        return res.status(200).json({ status: 'Success', data: results });
    });
});
app.post('/comment_article', (req, res) => {
    const { article_id, username, content, parent_comment_id } = req.body;

    if (!article_id || !username || !content) {
        return res.status(400).json({ status: 'Error', message: 'article_id, username, and content are required.' });
    }

    const commentArticleQuery = `
        INSERT INTO comments (article_id, username, content, parent_comment_id, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
    `;

    pool.query(commentArticleQuery, [article_id, username, content, parent_comment_id || null], (err, results) => {
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
                parent_comment_id
            }
        });
    });
});

app.post('/get_comments_article', (req, res) => {
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

app.post('/comment_tweet', (req, res) => {
    const { tweet_link, username, content, parent_comment_id } = req.body;

    if (!tweet_link || !username || !content) {
        return res.status(400).json({ status: 'Error', message: 'tweet_link, username, and content are required.' });
    }

    const commentTweetQuery = `
        INSERT INTO comments_tweets (tweet_link, username, content, parent_comment_id, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
    `;

    pool.query(commentTweetQuery, [tweet_link, username, content, parent_comment_id || null], (err, results) => {
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
                parent_comment_id
            }
        });
    });
});

app.post('/get_comments_tweet', (req, res) => {
    const { tweet_link } = req.body;
    console.log('Received link in backend:', tweet_link);
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
        console.log('Results in backend: ', results);
        return res.status(200).json({ status: 'Success', data: results });
    });
});




//const PORT = process.env.PORT || 3000;
//app.listen(PORT, () => {
//    console.log(`Server is running on port ${PORT}`);
//});

app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:3000');
});

