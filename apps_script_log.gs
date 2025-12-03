// Apps Script Web App to accept JSON logs and append to a Google Sheet.
// Instructions: set SPREADSHEET_ID to your sheet ID and (optionally) LOG_SECRET.

const SPREADSHEET_ID = 'PUT_YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'logs';
// Optional: set a short shared secret here AND in the client `terminal.js` `LOG_SECRET` constant.
// Leave empty ('') to disable the secret check during testing / quick deployments.
const LOG_SECRET = '';

function doPost(e){
  try{
    if(!e) return jsonResponse({ status: 'error', message: 'no event object' }, 400);

    // Accept either JSON body (application/json) or form-encoded posts.
    // Prefer `e.parameter` when present (Apps Script populates it for form posts).
    var data = {};
    if(e.parameter && Object.keys(e.parameter).length){
      Object.keys(e.parameter).forEach(function(k){ data[k] = e.parameter[k]; });
    } else if(e.postData && e.postData.contents){
      var content = e.postData.contents || '';
      var contentType = (e.postData.type || '').toLowerCase();
      try{
        if(contentType.indexOf('application/json') !== -1){
          data = JSON.parse(content || '{}');
        } else if(contentType.indexOf('application/x-www-form-urlencoded') !== -1){
          // parse form-encoded body into key/value map
          content.split('&').forEach(function(pair){
            if(!pair) return;
            var kv = pair.split('=');
            var k = decodeURIComponent(kv[0]||'');
            var v = decodeURIComponent((kv[1]||'').replace(/\+/g,' '));
            data[k] = v;
          });
        } else {
          // try JSON parse first, otherwise keep raw
          try{ data = JSON.parse(content || '{}'); }catch(e2){ data = { raw: content }; }
        }
      }catch(parseErr){
        data = { raw: content };
      }
    } else {
      return jsonResponse({ status: 'error', message: 'no payload' }, 400);
    }

    // Helpful check: ensure the script owner set the spreadsheet id
    if(!SPREADSHEET_ID || SPREADSHEET_ID.indexOf('PUT_YOUR') !== -1){
      return jsonResponse({ status: 'error', message: 'SPREADSHEET_ID not set in script' }, 500);
    }

    // Simple secret check: if LOG_SECRET set, client must include field `secret` with matching value
    if(LOG_SECRET && String(data.secret || '') !== String(LOG_SECRET)){
      return jsonResponse({ status: 'error', message: 'unauthorized' }, 401);
    }

    var ts = data.ts || new Date().toISOString();
    var uname = data.uname || '';
    var device = data.device || '';
    var page = data.page || '';
    var command = data.command || data.event || '';
    var passcode = data.passcode || '';
    var extra = data.extra || data.raw || '';

    // Open spreadsheet and append a row
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if(!sheet){
      sheet = ss.insertSheet(SHEET_NAME);
      // header row
      sheet.appendRow(['timestamp','iso_ts','uname','device','page','command','passcode','extra']);
    }

    // Use both human timestamp and ISO
    var rowTs = new Date(ts);
    sheet.appendRow([rowTs, ts, uname, device, page, command, passcode, typeof extra === 'string' ? extra : JSON.stringify(extra)]);

    return jsonResponse({ status: 'ok' });
  }catch(err){
    return jsonResponse({ status: 'error', message: String(err) }, 500);
  }
}

function jsonResponse(obj, code){
  code = code || 200;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
