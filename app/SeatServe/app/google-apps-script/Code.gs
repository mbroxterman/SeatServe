const DATA_SHEET = 'SeatServe Data';
const META_SHEET = 'SeatServe Meta';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'load';
  if (action === 'status') return status_(e && e.parameter ? e.parameter.workspace : '');
  if (action === 'load') return load_();
  return json_({ ok: false, message: 'Unsupported action.' });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (request.action !== 'save') return json_({ ok: false, message: 'Unsupported action.' });
    return save_(request);
  } catch (error) {
    return json_({ ok: false, message: String(error && error.message ? error.message : error) });
  }
}

function status_(requestedWorkspaceName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
  const existingWorkspace = getMeta_(metaSheet, 'workspaceName');
  if (!existingWorkspace && requestedWorkspaceName) setMeta_(metaSheet, 'workspaceName', requestedWorkspaceName);
  return json_({
    ok: true,
    workspaceName: existingWorkspace || requestedWorkspaceName || ss.getName(),
    updatedAt: getMeta_(metaSheet, 'updatedAt') || ''
  });
}

function save_(request) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = getOrCreate_(ss, DATA_SHEET, ['key', 'json']);
  const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
  const remoteUpdatedAt = getMeta_(metaSheet, 'updatedAt');
  const lastKnown = request.lastKnownRemoteUpdatedAt || '';
  if (!request.force && remoteUpdatedAt && lastKnown && remoteUpdatedAt !== lastKnown) {
    return json_({ ok: false, conflict: true, updatedAt: remoteUpdatedAt, message: 'Google Sheets was changed after the browser last synchronized.' });
  }
  const updatedAt = new Date().toISOString();
  const workspaceName = request.workspaceName || getMeta_(metaSheet, 'workspaceName') || ss.getName();
  dataSheet.getRange(2, 1, Math.max(1, dataSheet.getMaxRows() - 1), 2).clearContent();
  dataSheet.getRange(2, 1, 1, 2).setValues([['seatserve', JSON.stringify(request.data || {})]]);
  setMeta_(metaSheet, 'workspaceName', workspaceName);
  setMeta_(metaSheet, 'updatedAt', updatedAt);
  setMeta_(metaSheet, 'clientUpdatedAt', request.clientUpdatedAt || updatedAt);
  SpreadsheetApp.flush();
  return json_({ ok: true, updatedAt: updatedAt, workspaceName: workspaceName });
}

function load_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = getOrCreate_(ss, DATA_SHEET, ['key', 'json']);
  const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
  const rows = dataSheet.getDataRange().getValues();
  const row = rows.slice(1).find(function(item) { return item[0] === 'seatserve'; });
  if (!row || !row[1]) return json_({ ok: false, message: 'No SeatServe data has been synchronized yet.' });
  return json_({
    ok: true,
    data: JSON.parse(row[1]),
    updatedAt: getMeta_(metaSheet, 'updatedAt') || '',
    workspaceName: getMeta_(metaSheet, 'workspaceName') || ss.getName()
  });
}

function getOrCreate_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function getMeta_(sheet, key) {
  const values = sheet.getDataRange().getValues();
  const row = values.slice(1).find(function(item) { return item[0] === key; });
  return row ? String(row[1] || '') : '';
}

function setMeta_(sheet, key, value) {
  const values = sheet.getDataRange().getValues();
  const index = values.findIndex(function(item, i) { return i > 0 && item[0] === key; });
  if (index >= 0) sheet.getRange(index + 1, 2).setValue(value);
  else sheet.appendRow([key, value]);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
