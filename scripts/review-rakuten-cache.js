const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data.json");
const CACHE_PATH = path.join(ROOT, "data", "rakuten-links.json");
const ACCEPTED_CSV_PATH = path.join(ROOT, "data", "rakuten-accepted-review.csv");
const NEEDS_REVIEW_CSV_PATH = path.join(ROOT, "data", "rakuten-needs-review.csv");

const accessKey = process.env.RAKUTEN_ACCESS_KEY || "";
const now = new Date().toISOString();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[＆&・／/]/g, " ")
    .replace(/[【】「」『』（）()［］\[\]◆★☆:：,，.。]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function majorTerms(name) {
  const text = normalizeText(name)
    .replace(/ポケモンカードゲーム/g, " ")
    .replace(/ポケモンカード/g, " ")
    .replace(/デッキシールド/g, " ")
    .replace(/スリーブ/g, " ");

  return [...new Set(text.split(" ").filter((term) => term.length > 0))];
}

function containsEveryTerm(itemName, terms) {
  const itemText = normalizeText(itemName);
  const matched = [];
  const missing = [];

  for (const term of terms) {
    if (itemText.includes(normalizeText(term))) {
      matched.push(term);
    } else {
      missing.push(term);
    }
  }

  return { matched, missing };
}

function validateAffiliateUrl(rawUrl) {
  if (!rawUrl) return { ok: false, reason: "affiliateUrlが空です" };

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "affiliateUrlをURLとして解析できません" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "affiliateUrlがhttpsではありません" };
  }

  if (url.hostname !== "hb.afl.rakuten.co.jp") {
    return { ok: false, reason: "楽天公式アフィリエイトドメインではありません" };
  }

  if (accessKey && rawUrl.includes(accessKey)) {
    return { ok: false, reason: "affiliateUrlにAccess Keyが含まれています" };
  }

  return { ok: true, reason: "" };
}

function isExcludedProduct(itemName) {
  return /pcケース|パソコンケース|スマホケース|iphone|ipad|macbook|カードケース|デッキケース|プレイマット|ラバーマット|カードファイル|シングルカード|中古カード|トレーディングカード単品|拡張パック|ブースター|box|ボックス|ぬいぐるみ|キーホルダー|フィギュア|tシャツ|ノースリーブ|ワンピース/i.test(
    normalizeText(itemName)
  );
}

function hasVersionRisk(itemName) {
  return /海外|海外限定|並行輸入|輸入品|非公式/i.test(normalizeText(itemName));
}

function validateAccepted(entry, sleeve) {
  const reasons = [];
  const itemName = String(entry.itemName || "");
  const shopName = String(entry.shopName || "");
  const itemPrice = entry.itemPrice;
  const itemText = normalizeText(itemName);
  const terms = majorTerms(sleeve.name);
  const termResult = containsEveryTerm(itemName, terms);
  const affiliate = validateAffiliateUrl(entry.affiliateUrl);

  if (!/(ポケモン|pokemon|ポケカ)/i.test(itemText)) {
    reasons.push("楽天商品名にポケモン表記がありません");
  }
  if (!/(デッキシールド|スリーブ|deck shield|sleeve)/i.test(itemText)) {
    reasons.push("楽天商品名にデッキシールド/スリーブ表記がありません");
  }
  if (termResult.missing.length > 0) {
    reasons.push(`主要語が不足しています: ${termResult.missing.join(" ")}`);
  }
  if (!affiliate.ok) {
    reasons.push(affiliate.reason);
  }
  if (isExcludedProduct(itemName)) {
    reasons.push("明らかな別商品カテゴリの可能性があります");
  }
  if (hasVersionRisk(itemName)) {
    reasons.push("海外版・並行輸入品など版違いの可能性があります");
  }
  if (!itemName.trim()) {
    reasons.push("楽天商品名が空です");
  }
  if (!shopName.trim()) {
    reasons.push("ショップ名が空です");
  }
  if (itemPrice === null || itemPrice === undefined || itemPrice === "" || Number.isNaN(Number(itemPrice))) {
    reasons.push("価格が空です");
  }
  if (Number(itemPrice) >= 999999) {
    reasons.push("価格がプレースホルダーの可能性があります");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    matchedTerms: termResult.matched,
    missingTerms: termResult.missing,
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(filePath, rows) {
  const lines = rows.map((row) => row.map(csvEscape).join(","));
  fs.writeFileSync(filePath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

function sanitizeEntry(entry, sleeve) {
  return {
    sleeveId: String(entry.sleeveId || sleeve?.id || ""),
    status: entry.status || "not_found",
    searchKeyword: entry.searchKeyword || "",
    itemName: entry.itemName || "",
    itemPrice: entry.itemPrice ?? null,
    shopName: entry.shopName || "",
    affiliateUrl: entry.affiliateUrl || "",
    checkedAt: entry.checkedAt || now,
    matchScore: entry.matchScore ?? 0,
    reviewReason: entry.reviewReason || "",
  };
}

function statusCounts(items) {
  return Object.values(items).reduce(
    (counts, entry) => {
      counts[entry.status] = (counts[entry.status] || 0) + 1;
      return counts;
    },
    { accepted: 0, needs_review: 0, not_found: 0, api_error: 0 }
  );
}

function buildSamples(acceptedEntries, sleeveById) {
  const seen = new Set();
  const pick = (entries, limit = 10) => {
    const rows = [];
    for (const entry of entries) {
      if (seen.has(entry.sleeveId)) continue;
      const sleeve = sleeveById.get(String(entry.sleeveId));
      if (!sleeve) continue;
      seen.add(entry.sleeveId);
      rows.push(toSample(entry, sleeve));
      if (rows.length >= limit) break;
    }
    return rows;
  };

  const byDateAsc = [...acceptedEntries].sort((a, b) =>
    String(sleeveById.get(String(a.sleeveId))?.releaseDate || "").localeCompare(
      String(sleeveById.get(String(b.sleeveId))?.releaseDate || "")
    )
  );
  const byDateDesc = [...byDateAsc].reverse();
  const byShortName = [...acceptedEntries].sort((a, b) => {
    const an = sleeveById.get(String(a.sleeveId))?.name || "";
    const bn = sleeveById.get(String(b.sleeveId))?.name || "";
    return an.length - bn.length || an.localeCompare(bn, "ja");
  });
  const byLowScore = [...acceptedEntries].sort(
    (a, b) => Number(a.matchScore || 0) - Number(b.matchScore || 0) || String(a.sleeveId).localeCompare(String(b.sleeveId))
  );
  const byHighPrice = [...acceptedEntries].sort(
    (a, b) => Number(b.itemPrice || 0) - Number(a.itemPrice || 0) || String(a.sleeveId).localeCompare(String(b.sleeveId))
  );

  return {
    old: pick(byDateAsc),
    new: pick(byDateDesc),
    shortName: pick(byShortName),
    lowScore: pick(byLowScore),
    highPrice: pick(byHighPrice),
  };
}

function toSample(entry, sleeve) {
  return {
    sleeveName: sleeve.name,
    itemName: entry.itemName || "",
    itemPrice: entry.itemPrice ?? "",
    shopName: entry.shopName || "",
    matchScore: entry.matchScore ?? "",
    reason: entry.reviewReason || "",
  };
}

function main() {
  const data = readJson(DATA_PATH);
  const cache = readJson(CACHE_PATH);
  const sleeves = data.sleeves || [];
  const sleeveById = new Map(sleeves.map((sleeve) => [String(sleeve.id), sleeve]));
  const entries = cache.items || {};
  const originalEntries = entries;
  let movedToNeedsReview = 0;
  const moved = [];

  for (const entry of Object.values(entries)) {
    if (entry.status !== "accepted") continue;
    const sleeve = sleeveById.get(String(entry.sleeveId));
    if (!sleeve) continue;

    const result = validateAccepted(entry, sleeve);
    if (!result.ok) {
      movedToNeedsReview += 1;
      entry.status = "needs_review";
      entry.checkedAt = now;
      entry.reviewReason = `公開前再検査で要確認: ${result.reasons.join(" / ")}`;
      moved.push({
        sleeveId: entry.sleeveId,
        sleeveName: sleeve.name,
        reasons: result.reasons,
      });
    }
  }

  const sanitizedItems = {};
  for (const [routeId, entry] of Object.entries(originalEntries)) {
    const sleeve = sleeveById.get(String(entry.sleeveId));
    sanitizedItems[routeId] = sanitizeEntry(entry, sleeve);
  }

  cache.generatedAt = now;
  cache.items = sanitizedItems;
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

  const acceptedEntries = Object.values(sanitizedItems).filter((entry) => entry.status === "accepted");
  const csvRows = [
    ["sleeveId", "ポケスリ商品名", "楽天商品名", "価格", "ショップ", "matchScore", "採用理由", "確認結果"],
    ...acceptedEntries
      .sort((a, b) => String(a.sleeveId).localeCompare(String(b.sleeveId), undefined, { numeric: true }))
      .map((entry) => {
        const sleeve = sleeveById.get(String(entry.sleeveId));
        return [
          entry.sleeveId,
          sleeve?.name || entry.sleeveName || "",
          entry.itemName || "",
          entry.itemPrice ?? "",
          entry.shopName || "",
          entry.matchScore ?? "",
          entry.reviewReason || "",
          "",
        ];
      }),
  ];
  writeCsv(ACCEPTED_CSV_PATH, csvRows);

  const needsReviewRows = [
    ["sleeveId", "ポケスリ商品名", "楽天商品名", "価格", "ショップ", "matchScore", "reviewReason", "確認結果"],
    ...Object.values(sanitizedItems)
      .filter((entry) => entry.status === "needs_review")
      .sort((a, b) => String(a.sleeveId).localeCompare(String(b.sleeveId), undefined, { numeric: true }))
      .map((entry) => {
        const sleeve = sleeveById.get(String(entry.sleeveId));
        return [
          entry.sleeveId,
          sleeve?.name || "",
          entry.itemName || "",
          entry.itemPrice ?? "",
          entry.shopName || "",
          entry.matchScore ?? "",
          entry.reviewReason || "",
          "",
        ];
      }),
  ];
  writeCsv(NEEDS_REVIEW_CSV_PATH, needsReviewRows);

  const counts = statusCounts(sanitizedItems);
  const apiErrors = Object.values(sanitizedItems)
    .filter((entry) => entry.status === "api_error")
    .map((entry) => ({
      sleeveName: sleeveById.get(String(entry.sleeveId))?.name || entry.sleeveName || "",
      errorCode: entry.errorCode || "",
      errorMessage: entry.errorMessage || "",
    }));

  const report = {
    checkedAt: now,
    acceptedCsv: path.relative(ROOT, ACCEPTED_CSV_PATH),
    needsReviewCsv: path.relative(ROOT, NEEDS_REVIEW_CSV_PATH),
    counts,
    movedToNeedsReview,
    moved,
    apiErrors,
    samples: buildSamples(acceptedEntries, sleeveById),
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
