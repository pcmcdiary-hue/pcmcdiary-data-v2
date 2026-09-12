import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SHEET_ID = process.env.SPREADSHEET_ID;
const KEY = JSON.parse(process.env.GCP_SA_KEY);

const auth = new google.auth.GoogleAuth({
  credentials: KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Read a sheet range as array of objects
async function readSheet(sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1:AC`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = row[i] ? String(row[i]).trim() : '';
    });
    return obj;
  }).filter(r => r.businessId || r.categoryId || r.locationId);
}

// Write JSON file
function writeJSON(filename, data) {
  const dir = 'data';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(
    path.join(dir, filename),
    JSON.stringify(data, null, 2)
  );
  console.log(`✓ ${filename} — ${Array.isArray(data) ? data.length : 'obj'} items`);
}

async function main() {
  console.log('Starting sync...');

  // Categories & Locations
  const categories = await readSheet('categories');
  const locations = await readSheet('locations');
  writeJSON('categories.json', { categories });
  writeJSON('locations.json', { locations });

  // Category-wise business sheets
  for (const cat of categories) {
    const fileName = cat.file;
    const sheetName = fileName.replace('.json', '');
    try {
      const businesses = await readSheet(sheetName);
      writeJSON(fileName, businesses);
    } catch (err) {
      console.warn(`⚠ Skipped ${sheetName}: ${err.message}`);
    }
  }

  console.log('Sync complete.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
