// =============================================================================
// SocialOS — Google Apps Script v1.0
// =============================================================================
// INSTALLATION:
//   1. Open your SocialOS Google Sheet
//   2. Extensions > Apps Script
//   3. Paste this entire file, replacing any existing code
//   4. Save (Ctrl+S) — name the project "SocialOS"
//   5. Run setupAll() once manually to create triggers and deploy web app
//   6. After running setupAll(), copy the Web App URL into Settings!B2
// =============================================================================

// ─── SHEET + COLUMN CONFIG ────────────────────────────────────────────────────
var SHEET_POSTS     = 'Posts';
var SHEET_SETTINGS  = 'Settings';
var SHEET_LOG       = 'Log';
var SHEET_ANALYTICS = 'Analytics';

// Posts columns (1-based)
var COL_POST_ID          = 1;   // A
var COL_CLIENT_ID        = 2;   // B
var COL_CONTENT          = 3;   // C
var COL_LI_OVERRIDE      = 4;   // D
var COL_X_OVERRIDE       = 5;   // E
var COL_IG_OVERRIDE      = 6;   // F
var COL_PLATFORMS        = 7;   // G
var COL_MEDIA_URL        = 8;   // H
var COL_SCHEDULED_AT     = 9;   // I
var COL_STATUS           = 10;  // J
var COL_PLATFORM_IDS     = 11;  // K
var COL_PUBLISHED_AT     = 12;  // L
var COL_ERROR_MSG        = 13;  // M
var COL_DOC_LINK         = 14;  // N
var COL_CREATED_AT       = 15;  // O

// Settings rows (column B holds values)
var ROW_MAKE_WEBHOOK     = 1;   // B1 — Make.com Scenario 1 webhook URL
var ROW_CALLBACK_URL     = 2;   // B2 — this web app URL (fill after deployment)
var ROW_VA_EMAIL         = 3;   // B3 — your Gmail
var ROW_CLIENT_EMAIL     = 4;   // B4 — client's email
var ROW_CLIENT_NAME      = 5;   // B5 — client display name
var ROW_TIMEZONE         = 6;   // B6 — e.g. America/New_York
var ROW_POLL_INTERVAL    = 7;   // B7 — minutes (default 5)

// ─── READ SETTINGS ────────────────────────────────────────────────────────────
function getSettings() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  if (!sheet) throw new Error('Settings tab not found. Create a tab named "Settings".');
  var vals = sheet.getRange('B1:B7').getValues();
  return {
    makeWebhookUrl : vals[0][0] || '',
    callbackUrl    : vals[1][0] || '',
    vaEmail        : vals[2][0] || '',
    clientEmail    : vals[3][0] || '',
    clientName     : vals[4][0] || 'Client',
    timezone       : vals[5][0] || 'UTC',
    pollInterval   : parseInt(vals[6][0]) || 5
  };
}

// ─── LOGGING ──────────────────────────────────────────────────────────────────
function logEntry(fn, postId, action, details) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
    if (!sheet) return;
    sheet.appendRow([new Date().toISOString(), fn, postId || '', action, details || '']);
  } catch (e) {
    Logger.log('Log write failed: ' + e.message);
  }
}

// ─── MAIN SCHEDULER — runs every 5 minutes via time trigger ──────────────────
function checkScheduledPosts() {
  var settings = getSettings();
  var sheet    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_POSTS);
  if (!sheet) { logEntry('checkScheduledPosts', null, 'error', 'Posts tab not found'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { logEntry('checkScheduledPosts', null, 'no_posts', 'Sheet has no data rows'); return; }

  var data = sheet.getRange(2, 1, lastRow - 1, COL_CREATED_AT).getValues();
  var now  = new Date();
  var fired = 0;

  for (var i = 0; i < data.length; i++) {
    var row          = data[i];
    var postId       = String(row[COL_POST_ID - 1]       || '');
    var content      = String(row[COL_CONTENT - 1]       || '');
    var liOverride   = String(row[COL_LI_OVERRIDE - 1]   || '');
    var xOverride    = String(row[COL_X_OVERRIDE - 1]    || '');
    var igOverride   = String(row[COL_IG_OVERRIDE - 1]   || '');
    var platformsRaw = String(row[COL_PLATFORMS - 1]     || '');
    var mediaUrl     = String(row[COL_MEDIA_URL - 1]     || '');
    var scheduledAt  = row[COL_SCHEDULED_AT - 1];
    var status       = String(row[COL_STATUS - 1]        || '');

    // Only process approved posts that are due
    if (status !== 'approved') continue;
    if (!scheduledAt) continue;

    var schedDate = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
    if (isNaN(schedDate.getTime())) continue;
    if (schedDate > now) continue;

    // Immediately mark as publishing to prevent duplicate fires
    var rowIndex = i + 2;
    sheet.getRange(rowIndex, COL_STATUS).setValue('publishing');
    SpreadsheetApp.flush();

    // Build platforms array
    var platforms = platformsRaw.split(',')
      .map(function(p) { return p.trim().toLowerCase(); })
      .filter(function(p) { return p.length > 0; });

    // Build payload
    var payload = {
      post_id : postId,
      content : content,
      platform_content: {
        linkedin  : liOverride  || content,
        x         : xOverride   || content.substring(0, 280),
        instagram : igOverride  || content,
        facebook  : content,
        tiktok    : content
      },
      media_url    : mediaUrl || null,
      platforms    : platforms,
      callback_url : settings.callbackUrl
    };

    // Fire webhook
    try {
      var response = UrlFetchApp.fetch(settings.makeWebhookUrl, {
        method      : 'post',
        contentType : 'application/json',
        payload     : JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      if (code === 200 || code === 204) {
        logEntry('checkScheduledPosts', postId, 'webhook_sent', 'platforms: ' + platforms.join(','));
        fired++;
      } else {
        var errText = response.getContentText();
        sheet.getRange(rowIndex, COL_STATUS).setValue('failed');
        sheet.getRange(rowIndex, COL_ERROR_MSG).setValue('Make.com error ' + code + ': ' + errText.substring(0, 200));
        logEntry('checkScheduledPosts', postId, 'webhook_failed', errText.substring(0, 300));
        sendFailureAlert(settings, postId, 'Make.com returned ' + code + ': ' + errText.substring(0, 150));
      }
    } catch (e) {
      sheet.getRange(rowIndex, COL_STATUS).setValue('failed');
      sheet.getRange(rowIndex, COL_ERROR_MSG).setValue(e.message);
      logEntry('checkScheduledPosts', postId, 'exception', e.message);
      sendFailureAlert(settings, postId, e.message);
    }
  }

  if (fired === 0) logEntry('checkScheduledPosts', null, 'no_posts_due', '');
}

// ─── WEB APP — receives callbacks from Make.com ───────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var settings = getSettings();

    // ── Analytics sync from Scenario 2 ───────────────────────────────────────
    if (body.type === 'analytics') {
      writeAnalytics(body.data || []);
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Topic submissions from client portal ─────────────────────────────────
    if (body.type === 'topic_submission') {
      var topic = body.topic || {};
      var drafts = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Drafts');
      if (!drafts) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Drafts tab not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      drafts.appendRow([
        topic.mediaUrl || '',
        topic.title || '',
        Array.isArray(topic.platforms) ? topic.platforms.join(',') : '',
        '',
        'idea',
        'Submitted by client: ' + (topic.requestedBy || '')
      ]);
      logEntry('doPost', null, 'topic_submission', String(topic.title || '').substring(0, 120));
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Client approval mode toggle (fallback for limited OAuth accounts) ────
    if (body.type === 'client_approval_mode_update') {
      var clientEmail = String(body.clientEmail || '').toLowerCase().trim();
      var approvalRequired = body.approvalRequired === true;
      if (!clientEmail) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing clientEmail' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var updated = updateClientApprovalModeByEmail(clientEmail, approvalRequired);
      if (!updated) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Client not found in Clients tab' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      logEntry('doPost', null, 'client_approval_mode_update', clientEmail + ' => ' + (approvalRequired ? 'TRUE' : 'FALSE'));
      return ContentService.createTextOutput(JSON.stringify({ ok: true, approvalRequired: approvalRequired }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Publish result from Scenario 1 ───────────────────────────────────────
    var postId   = body.post_id;
    var results  = body.results || [];

    if (!postId) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing post_id' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_POSTS);
    var lastRow = sheet.getLastRow();
    var data    = sheet.getRange(2, COL_POST_ID, lastRow - 1, 1).getValues();

    var rowIndex = -1;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(postId)) { rowIndex = i + 2; break; }
    }

    if (rowIndex === -1) {
      logEntry('doPost', postId, 'not_found', 'Row not found for post_id: ' + postId);
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Post not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var successes = results.filter(function(r) { return r.status === 'success'; });
    var failures  = results.filter(function(r) { return r.status === 'failed';  });

    // Build platform IDs map
    var platformIds = {};
    successes.forEach(function(r) { platformIds[r.platform] = r.post_id; });

    var newStatus = 'published';
    if (failures.length > 0 && successes.length > 0) newStatus = 'partial';
    if (failures.length > 0 && successes.length === 0) newStatus = 'failed';

    sheet.getRange(rowIndex, COL_STATUS).setValue(newStatus);
    sheet.getRange(rowIndex, COL_PLATFORM_IDS).setValue(JSON.stringify(platformIds));
    sheet.getRange(rowIndex, COL_PUBLISHED_AT).setValue(new Date().toISOString());

    if (failures.length > 0) {
      var errMsg = failures.map(function(f) { return f.platform + ': ' + (f.error || 'unknown'); }).join(' | ');
      sheet.getRange(rowIndex, COL_ERROR_MSG).setValue(errMsg);
    }

    logEntry('doPost', postId, newStatus, JSON.stringify(results).substring(0, 300));
    sendConfirmation(settings, postId, newStatus, successes, failures);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, status: newStatus }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    logEntry('doPost', null, 'exception', err.message);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function updateClientApprovalModeByEmail(clientEmail, approvalRequired) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients');
  if (!sheet) return false;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (var i = 0; i < data.length; i++) {
    var email = String(data[i][2] || '').toLowerCase().trim(); // column C
    if (email === clientEmail) {
      var rowIndex = i + 2;
      sheet.getRange(rowIndex, 7).setValue(approvalRequired ? 'TRUE' : 'FALSE'); // column G
      return true;
    }
  }
  return false;
}

// ─── ANALYTICS WRITER ─────────────────────────────────────────────────────────
function writeAnalytics(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ANALYTICS);
  if (!sheet) return;
  var today = new Date().toISOString().split('T')[0];

  data.forEach(function(item) {
    var imp  = Number(item.impressions  || 0);
    var like = Number(item.likes        || 0);
    var com  = Number(item.comments     || 0);
    var shar = Number(item.shares       || 0);
    var eng  = imp > 0 ? ((like + com + shar) / imp * 100).toFixed(2) : '0.00';

    sheet.appendRow([
      today,
      item.platform      || '',
      item.post_id       || '',
      imp,
      Number(item.reach  || 0),
      like, com, shar,
      Number(item.clicks || 0),
      eng,
      Number(item.follower_count || 0),
      Number(item.follower_delta || 0)
    ]);
  });

  logEntry('writeAnalytics', null, 'synced', data.length + ' rows written');
}

// ─── EMAIL HELPERS ────────────────────────────────────────────────────────────
function sendFailureAlert(settings, postId, message) {
  if (!settings.vaEmail) return;
  try {
    GmailApp.sendEmail(
      settings.vaEmail,
      'SocialOS Alert — Post ' + postId + ' failed',
      'There was a problem publishing post ' + postId + '.\n\nDetails: ' + message +
      '\n\nCheck the Posts sheet Log tab for full details.\n\n' +
      'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
    );
  } catch (e) { Logger.log('Alert email failed: ' + e.message); }
}

function sendConfirmation(settings, postId, status, successes, failures) {
  var emails = [settings.vaEmail, settings.clientEmail].filter(Boolean).join(',');
  if (!emails) return;

  var platList = successes.map(function(s) { return s.platform.toUpperCase(); }).join(', ');
  var subject  = status === 'published'
    ? 'Posted: ' + platList + ' — Post #' + postId
    : 'Partial publish: ' + platList + ' succeeded — Post #' + postId;

  var body = '';
  if (successes.length > 0) body += 'Successfully posted to: ' + platList + '\n';
  if (failures.length > 0) {
    body += '\nFailed on: ' + failures.map(function(f) { return f.platform; }).join(', ') + '\n';
    body += failures.map(function(f) { return f.platform + ': ' + (f.error || 'unknown error'); }).join('\n');
  }
  body += '\n\nView your sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl();

  try {
    GmailApp.sendEmail(emails, subject, body);
  } catch (e) { Logger.log('Confirmation email failed: ' + e.message); }
}

// ─── SETUP — run this ONCE manually after pasting the script ─────────────────
function setupAll() {
  // 1. Delete any existing triggers
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // 2. Create the 5-minute polling trigger
  ScriptApp.newTrigger('checkScheduledPosts')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Trigger created: checkScheduledPosts runs every 5 minutes.');
  Logger.log('');
  Logger.log('NEXT STEP: Deploy this script as a Web App:');
  Logger.log('  Deploy > New deployment > Web App');
  Logger.log('  Execute as: Me');
  Logger.log('  Who has access: Anyone');
  Logger.log('  Copy the Web App URL into Settings!B2');
}

// ─── TEST HELPERS ─────────────────────────────────────────────────────────────
// Run testWebhook() manually to verify Make.com connectivity before going live.
function testWebhook() {
  var settings = getSettings();
  if (!settings.makeWebhookUrl) {
    Logger.log('ERROR: No Make.com webhook URL in Settings!B1');
    return;
  }

  var testPayload = {
    post_id      : 'TEST_' + Date.now(),
    content      : 'SocialOS connection test — please ignore this post.',
    platform_content: {
      linkedin: 'SocialOS connection test',
      x: 'SocialOS test',
      instagram: 'SocialOS test',
      facebook: 'SocialOS test',
      tiktok: 'SocialOS test'
    },
    media_url    : null,
    platforms    : ['linkedin'],
    callback_url : settings.callbackUrl
  };

  try {
    var response = UrlFetchApp.fetch(settings.makeWebhookUrl, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(testPayload), muteHttpExceptions: true
    });
    Logger.log('Response code: ' + response.getResponseCode());
    Logger.log('Response body: ' + response.getContentText().substring(0, 300));
    Logger.log(response.getResponseCode() === 200 ? 'SUCCESS — webhook is working!' : 'WARNING — unexpected response code');
  } catch (e) {
    Logger.log('FAILED: ' + e.message);
  }
}

// Run testCallback() to verify the web app endpoint is reachable.
function testCallback() {
  var settings = getSettings();
  if (!settings.callbackUrl) {
    Logger.log('ERROR: No callback URL in Settings!B2');
    return;
  }

  var testBody = {
    post_id : 'TEST_CALLBACK',
    results : [{ platform: 'linkedin', status: 'success', post_id: 'urn:test:123' }]
  };

  try {
    var response = UrlFetchApp.fetch(settings.callbackUrl, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(testBody), muteHttpExceptions: true
    });
    Logger.log('Callback response: ' + response.getResponseCode());
    Logger.log(response.getContentText().substring(0, 200));
  } catch (e) {
    Logger.log('FAILED: ' + e.message);
  }
}
