from flask import Flask, request, jsonify
import asyncio
import csv
import random
from datetime import datetime
from twikit import Client, TooManyRequests
from configparser import ConfigParser
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MINIMUM_TWEETS = 50
config = ConfigParser()
config.read('config.ini')
username = config['X']['username']
password = config['X']['password']
email = config['X']['email']

async def fetch_tweets(client, query):
    words = query.split()
    formatted_query = ' and '.join([f'"{word}"' for word in words]) + ' min_faves:1000 min_retweets:100 lang:en -filter:replies'
    return await client.search_tweet(formatted_query, product='Latest', count = 50)

# Function to process the query and fetch tweets asynchronously
async def process_query(client, query, semaphore):
    async with semaphore:
        tweet_counter = 0
        tweets = None
        backoff_time = 15  # Start with 15 seconds for rate limit
        fetched_tweets = []

        while tweet_counter < MINIMUM_TWEETS:
            try:
                if tweets is None:
                    print(f"Fetching tweets for query: {query}")
                    tweets = await fetch_tweets(client, query)
                else:
                    tweets = await tweets.next()

                if not tweets:
                    print("No more tweets found. Exiting.")
                    break

                for tweet in tweets:
                    if tweet_counter >= MINIMUM_TWEETS:
                        break
                    tweet_counter += 1
                    tweet_text = tweet.full_text.replace('\n', ' ') if hasattr(tweet, 'full_text') else tweet.text.replace('\n', ' ')
                    tweet_link = f"https://twitter.com/{tweet.user.screen_name}/status/{tweet.id}"
                    media_url = tweet.media[0]['media_url_https'] if tweet.media else None
                    fetched_tweets.append({
                        'Username': tweet.user.name,
                        'Tweet': tweet_text,
                        'Created_At': str(tweet.created_at),
                        'Retweets': tweet.retweet_count,
                        'Favorites': tweet.favorite_count,
                        'Tweet_Link': tweet_link,
                        'Media_URL': media_url,
                        'type': 'tweet'
                    })

            except Exception as e:
                if '429' in str(e) or isinstance(e, TooManyRequests):
                    print("Rate limit exceeded. Applying exponential backoff...")
                    await asyncio.sleep(backoff_time)
                    backoff_time = min(backoff_time * 2, 60 * 15)  # Cap at 15 minutes
                else:
                    print(f"An error occurred: {e}")
                    await asyncio.sleep(5)  # Shorter wait for other errors

        return fetched_tweets

# Flask route to get tweets based on a query
@app.route('/get_tweets', methods=['GET'])
def get_tweets():
    query = request.args.get('query')
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = Client(language='en-US')

    async def run_query():
        await client.login(auth_info_1=username, auth_info_2=email, password=password)
        semaphore = asyncio.Semaphore(1)
        return await process_query(client, query, semaphore)

    try:
        tweets = loop.run_until_complete(run_query())
        return jsonify(tweets)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

