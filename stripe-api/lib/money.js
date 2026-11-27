/** Offer amount is what the worker is paid. The customer also pays a 10% VELIO fee on top. */

export function breakdownFromSek(amountSek) {
  const workOre = Math.round(Number(amountSek) * 100);
  const feeOre = Math.round(workOre * 0.1);
  const totalOre = workOre + feeOre;
  return { workOre, feeOre, totalOre };
}

export function workerShareOre(chargeOre) {
  return Math.round(Number(chargeOre) * 0.9);
}
