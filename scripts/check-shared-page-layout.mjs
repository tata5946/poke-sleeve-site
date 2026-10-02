import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Source-level layout regression checks. These do not replace browser rendering.
// Parse nested rule blocks while ignoring braces inside comments and strings.
function cssBlocks(source, offset = 0, parents = []) {
  const nodes = [];
  let i = 0;
  function skipString(pos) {
    const quote = source[pos++];
    while (pos < source.length) {
      if (source[pos] === '\\') { pos += 2; continue; }
      if (source[pos++] === quote) break;
    }
    return pos;
  }
  function skipComment(pos) {
    const end = source.indexOf('*/', pos + 2);
    if (end < 0) throw new Error('Unclosed CSS comment');
    return end + 2;
  }
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source.slice(i, i + 2) === '/*') { i = skipComment(i); continue; }
    const start = i;
    let depth = 0;
    for (; i < source.length; i++) {
      if (source.slice(i, i + 2) === '/*') { i = skipComment(i) - 1; continue; }
      if (source[i] === '"' || source[i] === "'") { i = skipString(i) - 1; continue; }
      if (source[i] === '(') depth++;
      if (source[i] === ')') depth--;
      if (!depth && (source[i] === '{' || source[i] === ';')) break;
    }
    if (i >= source.length) break;
    if (source[i] === ';') { i++; continue; }
    const header = source.slice(start, i).trim();
    const bodyStart = ++i;
    let braces = 1;
    for (; i < source.length; i++) {
      if (source.slice(i, i + 2) === '/*') { i = skipComment(i) - 1; continue; }
      if (source[i] === '"' || source[i] === "'") { i = skipString(i) - 1; continue; }
      if (source[i] === '{') braces++;
      if (source[i] === '}' && --braces === 0) break;
    }
    if (braces) throw new Error('Unclosed CSS block: ' + header);
    const body = source.slice(bodyStart, i);
    nodes.push({ header, body, start: offset + start, bodyStart: offset + bodyStart, end: offset + i + 1, parents });
    if (/^@(media|layer|supports)\b/.test(header)) nodes.push(...cssBlocks(body, offset + bodyStart, [...parents, header]));
    i++;
  }
  return nodes;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = await readFile(path.join(root, 'assets/site.css'), 'utf8');
const rules = cssBlocks(site).filter(node => !node.header.startsWith('@') && node.parents.includes('@layer shared-page-layout'));
assert.ok(rules.length, 'Common layout must have an authoritative cascade layer');

function parsePage(html) {
  const nodes = [];
  const stack = [];
  const markup = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  for (const match of markup.matchAll(/<([\/]?)([a-z][\w-]*)([^>]*)>/gi)) {
    const [, closing, tagName, attributes] = match;
    const tag = tagName.toLowerCase();
    if (closing) {
      const index = stack.findLastIndex(node => node.tag === tag);
      if (index >= 0) stack.length = index;
      continue;
    }
    const classes = new Set((attributes.match(/\bclass=["']([^"']*)["']/i)?.[1] || '').split(/\s+/).filter(Boolean));
    const node = { tag, classes, parent: stack.at(-1) };
    nodes.push(node);
    if (!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !attributes.trim().endsWith('/')) stack.push(node);
  }
  return nodes;
}

// This matcher covers the simple class/ancestor selectors used by the shared layer.
// It intentionally does not simulate layout, pseudo-elements, or the whole browser cascade.
function compoundMatches(node, selector) {
  if (!node || selector.includes('::')) return false;
  const exclusions = [...selector.matchAll(/:not\(([^()]*)\)/g)];
  if (exclusions.some(match => compoundMatches(node, match[1]))) return false;
  selector = selector.replace(/:not\([^()]*\)/g, '').replace(/:root/g, node.tag === 'html' ? '' : ':unsupported');
  if (selector.includes(':') || selector.includes('[')) return false;
  const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
  if (tag && node.tag !== tag.toLowerCase()) return false;
  return [...selector.matchAll(/\.([\w-]+)/g)].every(match => node.classes.has(match[1]));
}

function matches(node, selector) {
  const parts = selector.trim().split(/\s+(?![^()]*\))/);
  function visit(candidate, index) {
    if (!compoundMatches(candidate, parts[index])) return false;
    if (index === 0) return true;
    if (parts[index - 1] === '>') return visit(candidate.parent, index - 2);
    for (let ancestor = candidate.parent; ancestor; ancestor = ancestor.parent) if (visit(ancestor, index - 1)) return true;
    return false;
  }
  return visit(node, parts.length - 1);
}

function active(rule, width) {
  return rule.parents.every(parent => {
    if (!parent.startsWith('@media')) return true;
    return [...parent.matchAll(/(min|max)-width:\s*(\d+)px/g)].every(([, bound, value]) => bound === 'min' ? width >= Number(value) : width <= Number(value));
  });
}

function declarations(node, width) {
  const values = {};
  const weights = {};
  for (let order = 0; order < rules.length; order++) {
    const rule = rules[order];
    if (!active(rule, width)) continue;
    for (const selector of rule.header.split(',')) {
      if (!matches(node, selector)) continue;
      const specificity = (selector.match(/\.[\w-]+|:(?!not\()[\w-]+/g) || []).length;
      for (const declaration of rule.body.split(';')) {
        const match = declaration.trim().match(/^([\w-]+):\s*([\s\S]*?)\s*!important$/);
        if (!match) continue;
        const [, property, value] = match;
        const weight = specificity * 10000 + order;
        if ((weights[property] ?? -1) <= weight) { values[property] = value.trim(); weights[property] = weight; }
      }
    }
  }
  return values;
}

const pages = ['my-collection.html', 'index-market.html', 'access-ranking.html', 'ranking.html', 'surge.html', 'growth.html'];
const widths = [320, 375, 390, 430, 560, 700, 701, 768, 900, 901, 1280, 1440];
for (const page of pages) {
  const html = await readFile(path.join(root, page), 'utf8');
  const nodes = parsePage(html);
  assert.ok(nodes.find(node => node.tag === 'body').classes.has('shared-page-layout'), page + ': missing shared layout');
  const targets = Object.fromEntries(['shared-page-content', 'shared-page-heading', 'shared-page-heading-title', 'breadcrumb'].map(name => [name, nodes.find(node => node.classes.has(name))]));
  assert.ok(Object.values(targets).every(Boolean), page + ': incomplete shared structure');
  assert.equal(targets.breadcrumb.parent, targets['shared-page-content'], page + ': breadcrumb must be a direct child of the shared content');
  for (const width of widths) {
    const mobile = width <= 700;
    const label = page + ' at ' + width + 'px';
    const content = declarations(targets['shared-page-content'], width);
    assert.equal(content.width, '100%', label + ': content width');
    assert.equal(content['max-width'], '100%', label + ': content max-width');
    assert.equal(content.padding, mobile ? '0 18px 28px' : '0 48px 64px', label + ': content padding');
    assert.equal(content.margin, '0', label + ': content margin');
    const heading = declarations(targets['shared-page-heading'], width);
    assert.equal(heading['padding-top'], mobile ? '22px' : '26px', label + ': title position');
    assert.equal(heading['padding-bottom'], mobile ? '18px' : '22px', label + ': heading bottom spacing');
    assert.equal(heading['min-height'], '0', label + ': no inherited fixed heading height');
    const title = declarations(targets['shared-page-heading-title'], width);
    assert.equal(title['font-size'], mobile ? '24px' : 'clamp(30px, 3.6vw, 42px)', label + ': title size');
    assert.equal(title['line-height'], mobile ? '1.35' : '1.15', label + ': title line height');
    const breadcrumb = declarations(targets.breadcrumb, width);
    assert.equal(breadcrumb.width, mobile ? '100vw' : '100%', label + ': breadcrumb width');
    assert.equal(breadcrumb.padding, mobile ? '18px 28px 0' : '24px 0 0', label + ': breadcrumb position');
    const outer = nodes.find(node => node.classes.has('dashboard-content'));
    if (outer !== targets['shared-page-content']) {
      assert.equal(declarations(outer, width).padding, '0', label + ': no doubled outer padding');
      assert.equal(declarations(outer, width).width, '100%', label + ': outer width');
    }
    const rankingTop = nodes.find(node => node.classes.has('ranking-page-top'));
    if (rankingTop) {
      assert.equal(declarations(rankingTop, width).padding, '0', label + ': no extra ranking heading offset');
      assert.equal(declarations(rankingTop, width).gap, '0', label + ': no legacy ranking gap');
    }
  }
}
const rankCss = await readFile(path.join(root, 'assets/ranking-redesign.css'), 'utf8');
assert.ok(!/\.(?:dashboard-content|page-shell--market|breadcrumb)(?![-\w])/.test(rankCss), 'Ranking stylesheet must not own shared shell geometry');
assert.ok(!/calc\(100vw - \d+px\)/.test(rankCss), 'Ranking cards and filters must use their parent width');
for (const page of pages) {
  const html = await readFile(path.join(root, page), 'utf8');
  for (const file of [...html.matchAll(/<link\b[^>]*href=["']([^"']+\.css)(?:\?[^"']*)?["']/g)].map(match => match[1])) {
    if (/^https?:/.test(file)) continue;
    const css = await readFile(path.resolve(root, file), 'utf8');
    cssBlocks(css); // Catch unbalanced CSS blocks in every linked local stylesheet.
    if (!file.includes('site.css')) assert.ok(!/@layer\s+shared-page-layout/.test(css), page + ': page stylesheet must not redefine the common layer');
  }
}
console.log('PASS: shared layout across ' + pages.length + ' pages × ' + widths.length + ' widths; shared shell ownership; CSS block balance. Browser rendering is not covered.');
