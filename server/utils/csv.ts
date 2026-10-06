// CSV au format Excel FR (separateur ";", BOM UTF-8).
// Anti injection de formules : une cellule qui commence par = + - @ ou une
// tabulation serait executee par Excel/LibreOffice -> prefixee par une
// apostrophe (OWASP "CSV Injection").
const FORMULA_START = /^[=+\-@\t\r]/

function escapeCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: unknown[][]) {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(';'))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
