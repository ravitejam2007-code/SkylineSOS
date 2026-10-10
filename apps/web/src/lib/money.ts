/**
 * Formats integer paise into Indian Rupee currency format (e.g. 30000 -> ₹300.00)
 */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(rupees);
}

/**
 * Compact format without decimal fractions for whole amounts (e.g. 30000 -> ₹300)
 */
export function formatPaiseCompact(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(rupees);
}
