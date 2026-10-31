// Dev-only: node tools/export-cards.mjs — writes tarot/cards.json from js/data-tarot.js for the Django side.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const src = readFileSync(join(root, 'static', 'js', 'data-tarot.js'), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const cards = ctx.window.AT.CARDS.map(({ id, name, arcana, suit, rank }) => ({ id, name, arcana, suit, rank }));
mkdirSync(join(root, 'tarot'), { recursive: true });
writeFileSync(join(root, 'tarot', 'cards.json'), JSON.stringify(cards, null, 1) + '\n');
console.log(cards.length + ' cards');
