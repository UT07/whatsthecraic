const xlsx = require('xlsx');

const workbook = xlsx.readFile('DJs.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// No range, no custom header, read everything as array-of-arrays
const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

allRows.forEach((row, idx) => {
  console.log(`Row #${idx}:`, row);
});
