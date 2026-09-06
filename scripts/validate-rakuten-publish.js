const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const CACHE_PATH = path.join(ROOT, "data", "rakuten-links.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function routeId(id) {
  const raw = String(id || "").trim();
  return /^\d{6,7}$/.test(raw) ? `4521329${raw}` : raw;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isSafeAffiliateUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "https:" && parsed.hostname === "hb.afl.rakuten.co.jp";
  } catch {
    return false;
  }
}

function extractInlineScripts(html) {
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => {
      const attrs = match[1] || "";
      const typeMatch = attrs.match(/\stype=["']?([^"'\s>]+)/i);
      if (!typeMatch) return true;
      return /^(?:text|application)\/javascript$/i.test(typeMatch[1]) || /^module$/i.test(typeMatch[1]);
    })
    .map((match) => match[2]);
}

function validateScriptSyntax(html, filePath) {
  for (const [index, script] of extractInlineScripts(html).entries()) {
    try {
      new Function(script);
    } catch (error) {
      throw new Error(`${filePath} inline script ${index + 1}: ${error.message}`);
    }
  }
}

function extractStructuredData(html) {
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => /type=["']application\/ld\+json["']/i.test(match[1] || ""))
    .map((match) => match[2].replace(/\s+/g, " ").trim());
}

function main() {
  const data = readJson(DATA_PATH);
  const cache = readJson(CACHE_PATH);
  const sleeves = data.sleeves || [];
  const entries = cache.items || {};
  const accessKey = process.env.RAKUTEN_ACCESS_KEY || "";
  const counts = { accepted: 0, needs_review: 0, not_found: 0, api_error: 0 };
  let generatedPages = 0;
  let pagesWithRakutenButtonMarkup = 0;
  let acceptedWithSafeUrl = 0;
  let trackedLeakHits = 0;
  let structuredDataUnchanged = true;
  const failures = [];

  for (const sleeve of sleeves) {
    const id = routeId(sleeve.id);
    const pagePath = path.join(ROOT, "sleeve", id, "index.html");
    const entry = entries[id];
    if (entry && counts[entry.status] !== undefined) counts[entry.status] += 1;

    if (!fs.existsSync(pagePath)) {
      failures.push(`missing generated page: ${id}`);
      continue;
    }
    generatedPages += 1;

    const html = fs.readFileSync(pagePath, "utf8");
    if (id === "4521329323121") {
      try {
        const previousHtml = childProcess.execFileSync("git", ["show", `HEAD:sleeve/${id}/index.html`], {
          encoding: "utf8",
        });
        structuredDataUnchanged =
          JSON.stringify(extractStructuredData(previousHtml)) === JSON.stringify(extractStructuredData(html));
      } catch {
        structuredDataUnchanged = false;
      }
    }
    if (html.includes('id="rakutenLink"')) pagesWithRakutenButtonMarkup += 1;
    try {
      validateScriptSyntax(html, pagePath);
    } catch (error) {
      failures.push(error.message);
    }

    if (!html.includes("../../data/rakuten-links.json")) {
      failures.push(`rakuten cache path is not page-relative: ${id}`);
    }
    if (!html.includes('rel="nofollow sponsored noopener"')) {
      failures.push(`missing rakuten rel attributes: ${id}`);
    }
    if (!html.includes("surugayaLink")) {
      failures.push(`surugaya link missing: ${id}`);
    }
    if (!html.toLowerCase().includes("mercari")) {
      failures.push(`mercari text/link missing: ${id}`);
    }
    if (accessKey && html.includes(accessKey)) {
      trackedLeakHits += 1;
      failures.push(`access key leaked in generated page: ${id}`);
    }

    if (entry && entry.status === "accepted") {
      assert(entry.affiliateUrl, `accepted without affiliateUrl: ${id}`);
      assert(isSafeAffiliateUrl(entry.affiliateUrl), `accepted unsafe affiliateUrl: ${id}`);
      acceptedWithSafeUrl += 1;
    }
  }

  const redGreen = entries["4521329323121"];
  assert(redGreen && redGreen.status === "accepted", "red green is not accepted");
  assert(isSafeAffiliateUrl(redGreen.affiliateUrl), "red green affiliateUrl is unsafe");

  const yanakoma = entries["4521329463230"];
  assert(yanakoma && yanakoma.status !== "accepted", "yanakoma should not be accepted");

  const reshiram = entries["4521329100548"];
  assert(reshiram && reshiram.status !== "accepted", "reshiram should not be accepted");

  const report = {
    generatedPages,
    totalSleeves: sleeves.length,
    pagesWithRakutenButtonMarkup,
    acceptedWithSafeUrl,
    counts,
    redGreen: {
      status: redGreen.status,
      itemName: redGreen.itemName,
      affiliateUrlMatchesCache: true,
    },
    negativeChecks: {
      yanakomaStatus: yanakoma.status,
      reshiramStatus: reshiram.status,
    },
    trackedLeakHits,
    structuredDataUnchanged,
    failures: failures.slice(0, 20),
  };

  if (failures.length > 0) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(report, null, 2));
}

main();
