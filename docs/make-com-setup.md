# SocialOS — Make.com Scenario Configuration
# Complete step-by-step setup for both scenarios

## Prerequisites
- Make.com account (free tier)
- Client social accounts ready to connect
- Your SocialOS app deployed (Vercel URL known)
- Apps Script deployed as Web App (callback URL known)

---

## SCENARIO 1 — Post Publisher (Webhook Triggered)

### Step 1: Create the scenario
1. make.com > Create a new scenario
2. Name it: "SocialOS — Post Publisher"
3. Click the "+" to add the first module

### Step 2: Webhook trigger module
- Module: Webhooks > Custom webhook
- Click "Add" to create a new webhook
- Name: "SocialOS Publish Trigger"
- Click Save — Make.com generates a unique URL
- **COPY THIS URL** → paste into your Settings sheet B1 AND your .env.local MAKE_WEBHOOK_URL
- Click "Redetermine data structure"
- Send a test payload using the testWebhook() function in Apps Script
  - In Apps Script editor: select testWebhook from dropdown, click Run
  - Make.com will detect the payload structure automatically
- Click OK

### Step 3: Router module
- Click the "+" after the webhook
- Module: Flow Control > Router
- This creates branching paths — one per platform
- You will have up to 5 branches (LinkedIn, Instagram, Facebook, X, TikTok)

### Step 4a: LinkedIn branch
- Click the "+" on the first router branch
- Add a filter: "platforms" array contains "linkedin"
  - Condition: platforms[] > Contains > "linkedin"
- Module: LinkedIn > Create a post
- Connection: click "Add" > authorise with client's LinkedIn
- Connection name: "Acme Corp LinkedIn"
- Fields:
  - Post content: `{{platform_content.linkedin}}`
  - Visibility: PUBLIC
  - If media_url exists: attach using LinkedIn > Upload media first, then reference
- Set error handler: Add error handler route > Resume (so other platforms still post if LinkedIn fails)

### Step 4b: Instagram branch
- Click "+" on second router branch
- Filter: platforms[] > Contains > "instagram"
- Module: Instagram for Business > Create a photo post
- Connection: authorise with client's Instagram Business account
- Fields:
  - Caption: `{{platform_content.instagram}}`
  - Image URL: `{{media_url}}`
  - Note: Instagram REQUIRES an image URL — if media_url is empty, this branch will skip
- Error handler: Resume

### Step 4c: Facebook branch
- Click "+" on third router branch
- Filter: platforms[] > Contains > "facebook"
- Module: Facebook Pages > Create a Page post
- Connection: authorise with client's Facebook Page
- Fields:
  - Message: `{{platform_content.facebook}}`
  - Link: leave empty (or `{{media_url}}` if it's an image link)
- Error handler: Resume

### Step 4d: X (Twitter) branch
- Click "+" on fourth router branch
- Filter: platforms[] > Contains > "x"
- Module: X (Twitter) > Create a tweet
- Connection: authorise with client's X account
- Fields:
  - Text: `{{platform_content.x}}`
  - Note: Make.com auto-truncates to 280 chars
- Error handler: Resume

### Step 4e: TikTok branch
- Click "+" on fifth router branch
- Filter: platforms[] > Contains > "tiktok"
- Module: TikTok > Upload a video
- Connection: authorise with client's TikTok account
- Fields:
  - Video URL: `{{media_url}}`
  - Caption: `{{platform_content.tiktok}}`
  - Note: DO NOT include URLs in caption — TikTok rejects them
  - Privacy level: PUBLIC_TO_EVERYONE
- Error handler: Resume

### Step 5: Array Aggregator (after all branches converge)
- Click "+" after all router branches converge
- Module: Flow Control > Array aggregator
- Source module: Router
- Aggregated fields: map each branch output to a result object:
  ```
  platform: linkedin / instagram / facebook / x / tiktok
  status: success (if the branch ran) or failed (error handler)
  post_id: the ID returned by each platform module
  error: error message if failed
  ```
- Group by: `{{post_id}}` (from webhook payload)

### Step 6: HTTP callback module
- Click "+" after the aggregator
- Module: HTTP > Make a request
- URL: `{{callback_url}}` — this comes from your webhook payload
  - Fallback URL if empty: your deployed app URL + /api/publish/callback
- Method: POST
- Headers:
  - Content-Type: application/json
  - x-socialos-secret: [your MAKE_CALLBACK_SECRET from .env.local]
- Body type: Raw
- Content type: application/json
- Body:
  ```json
  {
    "post_id": "{{post_id}}",
    "results": {{aggregated_results}},
    "access_token": "{{your_google_access_token}}"
  }
  ```
  Note: For the callback to update your Next.js API, you pass the access token.
  Alternatively: the callback can go to the Apps Script web app URL instead,
  which is simpler for the $0 architecture.

### Step 7: Save and activate
- Click the clock icon to set scenario scheduling: leave as "immediately" (webhook)
- Toggle the scenario to ON (blue toggle)
- Test end-to-end using a draft post in your sheet

---

## SCENARIO 2 — Analytics Sync (Daily Schedule)

### Step 1: Create the scenario
1. Make.com > Create a new scenario
2. Name it: "SocialOS — Analytics Sync"

### Step 2: Schedule trigger
- Module: Schedule (clock icon)
- Run: Every day
- Time: 03:00 UTC
- Note: The free plan 15-minute interval limit does NOT apply to daily triggers

### Step 3: LinkedIn analytics
- Module: LinkedIn > Get post statistics
- Connection: same client LinkedIn connection
- Date range: last 7 days
- Metrics: impressions, clicks, reactions, comments, shares

### Step 4: Instagram insights
- Module: Instagram for Business > Get insights
- Connection: same client Instagram connection
- Metrics: reach, impressions, likes, comments, saves

### Step 5: Facebook page insights
- Module: Facebook Pages > Get page insights
- Connection: same client Facebook connection
- Metrics: page_impressions, page_engaged_users

### Step 6: X analytics
- Module: X (Twitter) > Get tweet metrics
- Connection: same client X connection
- Fields: impressions, url_link_clicks, retweet_count, like_count

### Step 7: Aggregator
- Module: Flow Control > Array aggregator
- Combine all platform data into one array with structure:
  ```
  [
    { platform: "linkedin", impressions: ..., reach: ..., likes: ... },
    { platform: "instagram", ... },
    ...
  ]
  ```

### Step 8: HTTP POST to Apps Script callback
- Module: HTTP > Make a request
- URL: your Apps Script Web App URL (from Settings!B2)
- Method: POST
- Body (JSON):
  ```json
  {
    "type": "analytics",
    "data": {{aggregated_array}}
  }
  ```

### Step 9: Activate
- Toggle scenario to ON
- Test by running manually (click Run once)
- Check your Analytics tab for new rows

---

## Connection Management

### Connecting a new client
1. In Make.com, go to Connections (left sidebar)
2. Click "Add connection" for each platform
3. Name connections clearly: "[ClientName] LinkedIn", "[ClientName] Instagram" etc.
4. Walk the client through OAuth authorisation on a call (10 minutes)
5. Update the platform modules in Scenario 1 to use the new connection

### Multiple clients on free tier
The free Make.com tier allows 2 active scenarios total.
For multiple clients, you have two options:

Option A (free): One Scenario 1 that handles ALL clients
- Add a Switch/Router at the start based on `{{client_id}}`
- Each client gets their own branch with their own connections
- Ops scale with number of clients — watch the 1,000/month budget

Option B (paid): Upgrade to Core ($9/month)
- Unlimited scenarios — one Scenario 1 per client
- 10,000 ops/month — supports ~15 clients

---

## Troubleshooting

### Webhook not receiving data
- Confirm the URL in Settings!B1 matches the Make.com webhook URL exactly
- Check Apps Script execution log: View > Executions
- Manually run testWebhook() in Apps Script and check Logger output

### Make.com returning 422 errors
- Usually means the payload structure doesn't match what Make.com expects
- Re-run "Redetermine data structure" on the webhook module
- Trigger testWebhook() again and click OK

### Platform module authentication errors
- Go to Make.com Connections > find the failing connection > Verify
- Re-authorise if expired — client may need to approve again

### Posts stuck as "publishing"
- Check Make.com execution history for errors
- Check Apps Script Log tab for callback errors
- Manually update the row status in the sheet if needed
