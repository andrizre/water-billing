/**
 * Sandmosquito Water Billing - Google Apps Script Tariffs Module
 * Tiered tariff configuration and water calculation engine.
 */

function handleGetTariffs() {
  var tariffs = getAllRows('Tariffs');
  var formatted = tariffs.map(function(t) {
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      category: t.category || 'Rumah Tangga',
      base_fee: Number(t.base_fee || 0), // Biaya abodemen / beban tetap
      tier1_max: Number(t.tier1_max || 10), // e.g. 0 - 10 m3
      tier1_rate: Number(t.tier1_rate || 2000), // e.g. Rp 2.000 / m3
      tier2_max: Number(t.tier2_max || 20), // e.g. 11 - 20 m3
      tier2_rate: Number(t.tier2_rate || 3000), // e.g. Rp 3.000 / m3
      tier3_rate: Number(t.tier3_rate || 5000), // e.g. > 20 m3 -> Rp 5.000 / m3
      late_fee: Number(t.late_fee || 5000), // Denda keterlambatan flat
      is_active: t.is_active === true || t.is_active === 'TRUE' || t.is_active === 1 || t.is_active === '1',
      description: t.description || '',
      created_at: t.created_at
    };
  });

  return jsonResponse(formatted, 200, 'Daftar tarif berhasil dimuat.');
}

function handleCreateTariff(authUser, data) {
  var name = String(data.name || '').trim();
  var code = data.code ? String(data.code).trim().toUpperCase() : generateUniqueId('TRF');

  if (!name) {
    return errorResponse('Nama tarif wajib diisi.', 400);
  }

  var id = generateUniqueId('TRF_ID');
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm:ss');

  var newTariff = {
    id: id,
    code: code,
    name: name,
    category: data.category || 'Rumah Tangga',
    base_fee: Number(data.base_fee || 0),
    tier1_max: Number(data.tier1_max || 10),
    tier1_rate: Number(data.tier1_rate || 2000),
    tier2_max: Number(data.tier2_max || 20),
    tier2_rate: Number(data.tier2_rate || 3000),
    tier3_rate: Number(data.tier3_rate || 5000),
    late_fee: Number(data.late_fee || 5000),
    is_active: data.is_active !== undefined ? (data.is_active ? 'TRUE' : 'FALSE') : 'TRUE',
    description: data.description || '',
    created_at: nowStr
  };

  appendRow('Tariffs', newTariff);
  logAudit(authUser.userId, authUser.username, 'CREATE_TARIFF', 'Menambahkan tarif: ' + name + ' (' + code + ')');

  return jsonResponse(newTariff, 201, 'Tarif berhasil ditambahkan.');
}

function handleUpdateTariff(authUser, data) {
  var id = data.id;
  if (!id) return errorResponse('ID Tarif wajib diisi.', 400);

  var existing = getRowById('Tariffs', id);
  if (!existing) return errorResponse('Tarif tidak ditemukan.', 404);

  var updateObj = {
    name: data.name !== undefined ? data.name : existing.name,
    code: data.code !== undefined ? String(data.code).trim().toUpperCase() : existing.code,
    category: data.category !== undefined ? data.category : existing.category,
    base_fee: data.base_fee !== undefined ? Number(data.base_fee) : existing.base_fee,
    tier1_max: data.tier1_max !== undefined ? Number(data.tier1_max) : existing.tier1_max,
    tier1_rate: data.tier1_rate !== undefined ? Number(data.tier1_rate) : existing.tier1_rate,
    tier2_max: data.tier2_max !== undefined ? Number(data.tier2_max) : existing.tier2_max,
    tier2_rate: data.tier2_rate !== undefined ? Number(data.tier2_rate) : existing.tier2_rate,
    tier3_rate: data.tier3_rate !== undefined ? Number(data.tier3_rate) : existing.tier3_rate,
    late_fee: data.late_fee !== undefined ? Number(data.late_fee) : existing.late_fee,
    is_active: data.is_active !== undefined ? (data.is_active ? 'TRUE' : 'FALSE') : existing.is_active,
    description: data.description !== undefined ? data.description : existing.description
  };

  updateRowById('Tariffs', id, updateObj);
  logAudit(authUser.userId, authUser.username, 'UPDATE_TARIFF', 'Memperbarui tarif: ' + existing.name);

  return jsonResponse(null, 200, 'Data tarif berhasil diperbarui.');
}

/**
 * Calculation helper for tiered water usage
 * Returns exact breakdown per tier
 */
function calculateWaterBill(usageM3, tariff) {
  var usage = Math.max(0, Number(usageM3 || 0));
  var baseFee = Number(tariff.base_fee || 0);

  var tier1Max = Number(tariff.tier1_max || 10);
  var tier1Rate = Number(tariff.tier1_rate || 2000);

  var tier2Max = Number(tariff.tier2_max || 20);
  var tier2Rate = Number(tariff.tier2_rate || 3000);

  var tier3Rate = Number(tariff.tier3_rate || 5000);

  var tier1Usage = 0;
  var tier2Usage = 0;
  var tier3Usage = 0;

  if (usage <= tier1Max) {
    tier1Usage = usage;
    tier2Usage = 0;
    tier3Usage = 0;
  } else if (usage <= tier2Max) {
    tier1Usage = tier1Max;
    tier2Usage = usage - tier1Max;
    tier3Usage = 0;
  } else {
    tier1Usage = tier1Max;
    tier2Usage = tier2Max - tier1Max;
    tier3Usage = usage - tier2Max;
  }

  var tier1Amount = tier1Usage * tier1Rate;
  var tier2Amount = tier2Usage * tier2Rate;
  var tier3Amount = tier3Usage * tier3Rate;
  var usageAmount = tier1Amount + tier2Amount + tier3Amount;
  var totalAmount = baseFee + usageAmount;

  return {
    usage_m3: usage,
    base_fee: baseFee,
    tier1_usage: tier1Usage,
    tier1_rate: tier1Rate,
    tier1_amount: tier1Amount,
    tier2_usage: tier2Usage,
    tier2_rate: tier2Rate,
    tier2_amount: tier2Amount,
    tier3_usage: tier3Usage,
    tier3_rate: tier3Rate,
    tier3_amount: tier3Amount,
    usage_amount: usageAmount,
    late_fee: Number(tariff.late_fee || 0),
    total_amount: totalAmount
  };
}
