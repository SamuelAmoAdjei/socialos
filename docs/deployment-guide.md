# SocialOS — Complete Deployment Guide
# Vercel + Cloudflare + Google Cloud + Domain

---

## PHASE 3A — Vercel Deployment (20 min)

### Step 1: Push to GitHub

```bash
cd ~/Desktop/socialos

# Initialise git
git init
git add .
git commit -m "SocialOS v1.0 — initial build"

# Create a new repo on github.com (name it: socialos)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/socialos.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to **vercel.com** and sign in with GitHub
2. Click **Add New > Project**
3. Import your `socialos` repository
4. Framework: **Next.js** (auto-detected)
5. Click **Environment Variables** — add all of these:

| Key | Value |
|-----|-------|
| `NEXTAUTH_URL` | `https://your-app.vercel.app` (update after first deploy) |
| `NEXTAUTH_SECRET` | Output of: `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_SHEETS_ID` | Your sheet ID from the URL |
| `MAKE_WEBHOOK_URL` | Your Make.com Scenario 1 webhook URL |
| `MAKE_CALLBACK_SECRET` | Any strong secret string you choose |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

6. Click **Deploy**
7. Wait ~2 minutes for build to complete
8. Copy your deployment URL (e.g. `socialos-abc123.vercel.app`)

### Step 3: Update NEXTAUTH_URL

After the first deploy:
1. Vercel dashboard > Settings > Environment Variables
2. Update `NEXTAUTH_URL` to your actual deployment URL
3. Update `NEXT_PUBLIC_APP_URL` to match
4. Click **Redeploy** (Deployments tab > last deployment > Redeploy)

### Step 4: Update Google OAuth redirect URIs

1. Google Cloud Console > APIs & Services > Credentials
2. Click your OAuth 2.0 Client ID
3. Under **Authorised redirect URIs**, add:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```
4. Save

---

## PHASE 3B — Custom Domain with Cloudflare (30 min)

### Step 1: Buy or transfer a domain

Recommended registrars: Namecheap, Porkbun, Cloudflare itself.
Example: `socialos.app` or `youragency.app`

### Step 2: Add site to Cloudflare

1. Go to **cloudflare.com** and create a free account
2. Click **Add a site**
3. Enter your domain name
4. Select the **Free plan**
5. Cloudflare scans existing DNS records
6. Click **Continue**

### Step 3: Update nameservers at your registrar

Cloudflare provides two nameservers like:
```
ada.ns.cloudflare.com
bob.ns.cloudflare.com
```

Log into your domain registrar and replace the nameservers with these two.
Propagation takes 5 minutes to 48 hours (usually under 30 minutes).

### Step 4: Add DNS records in Cloudflare

In Cloudflare DNS > Add record:

```
Type: CNAME
Name: @  (or your domain)
Target: cname.vercel-dns.com
Proxy: ON (orange cloud)
```

```
Type: CNAME
Name: www
Target: cname.vercel-dns.com
Proxy: ON (orange cloud)
```

### Step 5: Add domain in Vercel

1. Vercel > Your project > Settings > Domains
2. Click **Add**
3. Enter your domain: `socialos.app`
4. Vercel will verify and issue a TLS certificate automatically

### Step 6: Enable Cloudflare security features

In Cloudflare dashboard:

**SSL/TLS:**
- Encryption mode: **Full (strict)**

**Security:**
- Security Level: **Medium**
- Bot Fight Mode: **ON**

**Speed:**
- Auto Minify: CSS ✓, JavaScript ✓, HTML ✓
- Brotli: **ON**

**Page Rules (optional — free tier allows 3):**
```
Rule 1: https://www.yourdomain.com/*
  → Forwarding URL (301) to https://yourdomain.com/$1
```

### Step 7: Update all URLs after domain setup

Update in Vercel environment variables:
```
NEXTAUTH_URL = https://yourdomain.com
NEXT_PUBLIC_APP_URL = https://yourdomain.com
```

Update in Google Cloud Console OAuth redirect URIs:
```
https://yourdomain.com/api/auth/callback/google
```

Update in Apps Script Settings tab:
```
CALLBACK_URL = https://yourdomain.com/api/publish/callback
```

---

## PHASE 3C — Google Cloud Setup (if not done) (20 min)

### Create a project

1. Go to **console.cloud.google.com**
2. Click the project dropdown > **New Project**
3. Name: "SocialOS"
4. Click **Create**

### Enable APIs

1. APIs & Services > **Library**
2. Search and enable each:
   - **Google Sheets API**
   - **Google Drive API**
   - **Gmail API**

### Create OAuth credentials

1. APIs & Services > **Credentials**
2. **+ Create Credentials** > OAuth 2.0 Client IDs
3. Application type: **Web application**
4. Name: "SocialOS Web App"
5. Authorised JavaScript origins:
   ```
   http://localhost:3000
   https://your-app.vercel.app
   https://yourdomain.com
   ```
6. Authorised redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/google
   https://your-app.vercel.app/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google
   ```
7. Click **Create** — copy Client ID and Client Secret

### Configure OAuth consent screen

1. APIs & Services > **OAuth consent screen**
2. User type: **External**
3. App name: "SocialOS"
4. Support email: your email
5. Scopes — click **Add or remove scopes**:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
6. Test users: add your email + client's email
7. Save

Note: App stays in "Testing" mode until you submit for verification.
In Testing mode, only the listed test users can sign in — which is fine for a VA dashboard.

---

## PHASE 3D — Apps Script Deployment (15 min)

### Step 1: Open Apps Script

1. Open your SocialOS Google Sheet
2. **Extensions > Apps Script**
3. Delete any existing code

### Step 2: Paste SheetSetup.gs first

1. Copy all code from `apps-script/SheetSetup.gs`
2. Paste into the editor
3. Click **Save** (Ctrl+S)
4. Select `setupSheet` from the function dropdown
5. Click **Run**
6. Grant permissions when prompted
7. Check the execution log — all tabs should be created

### Step 3: Paste SocialOS.gs

1. Create a new file: + > Script
2. Name it "SocialOS"
3. Copy all code from `apps-script/SocialOS.gs`
4. Paste into the editor
5. Click **Save**

### Step 4: Fill in Settings tab

In your Google Sheet, Settings tab column B:
```
B1 = [Make.com Scenario 1 webhook URL — paste after creating Scenario 1]
B2 = [Web App URL — fill after Step 5 below]
B3 = your.gmail@gmail.com
B4 = client@example.com
B5 = Client Name
B6 = America/New_York
B7 = 5
```

### Step 5: Deploy as Web App

1. In Apps Script editor: **Deploy > New deployment**
2. Type: **Web App**
3. Description: "SocialOS v1"
4. Execute as: **Me**
5. Who has access: **Anyone**
6. Click **Deploy**
7. Copy the Web App URL
8. Paste it into Settings!B2

### Step 6: Create triggers

1. Select `setupAll` from the function dropdown
2. Click **Run**
3. Grant permissions when prompted
4. Verify trigger created: left sidebar > clock icon (Triggers)
5. You should see: `checkScheduledPosts` running every 5 minutes

### Step 7: Test the connection

1. Select `testWebhook` from the function dropdown
2. Click **Run**
3. Check View > Executions for the output
4. Should show "Response code: 200" and "SUCCESS"

---

## PHASE 3E — End-to-End Test

Run this test sequence before telling your client the system is live:

1. **Create a test post:**
   - Open your SocialOS dashboard
   - Go to Compose
   - Write: "SocialOS system test — please ignore"
   - Select LinkedIn only
   - Set scheduled_at to 3 minutes from now
   - Click Save Draft

2. **Promote to approved:**
   - Open the Google Sheet
   - Find the post row
   - Change status from "draft" to "approved"

3. **Wait for trigger:**
   - Apps Script polls every 5 minutes
   - Watch the status column — it will change from "approved" → "publishing" → "published"
   - Check the Log tab for entries

4. **Verify Make.com fired:**
   - Make.com dashboard > Scenario 1 > History
   - You should see a successful execution

5. **Delete the test post:**
   - Log into LinkedIn directly and delete the test post

---

## Quick Reference

| Service | URL | Credential location |
|---------|-----|---------------------|
| Vercel dashboard | vercel.com | GitHub OAuth |
| Cloudflare | cloudflare.com | Email + password |
| Google Cloud | console.cloud.google.com | Google account |
| Apps Script | script.google.com | Google account |
| Make.com | make.com | Email + password |
| Your app | yourdomain.com | Google SSO |

---

## Troubleshooting Common Issues

**Build fails on Vercel:**
- Check Build logs for the specific error
- Most common: missing environment variable
- Ensure all 8 env vars are set in Vercel dashboard

**Sign in fails:**
- Verify NEXTAUTH_URL matches your actual URL exactly (no trailing slash)
- Verify redirect URI in Google Cloud matches exactly
- Check that your email is in the OAuth consent screen test users list

**Posts not firing:**
- Check Apps Script Executions log
- Verify scheduled_at is in the past AND status is "approved"
- Verify Settings!B1 has the correct Make.com webhook URL

**Make.com not posting:**
- Check Make.com Scenario 1 execution history
- Verify all platform connections are still active (Connections page)
- Check the error detail in the execution log

**Callback not updating sheet:**
- Verify Settings!B2 has the Apps Script Web App URL
- Verify the web app is deployed with "Anyone" access
- Check Make.com HTTP module for the response code
