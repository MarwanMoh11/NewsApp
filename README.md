# Chronically

A React Native app that puts news articles and tweets in one feed. It targets iOS, Android and the web through Expo.

## What it does

- **One feed for articles and tweets**, filtered by the categories you pick, with trending tweets and search across both.
- **Explain a tweet.** Gemini 1.5 Flash writes a short, article-style explanation of a tweet, including its image when there is one. Each explanation is generated once and cached in the database.
- **Social features:** follow other readers (follows are accepted before they count), comment on articles and tweets, save them for later, and repost them to the people you're connected with.
- **Accounts** through Auth0, with profile editing, content preferences, account deactivation, and deletion that also removes the Auth0 user.

## How it's built

| Part | Where | Stack |
|---|---|---|
| App | `app/`, `components/` | Expo 52, Expo Router, React Native, TypeScript |
| API | `.netlify/functions-internal/index.js` | Express on Netlify Functions, MySQL, JWT sessions |
| AI | same file, `/explain_tweet` | `@google/generative-ai` (Gemini 1.5 Flash) |
| Media | profile pictures | Cloudinary uploads |

`back/index.js` is the earlier standalone version of the API and is kept for reference.

## Running it

```bash
npm install
npx expo start
```

The API reads its configuration from environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `JWT_SECRET` and `GOOGLE_API_KEY`. The app reads `API_URL` and the Auth0 and Cloudinary settings from `.env` through `app.config.js`.
