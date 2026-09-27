#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} could not be read: ${error.message}`);
  }
}

function extractDetailScript(templateHtml) {
  const scripts = [...templateHtml.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  const match = scripts.find((entry) => {
    const attributes = String(entry[1] || "");
    const source = String(entry[2] || "");
    return !/\bsrc\s*=/.test(attributes) && source.includes("function buildAiMarketDiagnosis");
  });
  if (!match) fail("Detail page calculation script was not found in the template.");
  return match[2];
}

function loadDetailFunctions(templatePath) {
  const templateHtml = fs.readFileSync(templatePath, "utf8");
  const source = extractDetailScript(templateHtml);
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    Date,
    Math,
    JSON,
    Intl,
    setTimeout,
    clearTimeout,
    window: {
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      common: null
    },
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return {}; },
      baseURI: "https://pokesuri-navi.com/",
      head: { appendChild() {} },
      body: { appendChild() {}, removeChild() {}, classList: { add() {}, remove() {} } },
      referrer: "",
      title: ""
    },
    location: { href: "https://pokesuri-navi.com/", pathname: "/", search: "" },
    navigator: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    fetch: async () => { throw new Error("Network access is unavailable during static generation."); }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const exportsSource = `
    globalThis.__staticSleeveFunctions = {
      buildAiMarketDiagnosis,
      renderMarketPosition,
      buildFullPeriodSeries,
      renderPriceTable,
      escapeHtml
    };
  `;
  try {
    vm.runInContext(`${source}\n${exportsSource}`, sandbox, {
      filename: path.basename(templatePath),
      timeout: 10000
    });
  } catch (error) {
    fail(`Detail page calculation script could not be evaluated: ${error.stack || error.message}`);
  }
  return sandbox.__staticSleeveFunctions;
}

function buildDiagnosisHtml(functions, sleeve) {
  const diagnosis = functions.buildAiMarketDiagnosis(sleeve);
  if (!diagnosis) return "";
  return `
        <h3 class="ai-diagnosis-title">AI相場診断：${functions.escapeHtml(diagnosis.label)}</h3>
        <p class="ai-diagnosis-reason">理由：${functions.escapeHtml(diagnosis.reason)}</p>
      `;
}

function buildStaticContent(functions, sleeves) {
  const result = {};
  for (const sleeve of sleeves) {
    const id = String(sleeve?.id || "").trim();
    if (!id) continue;
    result[id] = {
      diagnosisHtml: buildDiagnosisHtml(functions, sleeve),
      marketPositionHtml: functions.renderMarketPosition(sleeve, sleeves),
      priceHistoryHtml: functions.renderPriceTable(functions.buildFullPeriodSeries(sleeve), "all")
    };
  }
  return result;
}

const dataPath = getArg("--data");
const templatePath = getArg("--template");
const outputPath = getArg("--output");
if (!dataPath || !templatePath || !outputPath) {
  fail("Usage: node build-static-sleeve-content.js --data data.json --template detail.html --output output.json");
}

const data = readJson(dataPath, "Data file");
const sleeves = Array.isArray(data?.sleeves) ? data.sleeves : [];
const functions = loadDetailFunctions(templatePath);
const content = buildStaticContent(functions, sleeves);
fs.writeFileSync(outputPath, JSON.stringify(content), "utf8");
process.stdout.write(`Built static content for ${Object.keys(content).length} sleeve pages.\n`);
