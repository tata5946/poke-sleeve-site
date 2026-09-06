#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const API_ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";
const DATA_PATH = path.resolve(__dirname, "..", "data.json");
const CACHE_PATH = path.resolve(__dirname, "..", "data", "rakuten-links.json");
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

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[＆&]/g, " ")
    .replace(/[〈〉《》「」『』【】（）()[\]{}:：・,，./／\\|+＋_-]/g, " ")
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

function buildQueryPlan(sleeve) {
  const name = String(sleeve.name || "").trim();
  const jan = getSleeveRouteId(sleeve.id);
  const plan = [];
  if (/^\d{13}$/.test(jan)) {
    plan.push({ type: "jan", value: jan });
  }
  if (name) {
    plan.push({ type: "keyword", value: `ポケモンカード デッキシールド ${name}` });
  }
  return plan;
}

function calculateMatch(sleeve, item, queryType) {
  const itemName = String(item.itemName || "");
  const itemText = normalizeText(`${itemName} ${item.catchcopy || ""}`);
  const tokens = tokenize(sleeve.name);
  const matchedTokens = tokens.filter((token) => itemText.includes(normalizeText(token)));
  const hasPokemon = /ポケモン|pokemon|ポケカ/.test(itemText);
  const hasSleeve = /デッキシールド|スリーブ|deck shield|sleeve/.test(itemText);
  const tokenRatio = tokens.length ? matchedTokens.length / tokens.length : 0;
  let confidence = 0;

  if (queryType === "jan") confidence += 0.45;
  if (hasPokemon) confidence += 0.15;
  if (hasSleeve) confidence += 0.2;
  confidence += Math.min(0.2, tokenRatio * 0.2);

  const accepted = confidence >= 0.78 && hasSleeve && (tokens.length === 0 || tokenRatio >= 0.75);
  return {
    status: accepted ? "accepted" : "needs_review",
    confidence: Number(confidence.toFixed(2)),
    reasons: {
      queryType,
      hasPokemon,
      hasSleeve,
      matchedTokens,
      tokenCount: tokens.length
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
  url.searchParams.set("elements", [
    "itemName",
    "itemPrice",
    "itemUrl",
    "affiliateUrl",
    "shopName",
    "shopCode",
    "catchcopy"
  ].join(","));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
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
      const err = new Error(`Rakuten API error: HTTP ${res.status} ${body.error || ""}`.trim());
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  throw new Error("Rakuten API retry limit exceeded");
}

function buildCacheEntry(sleeve, searched, accepted, candidates) {
  const routeId = getSleeveRouteId(sleeve.id);
  const best = accepted || candidates[0] || null;
  const status = accepted ? "accepted" : (best ? "needs_review" : "not_found");

  return {
    sleeveId: String(sleeve.id),
    routeId,
    sleeveName: String(sleeve.name || ""),
    searchedAt: new Date().toISOString(),
    queries: searched,
    status,
    confidence: best ? best.match.confidence : 0,
    match: best ? best.match.reasons : null,
    rakuten: best ? {
      itemName: best.item.itemName || "",
      itemPrice: best.item.itemPrice ?? null,
      itemUrl: best.item.itemUrl || "",
      affiliateUrl: status === "accepted" ? (best.item.affiliateUrl || "") : "",
      shopName: best.item.shopName || "",
      shopCode: best.item.shopCode || ""
    } : null,
    candidates: candidates.slice(0, 5).map((candidate) => ({
      queryType: candidate.query.type,
      itemName: candidate.item.itemName || "",
      itemPrice: candidate.item.itemPrice ?? null,
      itemUrl: candidate.item.itemUrl || "",
      hasAffiliateUrl: Boolean(candidate.item.affiliateUrl),
      shopName: candidate.item.shopName || "",
      confidence: candidate.match.confidence,
      status: candidate.match.status,
      match: candidate.match.reasons
    }))
  };
}

function buildErrorEntry(sleeve, err) {
  return {
    sleeveId: String(sleeve.id),
    routeId: getSleeveRouteId(sleeve.id),
    sleeveName: String(sleeve.name || ""),
    searchedAt: new Date().toISOString(),
    queries: buildQueryPlan(sleeve),
    status: "api_error",
    confidence: 0,
    error: {
      status: err && err.status ? err.status : null,
      message: err && err.message ? err.message : "Rakuten API request failed",
      code: err && err.body && err.body.error ? err.body.error : "",
      description: err && err.body && err.body.error_description ? err.body.error_description : ""
    },
    match: null,
    rakuten: null,
    candidates: []
  };
}

async function searchSleeve(sleeve, credentials) {
  const plan = buildQueryPlan(sleeve);
  const searched = [];
  const candidates = [];

  for (const query of plan) {
    await sleep(REQUEST_DELAY_MS);
    const body = await requestRakuten({ keyword: query.value }, credentials);
    const items = Array.isArray(body.Items) ? body.Items : [];
    searched.push(query);
    for (const item of items) {
      const match = calculateMatch(sleeve, item, query.type);
      candidates.push({ query, item, match });
    }
    const accepted = candidates.find((candidate) => candidate.match.status === "accepted" && candidate.item.affiliateUrl);
    if (accepted) return buildCacheEntry(sleeve, searched, accepted, candidates);
  }

  return buildCacheEntry(sleeve, searched, null, candidates);
}

function parseArgs(argv) {
  const args = { test: false, force: false, ids: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--test") args.test = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--ids") args.ids.push(...String(argv[++i] || "").split(",").map((id) => id.trim()).filter(Boolean));
    else if (arg.startsWith("--ids=")) args.ids.push(...arg.slice(6).split(",").map((id) => id.trim()).filter(Boolean));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
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

  const wantedIds = args.test ? TEST_SLEEVE_IDS : args.ids;
  if (!wantedIds.length) {
    throw new Error("Pass --test for the 3-item smoke test or --ids id1,id2 for explicit items.");
  }

  const byId = new Map(data.sleeves.map((sleeve) => [String(sleeve.id), sleeve]));
  const results = [];
  for (const id of wantedIds) {
    const sleeve = byId.get(String(id));
    if (!sleeve) throw new Error(`Sleeve not found in data.json: ${id}`);
    const routeId = getSleeveRouteId(sleeve.id);
    if (!args.force && cache.items[routeId]) {
      results.push(cache.items[routeId]);
      continue;
    }
    let entry;
    try {
      entry = await searchSleeve(sleeve, credentials);
    } catch (err) {
      entry = buildErrorEntry(sleeve, err);
    }
    cache.items[routeId] = entry;
    cache.generatedAt = new Date().toISOString();
    writeJson(CACHE_PATH, cache);
    results.push(entry);
  }

  console.log(JSON.stringify({
    generatedAt: cache.generatedAt,
    results: results.map((entry) => ({
      sleeveId: entry.sleeveId,
      routeId: entry.routeId,
      sleeveName: entry.sleeveName,
      search: entry.queries.map((query) => query.value).join(" / "),
      rakutenItemName: entry.rakuten ? entry.rakuten.itemName : "",
      rakutenItemPrice: entry.rakuten ? entry.rakuten.itemPrice : null,
      itemUrl: entry.rakuten ? entry.rakuten.itemUrl : "",
      hasAffiliateUrl: Boolean(entry.rakuten && entry.rakuten.affiliateUrl),
      status: entry.status,
      confidence: entry.confidence
    }))
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
