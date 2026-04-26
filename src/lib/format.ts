export function formatPrice(minorUnits: number, currency: "GBP"): string {
  const major = minorUnits / 100;
  const symbol = currency === "GBP" ? "£" : "";
  if (Number.isInteger(major)) return `${symbol}${major.toLocaleString("en-GB")}`;
  return `${symbol}${major.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
