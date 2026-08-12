const SEATSERVE_SPREADSHEET_ID = '146i2shTLFn8PPAPbdZocCGYc4j-8tH_SY3T-T1AStJE';

const DATA_SHEET = 'SeatServe Data';
const META_SHEET = 'SeatServe Meta';
const STRUCTURED_SHEETS = [
  'Events',
  'Venues',
  'Zones',
  'Venue Sections',
  'Menu Categories',
  'Menu Items',
  'Menus',
  'Runners',
  'Orders',
  'Customer Feedback',
  'Workspace Settings',
  'Community Support',
  'Activity',
  'Archived Orders',
  'Archived Feedback'
];

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'load';
    if (action === 'status') return status_(e && e.parameter ? e.parameter.workspace : '');
    if (action === 'load') return load_();
    return json_({ ok: false, message: 'Unsupported action.' });
  } catch (error) {
    return json_({ ok: false, message: errorMessage_(error) });
  }
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (request.action !== 'save') return json_({ ok: false, message: 'Unsupported action.' });
    return save_(request);
  } catch (error) {
    return json_({ ok: false, message: errorMessage_(error) });
  }
}

function status_(requestedWorkspaceName) {
  const ss = getSpreadsheet_();
  const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
  const existingWorkspace = getMeta_(metaSheet, 'workspaceName');
  if (!existingWorkspace && requestedWorkspaceName) setMeta_(metaSheet, 'workspaceName', requestedWorkspaceName);
  return json_({
    ok: true,
    workspaceName: existingWorkspace || requestedWorkspaceName || ss.getName(),
    updatedAt: getMeta_(metaSheet, 'updatedAt') || '',
    spreadsheetName: ss.getName(),
    structuredSync: true,
    schemaVersion: 7
  });
}

function save_(request) {
  const ss = getSpreadsheet_();
  const dataSheet = getOrCreate_(ss, DATA_SHEET, ['key', 'json']);
  const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
  const remoteUpdatedAt = getMeta_(metaSheet, 'updatedAt');
  const lastKnown = request.lastKnownRemoteUpdatedAt || '';
  if (!request.force && remoteUpdatedAt && lastKnown && remoteUpdatedAt !== lastKnown) {
    return json_({ ok: false, conflict: true, updatedAt: remoteUpdatedAt, message: 'Google Sheets was changed after the browser last synchronized.' });
  }

  const incomingData = request.data || {};
  storeActiveContacts_(incomingData.orders || []);
  const data = sanitizeForSheets_(incomingData);
  const updatedAt = new Date().toISOString();
  const workspaceName = request.workspaceName || getMeta_(metaSheet, 'workspaceName') || ss.getName();

  // Keep one lossless JSON snapshot for backup/backward compatibility, plus a readable sync heartbeat.
  replaceRows_(dataSheet, [
    ['seatserve', JSON.stringify(data)],
    ['lastSyncAt', updatedAt],
    ['lastSyncStatus', 'success'],
    ['lastSyncSource', 'SeatServe Netlify / app'],
    ['appVersion', 'v2.1.6C'],
    ['workspaceName', workspaceName]
  ]);

  // Also write human-readable normalized tabs that may be edited directly.
  writeStructuredData_(ss, data);

  setMeta_(metaSheet, 'workspaceName', workspaceName);
  setMeta_(metaSheet, 'updatedAt', updatedAt);
  setMeta_(metaSheet, 'clientUpdatedAt', request.clientUpdatedAt || updatedAt);
  setMeta_(metaSheet, 'schemaVersion', '7');
  setMeta_(metaSheet, 'lastWriteSource', 'SeatServe app');
  SpreadsheetApp.flush();

  return json_({ ok: true, updatedAt: updatedAt, workspaceName: workspaceName, structuredSync: true, schemaVersion: 7, menuItemCount: (data.menuItems || []).length });
}

function load_() {
  const ss = getSpreadsheet_();
  const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
  let data;
  let source = 'structured';

  try {
    data = restoreActiveContacts_(readStructuredData_(ss));
  } catch (error) {
    source = 'json-backup';
    const dataSheet = getOrCreate_(ss, DATA_SHEET, ['key', 'json']);
    const rows = dataSheet.getDataRange().getValues();
    const row = rows.slice(1).find(function(item) { return item[0] === 'seatserve'; });
    if (!row || !row[1]) throw error;
    data = restoreActiveContacts_(JSON.parse(row[1]));
  }

  return json_({
    ok: true,
    data: data,
    updatedAt: getMeta_(metaSheet, 'updatedAt') || '',
    workspaceName: getMeta_(metaSheet, 'workspaceName') || ss.getName(),
    source: source,
    structuredSync: true,
    schemaVersion: 7
  });
}

function writeStructuredData_(ss, data) {
  writeTable_(ss, 'Events', [
    'id','name','opponent','venueId','menuId','startsAt','orderingOpensAt','orderingClosesAt','status','orderingEnabled'
  ], (data.events || []).map(function(x) { return [x.id,x.name,x.opponent,x.venueId,x.menuId || '',x.startsAt,x.orderingOpensAt,x.orderingClosesAt,x.status,boolean_(x.orderingEnabled)]; }));

  writeTable_(ss, 'Venues', ['id','name','type','address','active'], (data.venues || []).map(function(x) {
    return [x.id,x.name,x.type,x.address,boolean_(x.active)];
  }));

  const zones = [];
  const sections = [];
  (data.venues || []).forEach(function(venue) {
    (venue.zones || []).forEach(function(zone) {
      zones.push([venue.id,zone.id,zone.name,zone.description || '',boolean_(zone.deliveryEnabled),boolean_(zone.active),nullableNumber_(zone.baselineRoundTripMinutes),nullableNumber_(zone.learnedRoundTripMinutes),nullableNumber_(zone.completedTripCount)]);
      (zone.sections || []).forEach(function(section) {
        sections.push([venue.id,zone.id,section.id,section.name,section.seatRange || '',boolean_(section.active)]);
      });
    });
  });
  writeTable_(ss, 'Zones', ['venueId','id','name','description','deliveryEnabled','active','baselineRoundTripMinutes','learnedRoundTripMinutes','completedTripCount'], zones);
  writeTable_(ss, 'Venue Sections', ['venueId','zoneId','id','name','seatRange','active'], sections);

  writeTable_(ss, 'Menu Categories', ['id','name','emoji','imageUrl','visible','sortOrder'], (data.menuCategories || []).map(function(x) {
    return [x.id,x.name,x.emoji || '',x.imageUrl || '',boolean_(x.visible),number_(x.sortOrder)];
  }));

  writeTable_(ss, 'Menu Items', ['id','name','category','categoryId','description','price','available','kind','condiments','emoji','imageUrl','imageAlt','displayStyle','displayOrder'], (data.menuItems || []).map(function(x, index) {
    return [x.id,x.name,x.category || '',x.categoryId || '',x.description || '',number_(x.price),boolean_(x.available),x.kind || 'standard',(x.condiments || []).join(', '),x.emoji || '',x.imageUrl || '',x.imageAlt || '',x.displayStyle || 'emoji',index];
  }));

  writeTable_(ss, 'Menus', ['id','name','description','active','itemIds','priceOverridesJson','hiddenItemIds'], (data.menus || []).map(function(x) {
    return [x.id,x.name,x.description || '',boolean_(x.active),(x.itemIds || []).join(', '),JSON.stringify(x.priceOverrides || {}),(x.hiddenItemIds || []).join(', ')];
  }));

  writeTable_(ss, 'Runners', ['id','name','email','phone','role','status','active','venueId','zoneIds','shiftStart','shiftEnd','completedDeliveries','rating','activeOrderId','availableSince','assignedAt','estimatedAvailableAt'], (data.runners || []).map(function(x) {
    return [x.id,x.name,x.email || '',x.phone || '',x.role,x.status,boolean_(x.active),x.venueId || '',(x.zoneIds || []).join(', '),x.shiftStart || '',x.shiftEnd || '',number_(x.completedDeliveries),number_(x.rating),x.activeOrderId || '',x.availableSince || '',x.assignedAt || '',x.estimatedAvailableAt || ''];
  }));

  writeTable_(ss, 'Orders', [
    'id','eventId','runnerId','status','fulfillmentMethod','customerName','venueId','zoneId','vertical','horizontal','locationNotes','itemsJson','subtotal','tax','deliveryFee','total','paymentMethod','cashTotal','estimatedCardFee','cardTotal','paymentCollectedAt','seatBeaconRequestedAt','seatBeaconOpenedAt','customerLocatedAt','placedAt','acceptedAt','preparingAt','readyAt','assignedAt','deliveringAt','deliveredAt','assignmentQueuedAt'
  ], (data.orders || []).map(function(x) {
    const customer = x.customer || {};
    const location = x.location || {};
    return [x.id,x.eventId,x.runnerId || '',x.status,x.fulfillmentMethod || 'delivery',customer.name || '',location.venueId || '',location.zoneId || '',location.vertical || '',location.horizontal || '',location.notes || '',JSON.stringify(x.items || []),number_(x.subtotal),number_(x.tax),number_(x.deliveryFee),number_(x.total),x.paymentMethod || '',nullableNumber_(x.cashTotal),nullableNumber_(x.estimatedCardFee),nullableNumber_(x.cardTotal),x.paymentCollectedAt || '',x.seatBeaconRequestedAt || '',x.seatBeaconOpenedAt || '',x.customerLocatedAt || '',x.placedAt || '',x.acceptedAt || '',x.preparingAt || '',x.readyAt || '',x.assignedAt || '',x.deliveringAt || '',x.deliveredAt || '',x.assignmentQueuedAt || ''];
  }));

  writeTable_(ss, 'Customer Feedback', ['id','orderId','eventId','rating','comments','submittedAt'], (data.feedback || []).map(function(x) {
    return [x.id,x.orderId,x.eventId,nullableNumber_(x.rating),x.comments || '',x.submittedAt || ''];
  }));

  writeTable_(ss, 'Archived Orders', ['id','eventId','runnerId','status','fulfillmentMethod','customerName','venueId','zoneId','itemsJson','total','paymentMethod','placedAt','deliveredAt'], (data.archivedOrders || []).map(function(x) { var c=x.customer||{}, l=x.location||{}; return [x.id,x.eventId,x.runnerId||'',x.status,x.fulfillmentMethod||'delivery',c.name||'',l.venueId||'',l.zoneId||'',JSON.stringify(x.items||[]),number_(x.total),x.paymentMethod||'',x.placedAt||'',x.deliveredAt||'']; }));
  writeTable_(ss, 'Archived Feedback', ['id','orderId','eventId','rating','comments','submittedAt'], (data.archivedFeedback || []).map(function(x) { return [x.id,x.orderId,x.eventId,nullableNumber_(x.rating),x.comments||'',x.submittedAt||'']; }));

  const ce = data.customerExperience || {};
  writeTable_(ss, 'Workspace Settings', ['key','value'], [
    ['headline', ce.headline || ''],
    ['message', ce.message || ''],
    ['schoolMessage', ce.schoolMessage || ''],
    ['ratingPrompt', ce.ratingPrompt || ''],
    ['commentsPrompt', ce.commentsPrompt || ''],
    ['supportTitle', ce.supportTitle || ''],
    ['finishLabel', ce.finishLabel || ''],
    ['showRating', boolean_(ce.showRating)],
    ['showComments', boolean_(ce.showComments)],
    ['mascotSymbol', ce.mascotSymbol || ''],
    ['primaryColor', ce.primaryColor || ''],
    ['secondaryColor', ce.secondaryColor || ''],
    ['deliveryFee', number_(ce.deliveryFee)],
    ['taxRatePercent', number_(ce.taxRatePercent)],
    ['estimatedCardFeePercent', number_(ce.estimatedCardFeePercent)],
    ['estimatedCardFeeFixed', number_(ce.estimatedCardFeeFixed)],
    ['cashPaymentsEnabled', boolean_(ce.cashPaymentsEnabled)],
    ['cardPaymentsEnabled', boolean_(ce.cardPaymentsEnabled)],
    ['pickupEnabled', boolean_(ce.pickupEnabled)],
    ['pickupLocationName', ce.pickupLocationName || ''],
    ['pickupInstructions', ce.pickupInstructions || ''],
    ['staffAdminPinHash', (data.staffAccess && data.staffAccess.adminPinHash) || ''],
    ['staffKitchenPinHash', (data.staffAccess && data.staffAccess.kitchenPinHash) || ''],
    ['staffRunnerPinHash', (data.staffAccess && data.staffAccess.runnerPinHash) || '']
  ]);

  writeTable_(ss, 'Community Support', ['id','label','url','icon','enabled','displayOrder'], (ce.supportLinks || []).map(function(x, index) {
    return [x.id,x.label,x.url,x.icon || '',boolean_(x.enabled),index];
  }));

  writeTable_(ss, 'Activity', ['id','message','occurredAt','tone'], (data.activity || []).map(function(x) {
    return [x.id,x.message,x.occurredAt,x.tone];
  }));
}

function readStructuredData_(ss) {
  // The Events tab is the minimum marker that structured sync has been written.
  const eventSheet = ss.getSheetByName('Events');
  if (!eventSheet || eventSheet.getLastRow() < 1) throw new Error('Structured SeatServe tabs have not been synchronized yet.');

  const events = rowsAsObjects_(ss, 'Events').filter(hasId_).map(function(x) { return {
    id:string_(x.id), name:string_(x.name), opponent:string_(x.opponent), venueId:string_(x.venueId), menuId:optionalString_(x.menuId), startsAt:string_(x.startsAt), orderingOpensAt:string_(x.orderingOpensAt), orderingClosesAt:string_(x.orderingClosesAt), status:string_(x.status), orderingEnabled:bool_(x.orderingEnabled)
  }; });

  const zoneRows = rowsAsObjects_(ss, 'Zones').filter(hasId_);
  const sectionRows = rowsAsObjects_(ss, 'Venue Sections').filter(hasId_);
  const venues = rowsAsObjects_(ss, 'Venues').filter(hasId_).map(function(v) {
    const venueId = string_(v.id);
    const venueZones = zoneRows.filter(function(z) { return string_(z.venueId) === venueId; }).map(function(z) {
      const zoneId = string_(z.id);
      return {
        id:zoneId, name:string_(z.name), description:string_(z.description), deliveryEnabled:bool_(z.deliveryEnabled), active:bool_(z.active),
        sections: sectionRows.filter(function(s) { return string_(s.venueId) === venueId && string_(s.zoneId) === zoneId; }).map(function(s) { return { id:string_(s.id), name:string_(s.name), seatRange:string_(s.seatRange), active:bool_(s.active) }; }),
        baselineRoundTripMinutes:optionalNumber_(z.baselineRoundTripMinutes), learnedRoundTripMinutes:optionalNumber_(z.learnedRoundTripMinutes), completedTripCount:optionalNumber_(z.completedTripCount)
      };
    });
    return { id:venueId, name:string_(v.name), type:string_(v.type), address:string_(v.address), active:bool_(v.active), zones:venueZones };
  });

  const menuCategories = rowsAsObjects_(ss, 'Menu Categories').filter(hasId_).map(function(x) { return {
    id:string_(x.id), name:string_(x.name), emoji:string_(x.emoji), imageUrl:optionalString_(x.imageUrl), visible:bool_(x.visible), sortOrder:number_(x.sortOrder)
  }; }).sort(function(a,b) { return a.sortOrder - b.sortOrder; });

  const menuItems = rowsAsObjects_(ss, 'Menu Items').filter(hasId_).map(function(x) { return {
    id:string_(x.id), name:string_(x.name), category:string_(x.category), categoryId:optionalString_(x.categoryId), description:string_(x.description), price:number_(x.price), available:bool_(x.available), kind:string_(x.kind) || 'standard', inventory:undefined, condiments:splitList_(x.condiments), emoji:string_(x.emoji), imageUrl:optionalString_(x.imageUrl), imageAlt:optionalString_(x.imageAlt), displayStyle:string_(x.displayStyle) || 'emoji', __displayOrder:number_(x.displayOrder)
  }; }).sort(function(a,b) { return a.__displayOrder - b.__displayOrder; }).map(function(x) { delete x.__displayOrder; return x; });

  const menus = rowsAsObjects_(ss, 'Menus').filter(hasId_).map(function(x) { return {
    id:string_(x.id), name:string_(x.name), description:string_(x.description), active:bool_(x.active), itemIds:splitList_(x.itemIds), priceOverrides:parseJson_(x.priceOverridesJson, {}), hiddenItemIds:splitList_(x.hiddenItemIds)
  }; });

  const runners = rowsAsObjects_(ss, 'Runners').filter(hasId_).map(function(x) { return {
    id:string_(x.id), name:string_(x.name), email:string_(x.email), phone:string_(x.phone), role:string_(x.role) || 'runner', status:string_(x.status) || 'offline', active:bool_(x.active), venueId:string_(x.venueId), zoneIds:splitList_(x.zoneIds), shiftStart:string_(x.shiftStart), shiftEnd:string_(x.shiftEnd), completedDeliveries:number_(x.completedDeliveries), rating:number_(x.rating), activeOrderId:optionalString_(x.activeOrderId), availableSince:optionalString_(x.availableSince), assignedAt:optionalString_(x.assignedAt), estimatedAvailableAt:optionalString_(x.estimatedAvailableAt)
  }; });

  const orders = rowsAsObjects_(ss, 'Orders').filter(hasId_).map(function(x) { return {
    id:string_(x.id), eventId:string_(x.eventId), runnerId:optionalString_(x.runnerId), fulfillmentMethod:string_(x.fulfillmentMethod) || 'delivery', items:parseJson_(x.itemsJson, []), customer:{ name:string_(x.customerName) }, location:{ venueId:string_(x.venueId), zoneId:string_(x.zoneId), vertical:string_(x.vertical), horizontal:string_(x.horizontal), notes:optionalString_(x.locationNotes) }, subtotal:number_(x.subtotal), tax:number_(x.tax), total:number_(x.total), deliveryFee:number_(x.deliveryFee), paymentMethod:optionalString_(x.paymentMethod), cashTotal:optionalNumber_(x.cashTotal), estimatedCardFee:optionalNumber_(x.estimatedCardFee), cardTotal:optionalNumber_(x.cardTotal), paymentCollectedAt:optionalString_(x.paymentCollectedAt), seatBeaconRequestedAt:optionalString_(x.seatBeaconRequestedAt), seatBeaconOpenedAt:optionalString_(x.seatBeaconOpenedAt), customerLocatedAt:optionalString_(x.customerLocatedAt), status:string_(x.status), placedAt:string_(x.placedAt), acceptedAt:optionalString_(x.acceptedAt), preparingAt:optionalString_(x.preparingAt), readyAt:optionalString_(x.readyAt), assignedAt:optionalString_(x.assignedAt), deliveringAt:optionalString_(x.deliveringAt), deliveredAt:optionalString_(x.deliveredAt), assignmentQueuedAt:optionalString_(x.assignmentQueuedAt)
  }; });

  const feedback = rowsAsObjects_(ss, 'Customer Feedback').filter(hasId_).map(function(x) { return { id:string_(x.id), orderId:string_(x.orderId), eventId:string_(x.eventId), rating:optionalNumber_(x.rating), comments:optionalString_(x.comments), submittedAt:string_(x.submittedAt) }; });
  const activity = rowsAsObjects_(ss, 'Activity').filter(hasId_).map(function(x) { return { id:string_(x.id), message:string_(x.message), occurredAt:string_(x.occurredAt), tone:string_(x.tone) || 'info' }; });

  const settings = keyValueMap_(rowsAsObjects_(ss, 'Workspace Settings'));
  const supportLinks = rowsAsObjects_(ss, 'Community Support').filter(hasId_).map(function(x) { return { id:string_(x.id), label:string_(x.label), url:string_(x.url), icon:string_(x.icon), enabled:bool_(x.enabled), __displayOrder:number_(x.displayOrder) }; }).sort(function(a,b) { return a.__displayOrder - b.__displayOrder; }).map(function(x) { delete x.__displayOrder; return x; });

  const customerExperience = {
    headline:string_(settings.headline), message:string_(settings.message), schoolMessage:string_(settings.schoolMessage), ratingPrompt:string_(settings.ratingPrompt), commentsPrompt:string_(settings.commentsPrompt), supportTitle:string_(settings.supportTitle), finishLabel:string_(settings.finishLabel), showRating:bool_(settings.showRating), showComments:bool_(settings.showComments), mascotSymbol:string_(settings.mascotSymbol), primaryColor:string_(settings.primaryColor), secondaryColor:string_(settings.secondaryColor), supportLinks:supportLinks, deliveryFee:number_(settings.deliveryFee), taxRatePercent:number_(settings.taxRatePercent), estimatedCardFeePercent:number_(settings.estimatedCardFeePercent), estimatedCardFeeFixed:number_(settings.estimatedCardFeeFixed), cashPaymentsEnabled:bool_(settings.cashPaymentsEnabled), cardPaymentsEnabled:bool_(settings.cardPaymentsEnabled), pickupEnabled:bool_(settings.pickupEnabled), pickupLocationName:string_(settings.pickupLocationName), pickupInstructions:string_(settings.pickupInstructions)
  };

  const staffAccess = { adminPinHash:optionalString_(settings.staffAdminPinHash), kitchenPinHash:optionalString_(settings.staffKitchenPinHash), runnerPinHash:optionalString_(settings.staffRunnerPinHash) };
  const archivedOrders = rowsAsObjects_(ss, 'Archived Orders').filter(hasId_).map(function(x) { return { id:string_(x.id), eventId:string_(x.eventId), runnerId:optionalString_(x.runnerId), fulfillmentMethod:string_(x.fulfillmentMethod)||'delivery', items:parseJson_(x.itemsJson,[]), customer:{name:string_(x.customerName)}, location:{venueId:string_(x.venueId),zoneId:string_(x.zoneId),vertical:'middle',horizontal:'center'}, subtotal:number_(x.total),tax:0,deliveryFee:0,total:number_(x.total),paymentMethod:optionalString_(x.paymentMethod),status:string_(x.status),placedAt:string_(x.placedAt),deliveredAt:optionalString_(x.deliveredAt) }; });
  const archivedFeedback = rowsAsObjects_(ss, 'Archived Feedback').filter(hasId_).map(function(x) { return { id:string_(x.id),orderId:string_(x.orderId),eventId:string_(x.eventId),rating:optionalNumber_(x.rating),comments:optionalString_(x.comments),submittedAt:string_(x.submittedAt) }; });

  return { archivedOrders:archivedOrders, archivedFeedback:archivedFeedback, events:events, venues:venues, runners:runners, menuCategories:menuCategories, menuItems:menuItems, menus:menus, orders:orders, activity:activity, customerExperience:customerExperience, staffAccess:staffAccess, feedback:feedback };
}

// When a user manually edits one of the structured tabs, mark the remote data as newer.
// This lets SeatServe's existing conflict protection prevent silent overwrites.
function onEdit(e) {
  try {
    if (!e || !e.range || !e.source) return;
    const sheetName = e.range.getSheet().getName();
    if (STRUCTURED_SHEETS.indexOf(sheetName) < 0) return;
    const metaSheet = getOrCreate_(e.source, META_SHEET, ['key', 'value']);
    const now = new Date().toISOString();
    setMeta_(metaSheet, 'updatedAt', now);
    setMeta_(metaSheet, 'lastWriteSource', 'Google Sheet edit: ' + sheetName);
  } catch (error) {
    // Never block a spreadsheet edit because metadata bookkeeping failed.
  }
}

function sanitizeForSheets_(data) {
  const clone = JSON.parse(JSON.stringify(data || {}));
  (clone.orders || []).forEach(function(order) { if (order.customer) delete order.customer.mobile; });
  (clone.archivedOrders || []).forEach(function(order) { if (order.customer) delete order.customer.mobile; });
  return clone;
}
function contactKey_(orderId) { return 'SEATSERVE_ACTIVE_CONTACT_' + String(orderId || ''); }
function storeActiveContacts_(orders) {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  orders.forEach(function(order) {
    if (!order || !order.id) return;
    const active = order.status !== 'delivered' && order.status !== 'cancelled';
    const mobile = order.customer && order.customer.mobile ? String(order.customer.mobile).trim() : '';
    if (active && mobile) props.setProperty(contactKey_(order.id), JSON.stringify({ mobile: mobile, expiresAt: now + 24 * 60 * 60 * 1000 }));
    if (!active) props.deleteProperty(contactKey_(order.id));
  });
}
function restoreActiveContacts_(data) {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  (data.orders || []).forEach(function(order) {
    if (!order || !order.id || order.status === 'delivered' || order.status === 'cancelled') return;
    const raw = props.getProperty(contactKey_(order.id)); if (!raw) return;
    try { const item = JSON.parse(raw); if (item.expiresAt && item.expiresAt < now) { props.deleteProperty(contactKey_(order.id)); return; } order.customer = order.customer || {}; order.customer.mobile = item.mobile; } catch (e) { props.deleteProperty(contactKey_(order.id)); }
  });
  return data;
}

function getSpreadsheet_() {
  if (!SEATSERVE_SPREADSHEET_ID) throw new Error('SEATSERVE_SPREADSHEET_ID is not configured in Code.gs.');
  return SpreadsheetApp.openById(SEATSERVE_SPREADSHEET_ID);
}

function getOrCreate_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0 && headers && headers.length) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function writeTable_(ss, name, headers, rows) {
  const sheet = getOrCreate_(ss, name, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows && rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function replaceRows_(sheet, rows) {
  const width = Math.max(2, sheet.getLastColumn() || 2);
  if (sheet.getMaxRows() > 1) sheet.getRange(2, 1, sheet.getMaxRows() - 1, width).clearContent();
  if (rows && rows.length) sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function rowsAsObjects_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(x) { return String(x); });
  return values.slice(1).filter(function(row) { return row.some(function(cell) { return cell !== '' && cell !== null; }); }).map(function(row) {
    const object = {};
    headers.forEach(function(header, index) { object[header] = row[index]; });
    return object;
  });
}

function keyValueMap_(rows) {
  const result = {};
  rows.forEach(function(row) { if (row.key !== undefined && row.key !== '') result[String(row.key)] = row.value; });
  return result;
}

function hasId_(row) { return row && row.id !== undefined && row.id !== null && String(row.id).trim() !== ''; }
function string_(value) { return value === undefined || value === null ? '' : String(value); }
function optionalString_(value) { const text = string_(value).trim(); return text ? text : undefined; }
function number_(value) { const numeric = Number(value); return isFinite(numeric) ? numeric : 0; }
function nullableNumber_(value) { return value === undefined || value === null || value === '' ? '' : number_(value); }
function optionalNumber_(value) { return value === undefined || value === null || value === '' ? undefined : number_(value); }
function boolean_(value) { return value === true; }
function bool_(value) {
  if (typeof value === 'boolean') return value;
  const text = string_(value).toLowerCase().trim();
  return text === 'true' || text === 'yes' || text === '1' || text === 'y';
}
function splitList_(value) { return string_(value).split(',').map(function(x) { return x.trim(); }).filter(function(x) { return x; }); }
function parseJson_(value, fallback) { try { return value === undefined || value === null || value === '' ? fallback : JSON.parse(String(value)); } catch (error) { return fallback; } }

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

function errorMessage_(error) { return String(error && error.message ? error.message : error); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
