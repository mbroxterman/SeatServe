const SEATSERVE_SPREADSHEET_ID = '146i2shTLFn8PPAPbdZocCGYc4j-8tH_SY3T-T1AStJE';

const DATA_SHEET = 'SeatServe Data';
const META_SHEET = 'SeatServe Meta';
const ASSET_SHEET = 'SeatServe Assets';
const SNAPSHOT_CHUNK_SIZE = 40000;
const CELL_CHUNK_SIZE = 40000;
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
  'Archived Feedback',
  'SeatServe Assets'
];

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'load';
    if (action === 'status') return status_(e && e.parameter ? e.parameter.workspace : '');
    if (action === 'load') return load_();
    if (action === 'live') return live_();
    if (action === 'order') return order_(e && e.parameter ? e.parameter.orderId : '');
    return json_({ ok: false, message: 'Unsupported action.' });
  } catch (error) {
    return json_({ ok: false, message: errorMessage_(error) });
  }
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (request.action === 'save') return save_(request);
    if (request.action === 'liveSave') return liveSave_(request);
    if (request.action === 'assignRunner') return assignRunner_(request);
    if (request.action === 'autoAssignRunner') return autoAssignRunner_(request);
    if (request.action === 'runnerStatus') return runnerStatus_(request);
    if (request.action === 'seatBeacon') return seatBeacon_(request);
    return json_({ ok: false, message: 'Unsupported action.' });
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
    schemaVersion: 16
  });
}

function live_() {
  const ss = getSpreadsheet_();
  const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
  const data = restoreActiveContacts_(readStructuredData_(ss));
  return json_({
    ok: true,
    live: {
      events: data.events || [],
      orders: data.orders || [],
      runners: data.runners || [],
      feedback: data.feedback || []
    },
    updatedAt: getMeta_(metaSheet, 'updatedAt') || '',
    workspaceName: getMeta_(metaSheet, 'workspaceName') || ss.getName(),
    schemaVersion: 16
  });
}

function order_(orderId) {
  if (!orderId) return json_({ ok: false, message: 'Order ID is required.', schemaVersion: 16 });
  const ss = getSpreadsheet_();
  const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
  const data = restoreActiveContacts_(readStructuredData_(ss));
  const order = (data.orders || []).find(function(item) { return item.id === orderId; });
  return json_({
    ok: true,
    order: order || null,
    updatedAt: getMeta_(metaSheet, 'updatedAt') || '',
    workspaceName: getMeta_(metaSheet, 'workspaceName') || ss.getName(),
    schemaVersion: 16
  });
}

function assignRunner_(request) {
  const orderId = String(request.orderId || '');
  const runnerId = String(request.runnerId || '');
  if (!orderId) return json_({ ok:false, message:'Order ID is required.', schemaVersion:16 });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const metaSheet = getOrCreate_(ss, META_SHEET, ['key','value']);
    const current = restoreActiveContacts_(readStructuredData_(ss));
    const order = (current.orders || []).find(function(item) { return item.id === orderId; });
    if (!order) return json_({ ok:false, message:'Order was not found.', schemaVersion:16 });
    if (order.fulfillmentMethod === 'pickup') return json_({ ok:false, message:'Pickup orders do not use runners.', schemaVersion:16 });
    if (['delivered','cancelled'].indexOf(order.status) >= 0) return json_({ ok:false, message:'Completed orders cannot be reassigned.', schemaVersion:16 });
    const now = new Date().toISOString();
    const previousRunnerId = order.runnerId || '';
    if (runnerId) {
      const runner = (current.runners || []).find(function(item) { return item.id === runnerId; });
      if (!runner || !runner.active) return json_({ ok:false, message:'Selected runner is not active.', schemaVersion:16 });
      const runnerIsCurrent = previousRunnerId === runnerId;
      if (!runnerIsCurrent && (runner.status !== 'available' || runner.activeOrderId)) return json_({ ok:false, message:'Selected runner is not available.', schemaVersion:16 });
      order.runnerId = runnerId;
      if (order.status === 'ready') order.status = 'assigned';
      order.assignedAt = now;
      order.assignmentQueuedAt = '';
      (current.runners || []).forEach(function(item) {
        if (item.id === previousRunnerId && item.id !== runnerId) { item.status='available'; item.activeOrderId=''; item.assignedAt=''; item.estimatedAvailableAt=''; item.availableSince=now; }
        if (item.id === runnerId) { item.status='assigned'; item.activeOrderId=orderId; item.assignedAt=now; item.availableSince=''; }
      });
    } else {
      order.runnerId = '';
      if (order.status === 'assigned') order.status = 'ready';
      order.assignedAt = '';
      (current.runners || []).forEach(function(item) {
        if (item.id === previousRunnerId) { item.status='available'; item.activeOrderId=''; item.assignedAt=''; item.estimatedAvailableAt=''; item.availableSince=now; }
      });
    }
    storeActiveContacts_(current.orders || []);
    const data = sanitizeForSheets_(current);
    writeStructuredData_(ss, data);
    setMeta_(metaSheet, 'updatedAt', now);
    setMeta_(metaSheet, 'schemaVersion', '16');
    setMeta_(metaSheet, 'lastWriteSource', 'SeatServe atomic runner assignment');
    SpreadsheetApp.flush();
    return json_({ ok:true, updatedAt:now, workspaceName:getMeta_(metaSheet,'workspaceName') || ss.getName(), structuredSync:true, schemaVersion:16 });
  } finally {
    lock.releaseLock();
  }
}

function autoAssignRunner_(request) {
  const orderId = String(request.orderId || '');
  if (!orderId) return json_({ ok:false, message:'Order ID is required.', schemaVersion:16 });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const metaSheet = getOrCreate_(ss, META_SHEET, ['key','value']);
    const current = restoreActiveContacts_(readStructuredData_(ss));
    const order = (current.orders || []).find(function(item) { return item.id === orderId; });
    if (!order) return json_({ ok:false, message:'Order was not found.', schemaVersion:16 });
    if (order.fulfillmentMethod === 'pickup') return json_({ ok:false, message:'Pickup orders do not use runners.', schemaVersion:16 });
    if (['delivered','cancelled'].indexOf(order.status) >= 0) return json_({ ok:false, message:'Completed orders cannot be assigned.', schemaVersion:16 });
    if (order.runnerId) {
      const existing = (current.runners || []).find(function(r) { return r.id === order.runnerId; });
      return json_({ ok:true, runnerId:order.runnerId, runnerName:existing ? existing.name : '', message:'Order is already assigned.', updatedAt:getMeta_(metaSheet,'updatedAt') || '', schemaVersion:16 });
    }
    const active = (current.runners || []).filter(function(r) { return r.active; });
    const available = active.filter(function(r) { return r.status === 'available' && !r.activeOrderId; });
    available.sort(function(a,b) {
      const at = a.availableSince ? new Date(a.availableSince).getTime() : 0;
      const bt = b.availableSince ? new Date(b.availableSince).getTime() : 0;
      if (at !== bt) return at - bt;
      return Number(a.completedDeliveries || 0) - Number(b.completedDeliveries || 0);
    });
    if (!available.length) {
      const busy = active.filter(function(r) { return r.status !== 'available' || r.activeOrderId; }).length;
      return json_({ ok:false, message: active.length ? (active.length + ' active runner(s) found, but ' + busy + ' are currently unavailable or assigned.') : 'No active runners are configured.', activeRunnerCount:active.length, availableRunnerCount:0, schemaVersion:16 });
    }
    const runner = available[0];
    const now = new Date().toISOString();
    order.runnerId = runner.id;
    if (order.status === 'ready') order.status = 'assigned';
    order.assignedAt = now;
    order.assignmentQueuedAt = '';
    runner.status = 'assigned';
    runner.activeOrderId = orderId;
    runner.assignedAt = now;
    runner.availableSince = '';
    storeActiveContacts_(current.orders || []);
    const data = sanitizeForSheets_(current);
    writeStructuredData_(ss, data);
    setMeta_(metaSheet, 'updatedAt', now);
    setMeta_(metaSheet, 'schemaVersion', '16');
    setMeta_(metaSheet, 'lastWriteSource', 'SeatServe server auto assignment');
    SpreadsheetApp.flush();
    return json_({ ok:true, runnerId:runner.id, runnerName:runner.name || '', message:'Runner ' + (runner.name || '') + ' assigned successfully.', updatedAt:now, workspaceName:getMeta_(metaSheet,'workspaceName') || ss.getName(), structuredSync:true, schemaVersion:16, activeRunnerCount:active.length, availableRunnerCount:available.length });
  } finally {
    lock.releaseLock();
  }
}


function runnerStatus_(request) {
  const runnerId = String(request.runnerId || '');
  const status = String(request.status || '');
  const clearAssignment = request.clearAssignment === true;
  if (!runnerId || ['available','offline'].indexOf(status) < 0) return json_({ ok:false, message:'Valid runner ID and status are required.', schemaVersion:16 });
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ss=getSpreadsheet_(), metaSheet=getOrCreate_(ss,META_SHEET,['key','value']), current=restoreActiveContacts_(readStructuredData_(ss));
    const runner=(current.runners||[]).find(function(r){return r.id===runnerId;});
    if (!runner) return json_({ok:false,message:'Runner was not found.',schemaVersion:16});
    const activeOrder=(current.orders||[]).find(function(o){return o.id===runner.activeOrderId && ['assigned','delivering'].indexOf(o.status)>=0;});
    if (runner.activeOrderId && activeOrder && !clearAssignment) return json_({ok:false,message:'Runner is controlled by active order '+activeOrder.id+'.',schemaVersion:16});
    if (clearAssignment && activeOrder) return json_({ok:false,message:'Cannot clear assignment while '+activeOrder.id+' is still active.',schemaVersion:16});
    const now=new Date().toISOString();
    runner.status=status; runner.activeOrderId=''; runner.assignedAt=''; runner.estimatedAvailableAt=''; runner.availableSince=status==='available'?now:'';
    const data=sanitizeForSheets_(current); writeStructuredData_(ss,data); setMeta_(metaSheet,'updatedAt',now); setMeta_(metaSheet,'schemaVersion','16'); setMeta_(metaSheet,'lastWriteSource','SeatServe atomic runner status'); SpreadsheetApp.flush();
    return json_({ok:true,message:clearAssignment?'Stale assignment cleared and runner made available.':'Runner status updated.',updatedAt:now,schemaVersion:16});
  } finally { lock.releaseLock(); }
}

function seatBeacon_(request) {
  const orderId=String(request.orderId||''), action=String(request.beaconAction||'');
  if (!orderId || ['request','opened','located'].indexOf(action)<0) return json_({ok:false,message:'Valid order and SeatBeacon action are required.',schemaVersion:16});
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ss=getSpreadsheet_(), metaSheet=getOrCreate_(ss,META_SHEET,['key','value']), current=restoreActiveContacts_(readStructuredData_(ss));
    const order=(current.orders||[]).find(function(o){return o.id===orderId;});
    if (!order) return json_({ok:false,message:'Order was not found.',schemaVersion:16});
    if (order.status==='delivered' || order.status==='cancelled') return json_({ok:false,message:'SeatBeacon is closed for completed orders.',schemaVersion:16});
    if (order.status!=='delivering') return json_({ok:false,message:'SeatBeacon is available only while out for delivery.',schemaVersion:16});
    const now=new Date().toISOString();
    if (action==='request') order.seatBeaconRequestedAt=now;
    if (action==='opened') order.seatBeaconOpenedAt=order.seatBeaconOpenedAt||now;
    if (action==='located') order.customerLocatedAt=order.customerLocatedAt||now;
    storeActiveContacts_(current.orders||[]); const data=sanitizeForSheets_(current); writeStructuredData_(ss,data); setMeta_(metaSheet,'updatedAt',now); setMeta_(metaSheet,'schemaVersion','16'); setMeta_(metaSheet,'lastWriteSource','SeatServe atomic SeatBeacon'); SpreadsheetApp.flush();
    return json_({ok:true,message:'SeatBeacon updated.',updatedAt:now,schemaVersion:16});
  } finally { lock.releaseLock(); }
}

function liveSave_(request) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const metaSheet = getOrCreate_(ss, META_SHEET, ['key', 'value']);
    const current = restoreActiveContacts_(readStructuredData_(ss));
    const incoming = request.live || {};
    const rank = { 'new':0, 'preparing':1, 'ready':2, 'assigned':3, 'delivering':4, 'delivered':5, 'cancelled':99 };
    const remoteById = {};
    (current.orders || []).forEach(function(o) { remoteById[o.id] = o; });
    (incoming.orders || []).forEach(function(next) {
      if (!next || !next.id) return;
      const prev = remoteById[next.id];
      if (!prev) { remoteById[next.id] = next; return; }
      const prevRank = rank[prev.status] == null ? 0 : rank[prev.status];
      const nextRank = rank[next.status] == null ? 0 : rank[next.status];
      if (prev.status === 'cancelled' || prev.status === 'delivered') {
        remoteById[next.id] = Object.assign({}, next, prev, { status: prev.status });
      } else if (nextRank < prevRank && next.status !== 'cancelled') {
        remoteById[next.id] = Object.assign({}, next, prev, { status: prev.status });
      } else {
        remoteById[next.id] = Object.assign({}, prev, next);
      }
    });
    current.orders = Object.keys(remoteById).map(function(id) { return remoteById[id]; });

    const runnerById = {};
    (current.runners || []).forEach(function(r) { runnerById[r.id] = r; });
    (incoming.runners || []).forEach(function(r) { if (r && r.id) runnerById[r.id] = Object.assign({}, runnerById[r.id] || {}, r); });
    current.runners = Object.keys(runnerById).map(function(id) { return runnerById[id]; });
    if (incoming.events) current.events = incoming.events;
    if (incoming.feedback) current.feedback = incoming.feedback;

    storeActiveContacts_(current.orders || []);
    const data = sanitizeForSheets_(current);
    writeStructuredData_(ss, data);
    const updatedAt = new Date().toISOString();
    setMeta_(metaSheet, 'updatedAt', updatedAt);
    setMeta_(metaSheet, 'schemaVersion', '16');
    setMeta_(metaSheet, 'lastWriteSource', 'SeatServe atomic live sync');
    SpreadsheetApp.flush();
    return json_({ ok:true, updatedAt:updatedAt, workspaceName:getMeta_(metaSheet,'workspaceName') || ss.getName(), structuredSync:true, schemaVersion:16, menuItemCount:(data.menuItems || []).length });
  } finally {
    lock.releaseLock();
  }
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

  // Keep one lossless JSON snapshot for backup/backward compatibility. Google Sheets
  // limits a single cell to 50,000 characters, so the snapshot is stored in safe chunks.
  replaceRows_(dataSheet, buildSnapshotRows_(data, updatedAt, workspaceName));

  // Also write human-readable normalized tabs that may be edited directly.
  writeStructuredData_(ss, data);

  setMeta_(metaSheet, 'workspaceName', workspaceName);
  setMeta_(metaSheet, 'updatedAt', updatedAt);
  setMeta_(metaSheet, 'clientUpdatedAt', request.clientUpdatedAt || updatedAt);
  setMeta_(metaSheet, 'schemaVersion', '16');
  setMeta_(metaSheet, 'lastWriteSource', 'SeatServe app');
  SpreadsheetApp.flush();

  return json_({ ok: true, updatedAt: updatedAt, workspaceName: workspaceName, structuredSync: true, schemaVersion: 16, menuItemCount: (data.menuItems || []).length });
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
    const payload = readSnapshotPayload_(dataSheet);
    if (!payload) throw error;
    data = restoreActiveContacts_(JSON.parse(payload));
  }

  return json_({
    ok: true,
    data: data,
    updatedAt: getMeta_(metaSheet, 'updatedAt') || '',
    workspaceName: getMeta_(metaSheet, 'workspaceName') || ss.getName(),
    source: source,
    structuredSync: true,
    schemaVersion: 16
  });
}

function writeStructuredData_(ss, data) {
  const assetRows = [];
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

  writeTable_(ss, 'Menu Categories', ['id','name','imageUrl','visible','sortOrder'], (data.menuCategories || []).map(function(x) {
    return [x.id,x.name,storeLargeCell_(assetRows, 'menu-category:' + x.id + ':imageUrl', x.imageUrl || ''),boolean_(x.visible),number_(x.sortOrder)];
  }));

  writeTable_(ss, 'Menu Items', ['id','name','category','categoryId','description','price','available','kind','condiments','emoji','imageUrl','imageAlt','displayStyle','displayOrder'], (data.menuItems || []).map(function(x, index) {
    return [x.id,x.name,x.category || '',x.categoryId || '',x.description || '',number_(x.price),boolean_(x.available),x.kind || 'standard',(x.condiments || []).join(', '),x.emoji || '',storeLargeCell_(assetRows, 'menu-item:' + x.id + ':imageUrl', x.imageUrl || ''),x.imageAlt || '',x.displayStyle || 'emoji',index];
  }));

  writeTable_(ss, 'Menus', ['id','name','description','active','itemIds','priceOverridesJson','hiddenItemIds'], (data.menus || []).map(function(x) {
    return [x.id,x.name,x.description || '',boolean_(x.active),(x.itemIds || []).join(', '),JSON.stringify(x.priceOverrides || {}),(x.hiddenItemIds || []).join(', ')];
  }));

  writeTable_(ss, 'Runners', ['id','name','email','phone','role','status','active','venueId','zoneIds','completedDeliveries','rating','activeOrderId','availableSince','assignedAt','estimatedAvailableAt'], (data.runners || []).map(function(x) {
    return [x.id,x.name,x.email || '',x.phone || '',x.role,x.status,boolean_(x.active),x.venueId || '',(x.zoneIds || []).join(', '),number_(x.completedDeliveries),number_(x.rating),x.activeOrderId || '',x.availableSince || '',x.assignedAt || '',x.estimatedAvailableAt || ''];
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

  // Oversized values (primarily embedded menu images) are chunked here instead of
  // exceeding Google Sheets' 50,000-character per-cell limit.
  writeTable_(ss, ASSET_SHEET, ['key','chunkIndex','chunk'], assetRows);
}

function readStructuredData_(ss) {
  const assetMap = readAssetMap_(ss);
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
    id:string_(x.id), name:string_(x.name), imageUrl:optionalString_(restoreLargeCell_(assetMap, x.imageUrl)), visible:bool_(x.visible), sortOrder:number_(x.sortOrder)
  }; }).sort(function(a,b) { return a.sortOrder - b.sortOrder; });

  const menuItems = rowsAsObjects_(ss, 'Menu Items').filter(hasId_).map(function(x) { return {
    id:string_(x.id), name:string_(x.name), category:string_(x.category), categoryId:optionalString_(x.categoryId), description:string_(x.description), price:number_(x.price), available:bool_(x.available), kind:string_(x.kind) || 'standard', inventory:undefined, condiments:splitList_(x.condiments), emoji:string_(x.emoji), imageUrl:optionalString_(restoreLargeCell_(assetMap, x.imageUrl)), imageAlt:optionalString_(x.imageAlt), displayStyle:string_(x.displayStyle) || 'emoji', __displayOrder:number_(x.displayOrder)
  }; }).sort(function(a,b) { return a.__displayOrder - b.__displayOrder; }).map(function(x) { delete x.__displayOrder; return x; });

  const menus = rowsAsObjects_(ss, 'Menus').filter(hasId_).map(function(x) { return {
    id:string_(x.id), name:string_(x.name), description:string_(x.description), active:bool_(x.active), itemIds:splitList_(x.itemIds), priceOverrides:parseJson_(x.priceOverridesJson, {}), hiddenItemIds:splitList_(x.hiddenItemIds)
  }; });

  const runners = rowsAsObjects_(ss, 'Runners').filter(hasId_).map(function(x) { return {
    id:string_(x.id), name:string_(x.name), email:string_(x.email), phone:string_(x.phone), role:string_(x.role) || 'runner', status:string_(x.status) || 'offline', active:bool_(x.active), venueId:string_(x.venueId), zoneIds:splitList_(x.zoneIds), completedDeliveries:number_(x.completedDeliveries), rating:number_(x.rating), activeOrderId:optionalString_(x.activeOrderId), availableSince:optionalString_(x.availableSince), assignedAt:optionalString_(x.assignedAt), estimatedAvailableAt:optionalString_(x.estimatedAvailableAt)
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

function buildSnapshotRows_(data, updatedAt, workspaceName) {
  const payload = JSON.stringify(data);
  const rows = [];
  const chunkCount = Math.max(1, Math.ceil(payload.length / SNAPSHOT_CHUNK_SIZE));
  rows.push(['seatserveChunkCount', String(chunkCount)]);
  rows.push(['seatserveLength', String(payload.length)]);
  for (let i = 0; i < chunkCount; i += 1) {
    const key = 'seatserve.' + ('0000' + (i + 1)).slice(-4);
    rows.push([key, payload.slice(i * SNAPSHOT_CHUNK_SIZE, (i + 1) * SNAPSHOT_CHUNK_SIZE)]);
  }
  rows.push(['lastSyncAt', updatedAt]);
  rows.push(['lastSyncStatus', 'success']);
  rows.push(['lastSyncSource', 'SeatServe Netlify / app']);
  rows.push(['appVersion', 'v2.1.7E']);
  rows.push(['workspaceName', workspaceName]);
  return rows;
}

function readSnapshotPayload_(dataSheet) {
  const rows = dataSheet.getDataRange().getValues().slice(1);
  const countRow = rows.find(function(row) { return row[0] === 'seatserveChunkCount'; });
  const chunkCount = countRow ? Number(countRow[1]) : 0;
  if (chunkCount > 0) {
    const byKey = {};
    rows.forEach(function(row) { byKey[String(row[0])] = String(row[1] || ''); });
    let payload = '';
    for (let i = 0; i < chunkCount; i += 1) {
      const key = 'seatserve.' + ('0000' + (i + 1)).slice(-4);
      if (!(key in byKey)) throw new Error('SeatServe snapshot is incomplete. Missing chunk ' + (i + 1) + ' of ' + chunkCount + '.');
      payload += byKey[key];
    }
    return payload;
  }

  // Backward compatibility with pre-v2.1.6D single-cell snapshots.
  const legacy = rows.find(function(row) { return row[0] === 'seatserve'; });
  return legacy && legacy[1] ? String(legacy[1]) : '';
}

function storeLargeCell_(assetRows, key, value) {
  const text = value === undefined || value === null ? '' : String(value);
  if (text.length <= CELL_CHUNK_SIZE) return text;
  const chunkCount = Math.ceil(text.length / CELL_CHUNK_SIZE);
  for (let i = 0; i < chunkCount; i += 1) {
    assetRows.push([key, i + 1, text.slice(i * CELL_CHUNK_SIZE, (i + 1) * CELL_CHUNK_SIZE)]);
  }
  return '@seatserve-asset:' + key;
}

function readAssetMap_(ss) {
  const sheet = ss.getSheetByName(ASSET_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const values = sheet.getDataRange().getValues().slice(1);
  const grouped = {};
  values.forEach(function(row) {
    const key = String(row[0] || '');
    if (!key) return;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ index: Number(row[1]) || 0, chunk: String(row[2] || '') });
  });
  const result = {};
  Object.keys(grouped).forEach(function(key) {
    result[key] = grouped[key].sort(function(a, b) { return a.index - b.index; }).map(function(entry) { return entry.chunk; }).join('');
  });
  return result;
}

function restoreLargeCell_(assetMap, value) {
  const text = value === undefined || value === null ? '' : String(value);
  const prefix = '@seatserve-asset:';
  if (text.indexOf(prefix) !== 0) return text;
  const key = text.slice(prefix.length);
  return assetMap[key] || '';
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
