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

    // Accept either JSON body (application/json) or form-encoded / multipart form posts
    var data = {};
    if(e.postData && e.postData.contents){
      try{
        data = JSON.parse(e.postData.contents || '{}');
      }catch(parseErr){
        // If parsing fails, fall back to raw content string
        data = { raw: e.postData.contents };
      }
    } else if(e.parameter && Object.keys(e.parameter).length){
      // form posts will populate e.parameter / e.parameters
      Object.keys(e.parameter).forEach(function(k){ data[k] = e.parameter[k]; });
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
