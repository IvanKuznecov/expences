import * as XLSX from 'xlsx';
import fs from 'fs';

const buf = fs.readFileSync('Expences.xlsx');
const workbook = XLSX.read(buf);

const s = workbook.Sheets['02.2024'];
const d = XLSX.utils.sheet_to_json(s, { header: 1 });

console.log("Header:", d[0]);
let startRow = -1;
// Start looking from row 2 (index 2) to skip header and maybe 1 calc row
for (let i = 1; i < d.length; i++) {
    // Check if Account Number is present (column 0)
    // and looks like a string starting with LV or similar?
    if (d[i][0] && typeof d[i][0] === 'string') {
        startRow = i;
        break;
    }
}

if (startRow !== -1) {
    console.log(`Found data starting at row ${startRow}`);
    d.slice(startRow, startRow + 5).forEach((r, i) => console.log(`Data Row ${i}:`, r));
} else {
    console.log("No data found.");
}
