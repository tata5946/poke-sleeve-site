const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const xlsxDir = args[0] || ".tmp_deckshield_db_xlsx";
const outPath = args[1] || "data.json";
const inspectOnly = args.includes("--inspect");

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function columnIndex(label) {
  let n = 0;
  for (const ch of label) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function excelSerialToIso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return "";
  const ms = Math.round((n - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function normalizeDate(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))) {
    const n = Number(value);
    if (n > 20000 && n < 80000) return excelSerialToIso(n);
  }
  const text = String(value).trim();
  const m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return text;
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!text || text === "-") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function cleanString(value) {
  return value == null ? "" : String(value).trim();
}

function cleanId(value) {
  const text = cleanString(value);
  if (!text) return "";
  const n = Number(text);
  if (Number.isFinite(n) && Number.isInteger(n)) return String(n);
  const decimal = text.match(/^(\d+)\.0$/);
  return decimal ? decimal[1] : text;
}

function loadSharedStrings(root) {
  const file = path.join(root, "xl", "sharedStrings.xml");
  if (!fs.existsSync(file)) return [];
  const xml = readText(file);
  const strings = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = "";
    for (const part of match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) {
      text += decodeXml(part[1]);
    }
    strings.push(text);
  }
  return strings;
}

function parseSheet(root, fileName, sharedStrings) {
  const xml = readText(path.join(root, "xl", "worksheets", fileName));
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      let value = "";
      const inline = body.match(/<is>([\s\S]*?)<\/is>/);
      if (inline) {
        for (const part of inline[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) value += decodeXml(part[1]);
      } else {
        value = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "";
        if (/t="s"/.test(attrs)) value = sharedStrings[Number(value)] || "";
      }
      row[columnIndex(ref)] = value;
    }
    rows[Number(rowMatch[1]) - 1] = row;
  }
  return rows.filter(Boolean);
}

function toObjects(rows) {
  const headers = (rows[0] || []).map((h) => cleanString(h));
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index] == null ? "" : row[index];
    });
    return obj;
  });
}

function nonEmptyRows(objects, key) {
  return objects.filter((row) => cleanString(row[key]));
}

function uniq(values) {
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function categoryBuckets(sleeve) {
  const categories = [];
  for (let i = 1; i <= 9; i++) {
    const value = cleanString(sleeve[`category${i}`]);
    if (value) categories.push(value);
  }
  return {
    pokemonCategories: uniq([sleeve.category1, sleeve.category2, sleeve.category3]),
    trainerCategories: uniq([sleeve.category4, sleeve.category5, sleeve.category6]),
    categoryTags: uniq([sleeve.category7, sleeve.category8, sleeve.category9]),
    categories: uniq(categories),
  };
}

function addPriceRows(target, rows, keyName) {
  const byId = new Map();
  for (const row of rows) {
    const id = cleanId(row.id || row.ID);
    if (!id || !target.has(id)) continue;
    if (!byId.has(id)) byId.set(id, []);
    const period = normalizeDate(row[keyName] || row.week || row.month || row.year);
    if (!period) continue;
    const price = numberOrNull(row.price);
    if (keyName !== "week" && price == null) continue;
    const count = numberOrNull(row.count);
    const out = keyName === "year"
      ? { year: Number(String(period).slice(0, 4)), price, count }
      : { [keyName]: period, price, count: count == null ? (keyName === "week" ? 0 : null) : count };
    if (keyName === "month" && row.source != null) {
      out.source = cleanString(row.source);
      out.shop = cleanString(row.shop);
      out.note = cleanString(row.note);
    }
    byId.get(id).push(out);
  }
  for (const [id, priceRows] of byId) {
    priceRows.sort((a, b) => String(a[keyName]).localeCompare(String(b[keyName])));
    target.get(id).push(...priceRows);
  }
}

const root = path.resolve(xlsxDir);
const sharedStrings = loadSharedStrings(root);
const sheetFiles = {
  master: "sheet1.xml",
  weekly: "sheet2.xml",
  monthly: "sheet3.xml",
  yearly: "sheet4.xml",
};

const sheets = Object.fromEntries(Object.entries(sheetFiles).map(([name, file]) => {
  const rows = parseSheet(root, file, sharedStrings);
  return [name, { rows, objects: toObjects(rows) }];
}));

if (inspectOnly) {
  for (const [name, sheet] of Object.entries(sheets)) {
    console.log(name, sheet.rows[0]);
    console.log(sheet.objects.slice(0, 2));
  }
  process.exit(0);
}

const weeklyById = new Map();
const monthlyById = new Map();
const yearlyById = new Map();

  const masterRows = nonEmptyRows(sheets.master.objects, "id");
for (const row of masterRows) {
  const id = cleanId(row.id);
  weeklyById.set(id, []);
  monthlyById.set(id, []);
  yearlyById.set(id, []);
}

addPriceRows(weeklyById, sheets.weekly.objects.filter((row) => cleanId(row.id || row.ID)), "week");
addPriceRows(monthlyById, nonEmptyRows(sheets.monthly.objects, "id"), "month");
addPriceRows(yearlyById, nonEmptyRows(sheets.yearly.objects, "id"), "year");

const sleeves = masterRows.map((row) => {
  const id = cleanId(row.id);
  const releaseDate = normalizeDate(row.releaseYear);
  const releaseYear = releaseDate ? Number(releaseDate.slice(0, 4)) : null;
  const imageFileId = cleanString(row.imageFileId);
  const categories = categoryBuckets(row);
  const yearlyPrices = yearlyById.get(id) || [];
  const pricesByYear = {};
  for (const item of yearlyPrices) {
    if (Number.isFinite(item.year) && item.price != null) pricesByYear[item.year] = item.price;
  }
  return {
    id,
    name: cleanString(row.name),
    imageUrl: imageFileId ? `https://drive.google.com/thumbnail?id=${imageFileId}&sz=w1200` : "",
    releaseDate,
    releaseYear,
    firstPrice: numberOrNull(row.firstprice),
    series: cleanString(row.series),
    condition: cleanString(row.condition),
    type: cleanString(row.type),
    feature: cleanString(row.type),
    acquisitionType: cleanString(row.acquisitionType),
    illustrator: cleanString(row.illustrator),
    note: cleanString(row.note),
    category1: cleanString(row.category1),
    category2: cleanString(row.category2),
    category3: cleanString(row.category3),
    category4: cleanString(row.category4),
    category5: cleanString(row.category5),
    category6: cleanString(row.category6),
    category7: cleanString(row.category7),
    category8: cleanString(row.category8),
    category9: cleanString(row.category9),
    ...categories,
    weeklyPrices: weeklyById.get(id) || [],
    monthlyPrices: monthlyById.get(id) || [],
    yearlyPrices,
    pricesByYear,
  };
});

fs.writeFileSync(outPath, JSON.stringify({ sleeves }), "utf8");
console.log(`Wrote ${outPath}: ${sleeves.length} sleeves`);
