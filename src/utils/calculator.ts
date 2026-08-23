import { Tariff, BillBreakdown } from '../types';

/**
 * Calculate tiered water consumption breakdown based on village tariff rules
 */
export function calculateTieredBillBreakdown(
  usageM3: number,
  tariff: Tariff | Partial<Tariff> | null | undefined,
  includeLateFee: boolean = false,
  adminFee: number = 0
): BillBreakdown {
  const usage = Math.max(0, Number(usageM3 || 0));
  const baseFee = Number(tariff?.base_fee ?? 5000);
  const adminFeeVal = Math.max(0, Number(adminFee || 0));

  const tier1Max = Number(tariff?.tier1_max ?? 10);
  const tier1Rate = Number(tariff?.tier1_rate ?? 2000);

  const tier2Max = Number(tariff?.tier2_max ?? 20);
  const tier2Rate = Number(tariff?.tier2_rate ?? 3000);

  const tier3Rate = Number(tariff?.tier3_rate ?? 5000);
  const lateFeeVal = includeLateFee ? Number(tariff?.late_fee ?? 5000) : 0;

  let tier1Usage = 0;
  let tier2Usage = 0;
  let tier3Usage = 0;

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

  const tier1Amount = tier1Usage * tier1Rate;
  const tier2Amount = tier2Usage * tier2Rate;
  const tier3Amount = tier3Usage * tier3Rate;
  const usageAmount = tier1Amount + tier2Amount + tier3Amount;
  const totalAmount = baseFee + usageAmount + lateFeeVal + adminFeeVal;

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
    late_fee: lateFeeVal,
    admin_fee: adminFeeVal,
    total_amount: totalAmount
  };
}
