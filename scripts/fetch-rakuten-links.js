#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const API_ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";
const DATA_PATH = path.resolve(__dirname, "..", "data.json");
const CACHE_PATH = path.resolve(__dirname, "..", "data", "rakuten-links.json");
const NEEDS_REVIEW_CSV_PATH = path.resolve(__dirname, "..", "data", "rakuten-needs-review.csv");
const USER_AGENT = "poke-sleeve-site-rakuten-link-fetcher/1.0";
const REQUEST_DELAY_MS = 1200;
const RETRY_DELAYS_MS = [5000, 15000, 30000];

const TEST_SLEEVE_IDS = [
  "323121",
  "463230",
  "100548"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function getEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function getSleeveRouteId(id) {
  const sleeveId = String(id || "").trim();
  if (/^\d{6,7}$/.test(sleeveId)) return `4521329${sleeveId}`;
  return sleeveId;
}

function isManualReviewedEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  const manualKeys = [
    "manual",
    "manualReview",
    "manualStatus",
    "reviewResult",
    "confirmed",
    "confirmedAt",
    "confirmedBy",
    "確認結果"
  ];
  return manualKeys.some((key) => {
    const value = entry[key];
    if (typeof value === "boolean") return value;
    return value != null && String(value).trim() !== "";
  });
}

function isReusableCacheEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.status === "api_error") return false;
  if (!["accepted", "needs_review", "not_found"].includes(entry.status)) return false;
  if (!entry.checkedAt && !entry.searchedAt) return false;
  if (entry.status === "accepted" && !entry.affiliateUrl) return false;
  return true;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[＆&]/g, " ")
    .replace(/[〈〉《》「」『』【】（）()[\]{}:：・,，./／\\|+＋_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchProductName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[＆&・／/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !["ポケモンカード", "ポケモン", "カード", "公式", "デッキシールド", "スリーブ"].includes(token));
}

function getMajorTerms(value) {
  return tokenize(normalizeSearchProductName(value));
}

function buildQueryPlan(sleeve) {
  const name = normalizeSearchProductName(sleeve.name);
  const jan = getSleeveRouteId(sleeve.id);
  const plan = [];
  if (/^\d{13}$/.test(jan)) {
    plan.push({ type: "jan", value: jan });
  }
  if (name) {
    plan.push({ type: "keyword", value: `ポケモンカードゲーム デッキシールド ${name}` });
    plan.push({ type: "keyword", value: `デッキシールド ${name}` });
    plan.push({ type: "keyword", value: `ポケモン ${name} スリーブ` });
    plan.push({ type: "keyword", value: `${name} デッキシールド` });
    plan.push({ type: "keyword", value: `${name} スリーブ` });
  }
  return plan;
}

function getRakutenItems(body) {
  if (Array.isArray(body && body.Items)) return body.Items;
  if (Array.isArray(body && body.items)) return body.items;
  return [];
}

function getRakutenTotalHits(body) {
  const value = body && (body.hits ?? body.count ?? body.totalHits);
  const total = Number(value);
  return Number.isFinite(total) ? total : null;
}

function calculateMatch(sleeve, item, queryType) {
  const itemName = String(item.itemName || "");
  const itemText = normalizeText(itemName);
  const majorTerms = getMajorTerms(sleeve.name);
  const matchedTerms = majorTerms.filter((term) => itemText.includes(normalizeText(term)));
  const missingTerms = majorTerms.filter((term) => !itemText.includes(normalizeText(term)));
  const hasPokemon = /ポケモン|pokemon|ポケカ/.test(itemText);
  const hasSleeve = /デッキシールド|スリーブ|deck shield|sleeve/.test(itemText);
  const hasAffiliateUrl = Boolean(item.affiliateUrl);
  const isAvailable = Number(item.availability ?? 1) === 1;
  const isExcludedProduct = /pcケース|パソコンケース|スマホケース|iphone|ipad|macbook|カードケース|デッキケース|プレイマット|マット|カードファイル|カード 本体|シングルカード|中古カード|拡張パック|box|ボックス|ぬいぐるみ|キーホルダー|フィギュア/.test(itemText);
  const tokenRatio = majorTerms.length ? matchedTerms.length / majorTerms.length : 0;
  const requiredPassed = hasSleeve && hasPokemon && hasAffiliateUrl && isAvailable && !isExcludedProduct && majorTerms.length > 0 && missingTerms.length === 0;
  const partialRequiredPassed = hasSleeve && hasPokemon && hasAffiliateUrl && isAvailable && !isExcludedProduct && matchedTerms.length > 0;
  let confidence = 0;

  if (queryType === "jan") confidence += 0.2;
  if (hasPokemon) confidence += 0.18;
  if (hasSleeve) confidence += 0.22;
  if (hasAffiliateUrl) confidence += 0.12;
  if (isAvailable) confidence += 0.08;
  if (!isExcludedProduct) confidence += 0.08;
  confidence += Math.min(0.12, tokenRatio * 0.12);
  if (missingTerms.length === 0 && majorTerms.length > 0) confidence += 0.1;

  let reviewReason = "";
  if (!hasSleeve) reviewReason = "楽天の商品名にデッキシールド/スリーブが含まれません";
  else if (!hasPokemon) reviewReason = "楽天の商品名にポケモン/ポケモンカードが含まれません";
  else if (!hasAffiliateUrl) reviewReason = "affiliateUrlが取得できません";
  else if (!isAvailable) reviewReason = "購入可能な商品ではありません";
  else if (isExcludedProduct) reviewReason = "明らかな別商品カテゴリの可能性があります";
  else if (missingTerms.length > 0) reviewReason = "ポケスリ側の商品名の主要語が一部しか一致しません";
  else reviewReason = "主要語、ポケモン表記、スリーブ表記、affiliateUrl、購入可能性を満たしています";

  return {
    confidence: Number(confidence.toFixed(2)),
    requiredPassed,
    partialRequiredPassed,
    reviewReason,
    reasons: {
      queryType,
      hasPokemon,
      hasSleeve,
      hasAffiliateUrl,
      isAvailable,
      isExcludedProduct,
      matchedTerms,
      missingTerms,
      majorTermCount: majorTerms.length
    }
  };
}

async function requestRakuten(params, credentials) {
  const url = new URL(API_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("applicationId", credentials.applicationId);
  url.searchParams.set("affiliateId", credentials.affiliateId);
  url.searchParams.set("hits", "5");
  url.searchParams.set("availability", "1");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Origin": "https://pokesuri-navi.com",
        "Referer": "https://pokesuri-navi.com/",
        "accessKey": credentials.accessKey
      }
    });

    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    const text = await res.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch (_) {
      body = { error: "invalid_json", error_description: text.slice(0, 120) };
    }

    if (!res.ok) {
      const errorCode = body.errorCode || body.error || "";
      const errorMessage = body.errorMessage || body.error_description || "";
      const err = new Error(`Rakuten API error: HTTP ${res.status} ${errorCode}`.trim());
      err.status = res.status;
      err.body = { errorCode, errorMessage };
      throw err;
    }

    return { httpStatus: res.status, body };
  }

  throw new Error("Rakuten API retry limit exceeded");
}

function isOfficialRakutenAffiliateUrl(affiliateUrl) {
  try {
    const url = new URL(affiliateUrl);
    return url.protocol === "https:" && url.hostname === "hb.afl.rakuten.co.jp";
  } catch (_) {
    return false;
  }
}

function getSafeAffiliateUrl(item, credentials) {
  const affiliateUrl = String(item && item.affiliateUrl || "").trim();
  if (!affiliateUrl) return "";
  if (!isOfficialRakutenAffiliateUrl(affiliateUrl)) return "";
  const accessKey = String(credentials && credentials.accessKey || "").trim();
  if (accessKey && affiliateUrl.includes(accessKey)) return "";
  return affiliateUrl;
}

function summarizeCandidate(candidate, credentials) {
  if (!candidate) {
    return {
      itemName: "",
      itemPrice: null,
      shopName: "",
      affiliateUrl: "",
      matchScore: 0,
      reviewReason: ""
    };
  }
  return {
    itemName: candidate.item.itemName || "",
    itemPrice: candidate.item.itemPrice ?? null,
    shopName: candidate.item.shopName || "",
    affiliateUrl: getSafeAffiliateUrl(candidate.item, credentials),
    matchScore: candidate.match.confidence,
    reviewReason: candidate.match.reviewReason
  };
}

function decideQueryMatch(queryCandidates) {
  const required = queryCandidates.filter((candidate) => candidate.match.requiredPassed);
  const partial = queryCandidates.filter((candidate) => candidate.match.partialRequiredPassed);
  if (required.length === 1) {
    return {
      status: "accepted",
      candidate: required[0],
      reviewReason: "必須条件をすべて満たす候補が1件だけで、主要語がすべて一致しました"
    };
  }
  if (required.length > 1) {
    return {
      status: "needs_review",
      candidate: required[0],
      reviewReason: "必須条件を満たす候補が複数あるため要確認です"
    };
  }
  if (partial.length > 0) {
    return {
      status: "needs_review",
      candidate: partial[0],
      reviewReason: partial[0].match.reviewReason || "主要語が一部一致のため要確認です"
    };
  }
  return {
    status: "not_found",
    candidate: null,
    reviewReason: "必須条件を満たす候補がありません"
  };
}

function buildCacheEntry(sleeve, searched, decision, candidates, queryReports = [], credentials = null) {
  const routeId = getSleeveRouteId(sleeve.id);
  const best = decision && decision.candidate ? decision.candidate : null;
  const summary = summarizeCandidate(best, credentials);
  let status = decision ? decision.status : (best ? "needs_review" : "not_found");
  let reviewReason = decision && decision.reviewReason ? decision.reviewReason : summary.reviewReason;
  if (status === "accepted" && !summary.affiliateUrl) {
    status = "needs_review";
    reviewReason = "affiliateUrlがHTTPSの楽天公式アフィリエイトURLではない、またはAccess Keyを含むため保存できません";
  }

  return {
    sleeveId: String(sleeve.id),
    status,
    searchKeyword: best ? best.query.value : (searched.length ? searched[searched.length - 1].value : ""),
    itemName: summary.itemName,
    itemPrice: summary.itemPrice,
    shopName: summary.shopName,
    affiliateUrl: summary.affiliateUrl,
    checkedAt: new Date().toISOString(),
    matchScore: summary.matchScore,
    reviewReason,
    routeId,
    sleeveName: String(sleeve.name || ""),
    queryReports,
    candidates: candidates.slice(0, 5).map((candidate) => ({
      queryType: candidate.query.type,
      itemName: candidate.item.itemName || "",
      itemPrice: candidate.item.itemPrice ?? null,
      hasAffiliateUrl: Boolean(candidate.item.affiliateUrl),
      shopName: candidate.item.shopName || "",
      confidence: candidate.match.confidence,
      requiredPassed: candidate.match.requiredPassed,
      match: candidate.match.reasons
    }))
  };
}

function buildErrorEntry(sleeve, err) {
  const errorCode = err && err.body && err.body.errorCode ? err.body.errorCode : "";
  const errorMessage = err && err.body && err.body.errorMessage ? err.body.errorMessage : "";
  return {
    sleeveId: String(sleeve.id),
    routeId: getSleeveRouteId(sleeve.id),
    sleeveName: String(sleeve.name || ""),
    searchedAt: new Date().toISOString(),
    queries: buildQueryPlan(sleeve),
    status: "api_error",
    searchKeyword: "",
    itemName: "",
    itemPrice: null,
    shopName: "",
    affiliateUrl: "",
    checkedAt: new Date().toISOString(),
    matchScore: 0,
    reviewReason: "楽天APIエラーのため確認できません",
    error: {
      status: err && err.status ? err.status : null,
      message: err && err.message ? err.message : "Rakuten API request failed",
      errorCode,
      errorMessage
    },
    match: null,
    rakuten: null,
    candidates: []
  };
}

async function searchSleeve(sleeve, credentials, options = {}) {
  const plan = buildQueryPlan(sleeve);
  const searched = [];
  const candidates = [];
  const queryReports = [];

  for (const query of plan) {
    await sleep(REQUEST_DELAY_MS);
    if (options.stats) options.stats.apiRequests += 1;
    const response = await requestRakuten({ keyword: query.value }, credentials);
    const body = response.body;
    const items = getRakutenItems(body);
    const totalHits = getRakutenTotalHits(body);
    searched.push(query);
    const queryCandidates = [];
    for (const item of items) {
      const match = calculateMatch(sleeve, item, query.type);
      const candidate = { query, item, match };
      candidates.push(candidate);
      queryCandidates.push(candidate);
    }
    const decision = decideQueryMatch(queryCandidates);
    queryReports.push({
      query: query.value,
      httpStatus: response.httpStatus,
      totalHits,
      itemCount: items.length,
      candidates: queryCandidates.slice(0, 5).map((candidate) => ({
        itemName: candidate.item.itemName || "",
        itemPrice: candidate.item.itemPrice ?? null,
        shopName: candidate.item.shopName || "",
        hasAffiliateUrl: Boolean(candidate.item.affiliateUrl),
        isMatchCandidate: candidate.match.requiredPassed || candidate.match.partialRequiredPassed,
        confidence: candidate.match.confidence
      }))
    });
    if (decision.status !== "not_found") {
      return buildCacheEntry(sleeve, searched, decision, candidates, queryReports, credentials);
    }
  }

  return buildCacheEntry(sleeve, searched, { status: "not_found", candidate: null, reviewReason: "必須条件を満たす候補がありません" }, candidates, queryReports, credentials);
}

function parseArgs(argv) {
  const args = { all: false, test: false, force: false, reviewOnly: false, ids: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") args.all = true;
    else if (arg === "--test") args.test = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--review-only") args.reviewOnly = true;
    else if (arg === "--ids") args.ids.push(...String(argv[++i] || "").split(",").map((id) => id.trim()).filter(Boolean));
    else if (arg.startsWith("--ids=")) args.ids.push(...arg.slice(6).split(",").map((id) => id.trim()).filter(Boolean));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function writeNeedsReviewCsv(cache) {
  const header = [
    "sleeveId",
    "ポケスリ商品名",
    "楽天商品名",
    "価格",
    "ショップ",
    "matchScore",
    "reviewReason",
    "確認結果"
  ];
  const rows = Object.values(cache.items || {})
    .filter((entry) => entry && entry.status === "needs_review")
    .sort((a, b) => String(a.sleeveId || "").localeCompare(String(b.sleeveId || "")))
    .map((entry) => [
      entry.sleeveId || "",
      entry.sleeveName || "",
      entry.itemName || "",
      entry.itemPrice ?? "",
      entry.shopName || "",
      entry.matchScore ?? "",
      entry.reviewReason || "",
      ""
    ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  writeText(NEEDS_REVIEW_CSV_PATH, csv);
}

function getStatusCounts(cache) {
  const counts = { accepted: 0, needs_review: 0, not_found: 0, api_error: 0 };
  for (const entry of Object.values(cache.items || {})) {
    if (entry && Object.prototype.hasOwnProperty.call(counts, entry.status)) counts[entry.status] += 1;
  }
  return counts;
}

async function main() {
  const args = parseArgs(process.argv);
  const data = readJson(DATA_PATH, { sleeves: [] });
  const cache = readJson(CACHE_PATH, { generatedAt: "", items: {} });
  if (!cache.items || typeof cache.items !== "object") cache.items = {};

  const credentials = {
    applicationId: getEnv("RAKUTEN_APPLICATION_ID"),
    accessKey: getEnv("RAKUTEN_ACCESS_KEY"),
    affiliateId: getEnv("RAKUTEN_AFFILIATE_ID")
  };

  const wantedIds = args.all ? data.sleeves.map((sleeve) => String(sleeve.id)).filter(Boolean) : (args.test ? TEST_SLEEVE_IDS : args.ids);
  if (!wantedIds.length) {
    throw new Error("Pass --all, --test, or --ids id1,id2 for explicit items.");
  }

  const byId = new Map(data.sleeves.map((sleeve) => [String(sleeve.id), sleeve]));
  const results = [];
  const stats = {
    startedAt: Date.now(),
    totalTargets: wantedIds.length,
    apiRequests: 0,
    cacheReused: 0,
    manualPreserved: 0,
    processed: 0
  };
  for (const id of wantedIds) {
    const sleeve = byId.get(String(id));
    if (!sleeve) throw new Error(`Sleeve not found in data.json: ${id}`);
    const routeId = getSleeveRouteId(sleeve.id);
    if (isManualReviewedEntry(cache.items[routeId])) {
      stats.cacheReused += 1;
      stats.manualPreserved += 1;
      results.push(cache.items[routeId]);
      continue;
    }
    if (!args.force && isReusableCacheEntry(cache.items[routeId])) {
      stats.cacheReused += 1;
      results.push(cache.items[routeId]);
      continue;
    }
    let entry;
    try {
      entry = await searchSleeve(sleeve, credentials, { reviewOnly: args.reviewOnly, stats });
    } catch (err) {
      entry = buildErrorEntry(sleeve, err);
    }
    cache.items[routeId] = entry;
    cache.generatedAt = new Date().toISOString();
    writeJson(CACHE_PATH, cache);
    results.push(entry);
    stats.processed += 1;
    if (args.all && (stats.processed % 25 === 0 || stats.processed + stats.cacheReused === stats.totalTargets)) {
      const counts = getStatusCounts(cache);
      console.error(`progress ${stats.processed + stats.cacheReused}/${stats.totalTargets} apiRequests=${stats.apiRequests} reused=${stats.cacheReused} accepted=${counts.accepted} needs_review=${counts.needs_review} not_found=${counts.not_found} api_error=${counts.api_error}`);
    }
  }
  writeNeedsReviewCsv(cache);
  const counts = getStatusCounts(cache);
  const elapsedSeconds = Number(((Date.now() - stats.startedAt) / 1000).toFixed(1));

  console.log(JSON.stringify({
    generatedAt: cache.generatedAt,
    needsReviewCsv: path.relative(path.resolve(__dirname, ".."), NEEDS_REVIEW_CSV_PATH),
    summary: {
      totalTargets: stats.totalTargets,
      apiRequests: stats.apiRequests,
      cacheReused: stats.cacheReused,
      manualPreserved: stats.manualPreserved,
      accepted: counts.accepted,
      needs_review: counts.needs_review,
      not_found: counts.not_found,
      api_error: counts.api_error,
      elapsedSeconds
    },
    results: results.map((entry) => ({
      sleeveId: entry.sleeveId,
      routeId: entry.routeId,
      sleeveName: entry.sleeveName,
      search: entry.searchKeyword || "",
      rakutenItemName: entry.itemName || "",
      rakutenItemPrice: entry.itemPrice ?? null,
      shopName: entry.shopName || "",
      hasAffiliateUrl: Boolean(entry.affiliateUrl),
      status: entry.status,
      matchScore: entry.matchScore,
      reviewReason: entry.reviewReason || "",
      httpStatus: entry.error ? entry.error.status : 200,
      errorCode: entry.error ? entry.error.errorCode : "",
      errorMessage: entry.error ? entry.error.errorMessage : "",
      queryReports: entry.queryReports || []
    }))
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
