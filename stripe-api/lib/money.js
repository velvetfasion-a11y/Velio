/** Offer amount is SEK. The 10% service fee is included in that total. */

export function breakdownFromSek(amountSek) {
  const totalOre = Math.round(Number(amountSek) * 100);
  const feeOre = Math.round(totalOre * 0.1);
  const workOre = totalOre - feeOre;
  return { workOre, feeOre, totalOre };
}

export function workerShareOre(chargeOre) {
  return Math.round(Number(chargeOre) * 0.9);
}
