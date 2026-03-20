// =============================================================================
// SocialOS — Sheet Setup Script
// =============================================================================
// Run setupSheet() ONCE to create all required tabs with correct headers.
// Run this before pasting the main SocialOS.gs script.
// =============================================================================

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var tabs = [
    {
      name: 'Posts',
      headers: ['post_id','client_id','content','li_override','x_override','ig_override',
                'platforms','media_url','scheduled_at','status','platform_post_ids',
                'published_at','error_msg','doc_link','created_at']
    },
    {
      name: 'Clients',
      headers: ['id','name','email','timezone','make_webhook_url','platforms',
                'approval_required','created_at']
    },
    {
      name: 'Analytics',
      headers: ['date','platform','post_id','impressions','reach','likes',
                'comments','shares','clicks','engagement_rate','follower_count','follower_delta']
    },
    {
      name: 'Settings',
      headers: [
        ['MAKE_WEBHOOK_URL',  ''],
        ['CALLBACK_URL',      ''],
        ['VA_EMAIL',          ''],
        ['CLIENT_EMAIL',      ''],
        ['CLIENT_NAME',       ''],
        ['CLIENT_TIMEZONE',   'UTC'],
        ['POLL_INTERVAL_MINS','5']
      ]
    },
    {
      name: 'Log',
      headers: ['timestamp','function','post_id','action','details']
    },
    {
      name: 'Drafts',
      headers: ['doc_link','title','platforms','target_date','stage','notes']
    }
  ];

  tabs.forEach(function(tabDef) {
    // Create or clear the tab
    var sheet = ss.getSheetByName(tabDef.name);
    if (!sheet) {
      sheet = ss.insertSheet(tabDef.name);
    }

    // Settings tab has key-value pairs in columns A and B
    if (tabDef.name === 'Settings') {
      tabDef.headers.forEach(function(row, i) {
        sheet.getRange(i + 1, 1).setValue(row[0]);
        if (row[1]) sheet.getRange(i + 1, 2).setValue(row[1]);
      });
      // Style the key column
      sheet.getRange('A1:A10').setFontWeight('bold').setBackground('#f0f4ff');
      Logger.log('Settings tab configured — fill in column B values');
      return;
    }

    // Other tabs: row 1 = headers
    var headers = tabDef.headers;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Style headers
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1B3A5C')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(11);

    // Freeze header row
    sheet.setFrozenRows(1);

    Logger.log(tabDef.name + ' tab ready with ' + headers.length + ' columns');
  });

  // Add a sample client row
  var clientSheet = ss.getSheetByName('Clients');
  if (clientSheet && clientSheet.getLastRow() < 2) {
    clientSheet.appendRow([
      'client_1',
      'Acme Corp',
      'client@acmecorp.com',
      'America/New_York',
      '',   // make_webhook_url — fill after Make.com setup
      'linkedin,instagram,facebook',
      'TRUE',
      new Date().toISOString()
    ]);
    Logger.log('Sample client row added to Clients tab');
  }

  Logger.log('');
  Logger.log('Sheet setup complete!');
  Logger.log('Next: Fill in column B of the Settings tab, then paste SocialOS.gs');
}
