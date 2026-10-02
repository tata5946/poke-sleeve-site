import { readFile } from 'node:fs/promises';
import { createContext, runInContext, Script } from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const html = await readFile(new URL('../admin-article-editor.html', import.meta.url), 'utf8');
for (const [, attributes, source] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!/src=|application\//.test(attributes)) new Script(source, { filename: fileURLToPath(new URL('../admin-article-editor.html', import.meta.url)) });
}
function functionSource(name, next) {
  const start = html.indexOf(`    function ${name}(`);
  const end = html.indexOf(`    function ${next}(`, start);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end);
}
function node() {
  const classes = new Set();
  const handlers = {};
  return { style: {}, dataset: {}, handlers, nodeType: 1,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
      toggle(name) { classes.has(name) ? classes.delete(name) : classes.add(name); } },
    setAttribute() {}, addEventListener(name, callback) { (handlers[name] ||= []).push(callback); },
    dispatch(name, event = {}) { for (const callback of handlers[name] || []) callback({ preventDefault() {}, stopPropagation() {}, ...event }); },
    contains: () => false, querySelectorAll: () => [] };
}

// Move both page and nested scrolling surfaces while the selection stays in the same paragraph.
const editor = node();
const created = [];
const window = { ...node(), scrollX: 0, scrollY: 0 };
let caretDocumentTop = 800;
editor.getBoundingClientRect = () => ({ left: 100 - window.scrollX, top: 600 - window.scrollY });
const document = { ...node(), activeElement: editor, createElement: () => {
  const element = node();
  element.getBoundingClientRect = () => ({ top: parseFloat(element.style.top) - window.scrollY,
    right: parseFloat(element.style.left) - window.scrollX + 34 });
  return element;
}, body: { appendChild: element => created.push(element) } };
const inserterContext = createContext({ window, document, qs: () => editor, getEditorSelection: () => ({ isCollapsed: true }),
  getSelectionRect: () => ({ top: caretDocumentTop - window.scrollY }), insertBlock() {} });
runInContext(functionSource('initBlockInserter', 'initNoteLikeWritingSurface') + '\ninitBlockInserter();', inserterContext);
const [button, menu] = created;
editor.dispatch('focus');
assert.equal(button.style.top, '793px');
button.dispatch('click');
assert.equal(menu.style.top, '793px');
window.scrollY = 900;
window.dispatch('scroll');
assert.equal(button.style.top, '793px', 'The button keeps its document position instead of sticking to the viewport');
assert.equal(button.getBoundingClientRect().top, -107, 'The button scrolls out of view with the paragraph');
assert.equal(menu.style.top, '793px', 'The open menu follows the paragraph');
caretDocumentTop -= 200;
window.dispatch('scroll');
assert.equal(button.style.top, '593px', 'Nested scrolling updates the paragraph position');
assert.equal(menu.style.top, '593px');
window.scrollX = 40;
window.dispatch('resize');
assert.equal(button.style.left, '52px', 'Horizontal page scrolling preserves the document position');
assert.match(html, /\.block-insert-button \{\s*position: absolute;/);
assert.match(html, /\.block-insert-menu \{\s*position: absolute;/);

function tableHarness(columnCount) {
  const editor = node();
  const window = { ...node(), getSelection: () => ({ anchorNode: null }) };
  const table = node();
  const row = node();
  row.children = Array.from({ length: columnCount }, () => node());
  table.rows = [row];
  table.querySelectorAll = () => [row];
  table.getBoundingClientRect = () => ({ left: 100, right: 100 + (parseFloat(table.style.width) || 600),
    top: 100, bottom: 200, width: parseFloat(table.style.width) || 600 });
  for (const [index, cell] of row.children.entries()) {
    cell.parentElement = row;
    cell.getAttribute = () => null;
    cell.closest = selector => selector === 'table' ? table : selector === 'tr' ? row : cell;
    cell.getBoundingClientRect = () => {
      const total = table.getBoundingClientRect().width;
      const width = parseFloat(cell.style.width) ? total * parseFloat(cell.style.width) / 100 : total / columnCount;
      const left = 100 + row.children.slice(0, index).reduce((sum, previous) => sum + previous.getBoundingClientRect().width, 0);
      return { left, right: left + width, width, top: 100, bottom: 200 };
    };
  }
  editor.contains = target => row.children.includes(target);
  const context = createContext({ window, document: { ...node(), getElementById: () => null, createElement: node,
    body: { style: {}, appendChild() {} } }, qs: () => editor, Node: { TEXT_NODE: 3 },
    requestAnimationFrame: callback => callback(), updatePreview() {}, setStatus() {} });
  runInContext(functionSource('initTableEditingTools', 'insertCodeBlock') + '\ninitTableEditingTools();', context);
  return { editor, window, table, row };
}
const twoColumns = tableHarness(2);
const rightCell = twoColumns.row.children[1];
twoColumns.editor.dispatch('pointerdown', { target: rightCell, clientX: 699, clientY: 150 });
twoColumns.window.dispatch('pointermove', { target: rightCell, clientX: 799, clientY: 150 });
assert.equal(twoColumns.table.style.width, '700px');
assert.ok(Math.abs(twoColumns.row.children[0].getBoundingClientRect().width - 300) < .01, 'Right-edge dragging preserves earlier column widths');
assert.ok(Math.abs(rightCell.getBoundingClientRect().width - 400) < .01);
twoColumns.window.dispatch('pointerup');
twoColumns.editor.dispatch('pointerdown', { target: twoColumns.row.children[0], clientX: 400, clientY: 150 });
twoColumns.window.dispatch('pointermove', { target: rightCell, clientX: 450, clientY: 150 });
assert.equal(twoColumns.table.style.width, '700px', 'Internal dividers keep the overall table width');
assert.ok(Math.abs(rightCell.getBoundingClientRect().width - 350) < .01);
twoColumns.window.dispatch('pointercancel');
assert.ok(!twoColumns.editor.classList.contains('is-resizing-table'));
const oneColumn = tableHarness(1);
oneColumn.editor.dispatch('pointerdown', { target: oneColumn.row.children[0], clientX: 699, clientY: 150 });
oneColumn.window.dispatch('pointermove', { clientX: -301, clientY: 150 });
assert.equal(oneColumn.table.style.width, '54px', 'Single-column tables can shrink to the minimum column width');
assert.equal(oneColumn.table.style.minWidth, '54px');
console.log('PASS: editor scripts parse; insert button/menu follow page and nested scrolling; right-edge resizing preserves earlier columns; internal resizing and pointer cancellation; minimum width for single-column tables. Browser rendering is not covered.');
