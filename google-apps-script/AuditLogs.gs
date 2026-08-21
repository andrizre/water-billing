/**
 * Sandmosquito Water Billing - Google Apps Script Audit Logs Module
 * Activity logs viewer for administrator oversight.
 */

function handleGetAuditLogs(params) {
  var logs = getAllRows('AuditLogs');
  var actionFilter = params.action || '';
  var search = String(params.search || '').toLowerCase();

  var filtered = logs.filter(function(l) {
    if (actionFilter && l.action !== actionFilter) return false;
    if (search) {
      var matchUser = String(l.username || '').toLowerCase().indexOf(search) !== -1;
      var matchAct = String(l.action || '').toLowerCase().indexOf(search) !== -1;
      var matchDet = String(l.details || '').toLowerCase().indexOf(search) !== -1;
      return matchUser || matchAct || matchDet;
    }
    return true;
  });

  // Sort descending by created_at
  filtered.sort(function(a, b) {
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  return jsonResponse(filtered.slice(0, 100), 200, 'Data log aktivitas berhasil dimuat.');
}
