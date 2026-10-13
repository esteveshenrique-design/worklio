// worklio-local/src/quoteTotal.ts
var cents = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
var lineVat = (line, quote) => line.vat ?? quote.tax;
var lineNet = (line) => cents(line.qty * line.price);
var lineTax = (line, quote) => cents(lineNet(line) * lineVat(line, quote) / 100);
function quoteBreakdown(quote) {
  const rates = /* @__PURE__ */ new Map();
  let subtotal = 0, tax = 0;
  for (const line of quote.lines) {
    const base = lineNet(line), amount = lineTax(line, quote), rate = lineVat(line, quote);
    subtotal += base;
    tax += amount;
    const row = rates.get(rate) || { rate, base: 0, tax: 0 };
    row.base = cents(row.base + base);
    row.tax = cents(row.tax + amount);
    rates.set(rate, row);
  }
  return { subtotal: cents(subtotal), tax: cents(tax), total: cents(subtotal + tax), rates: [...rates.values()].sort((a, b) => a.rate - b.rate) };
}
var quoteTotal = (quote) => quoteBreakdown(quote).total;
function quoteSections(quote) {
  const groups = quote.groups || [];
  const sections = groups.map((group) => ({ ...group, lines: quote.lines.filter((line) => line.groupId === group.id) }));
  const ungrouped = quote.lines.filter((line) => !line.groupId || !groups.some((group) => group.id === line.groupId));
  if (ungrouped.length) sections.push({ id: "", name: "", lines: ungrouped });
  return sections;
}
export {
  lineNet,
  lineTax,
  lineVat,
  quoteBreakdown,
  quoteSections,
  quoteTotal
};
