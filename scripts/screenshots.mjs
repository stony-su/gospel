/**
 * Screenshots of every page in the app.
 *
 * Drives the web build in headless Chrome over the DevTools Protocol, walks
 * the title screen, the twelve onboarding steps, the four tabs and every
 * detail page, and writes a phone-sized PNG of each into screenshots/. Pages
 * that scroll get a second, full-length capture in screenshots/full/.
 *
 * Node 24 ships a global WebSocket, so this needs no dependencies. It does
 * need the web server up, in production mode so Expo's dev toast stays out of
 * the frame:
 *
 *   npx expo start --web --no-dev --minify
 *   npm run screenshots
 *
 * Two things are worked around rather than driven, because they are web-only
 * gaps in an app built for Android. The sun map picks by `locationX`, which
 * react-native-web supplies to pan responders but not to presses, so that one
 * answer is seeded through the persisted store. And expo-router's tab slot
 * wraps each screen in a view that grows but never shrinks on web, so the tab
 * page runs past the viewport and the bar falls below the fold; the ancestors
 * of each scroll view are allowed to shrink before every capture, which is
 * the layout native produces on its own.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.env.APP_URL ?? 'http://localhost:8081';
const OUT = process.argv[2] ?? 'screenshots';
const PORT = 9333;
const PROFILE = join(process.env.TEMP ?? '.', 'gospel-screenshots-profile');

// A Pixel-sized CSS viewport, rendered at 2x.
const W = 412;
const H = 915;
const DPR = 2;
const STEP_COUNT = 12;

mkdirSync(join(OUT, 'full'), { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--disable-gpu',
    `--window-size=${W},${H}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function finish(code = 0) {
  chrome.kill();
  process.exit(code);
}

process.on('uncaughtException', (error) => {
  console.error(error);
  finish(1);
});
process.on('unhandledRejection', (error) => {
  console.error(error);
  finish(1);
});

// ---- DevTools Protocol -------------------------------------------------------

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) {
          listener(message.params);
        }
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(listener);
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        this.listeners.set(
          method,
          (this.listeners.get(method) ?? []).filter((fn) => fn !== listener),
        );
        resolve(params);
      };
      this.on(method, listener);
    });
  }
}

async function connect() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const version = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (version.ok) break;
    } catch {
      // Not up yet.
    }
    await sleep(100);
  }
  const created = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {
    method: 'PUT',
  });
  const target = await created.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  return new CDP(ws);
}

const cdp = await connect();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

async function viewport(height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height,
    deviceScaleFactor: DPR,
    mobile: true,
  });
}
await viewport(H);

const consoleErrors = [];
cdp.on('Runtime.exceptionThrown', (params) =>
  consoleErrors.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text),
);
cdp.on('Runtime.consoleAPICalled', (params) => {
  if (params.type === 'error') {
    consoleErrors.push(params.args.map((arg) => arg.value ?? arg.description).join(' '));
  }
});

// ---- page helpers -------------------------------------------------------------

async function evaluate(expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return result.value;
}

async function waitFor(expression, { timeout = 30000, label = expression } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

/** Let every ancestor of a scroll view shrink to the viewport. See the header. */
async function fixLayout() {
  await evaluate(`(() => {
    const limit = window.innerHeight + 1;
    for (const scroller of document.querySelectorAll('*')) {
      const style = getComputedStyle(scroller);
      if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
      for (let el = scroller; el && el.id !== 'root'; el = el.parentElement) {
        if (el.getBoundingClientRect().height > limit) {
          el.style.flexShrink = '1';
          el.style.flexBasis = '0%';
          el.style.minHeight = '0';
        }
      }
    }
  })()`);
}

/** Fonts, then the staggered reveal, then a few frames for the last value. */
async function settle(ms = 1400) {
  await evaluate('document.fonts.ready.then(() => true)');
  await fixLayout();
  await sleep(ms);
  await fixLayout();
}

// Finders run inside the page. react-native-web maps accessibilityLabel to
// aria-label and accessibilityRole to role, which is what makes the app
// drivable by the same names its screen reader uses.
const FINDERS = `window.__find = {
  // Stack screens stay mounted beneath the one on top, so the last match in
  // document order is the one the reader can see.
  byLabel: (label) => {
    const all = document.querySelectorAll('[aria-label="' + label.replace(/"/g, '\\\\"') + '"]');
    return all[all.length - 1];
  },
  byLabelLike: (pattern) => [...document.querySelectorAll('[aria-label]')]
    .find((el) => new RegExp(pattern, 'i').test(el.getAttribute('aria-label'))),
  byRole: (role, index) => document.querySelectorAll('[role="' + role + '"]')[index],
  leafWithText: (text) => [...document.querySelectorAll('div, span')]
    .find((el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === text.toLowerCase()),
  // A slider's label sits in a head row beside its readout; the track is the
  // row's full-width next sibling, 28 px tall, with no input inside it.
  trackAfterLabel: (text) => {
    const leafs = [...document.querySelectorAll('div, span')]
      .filter((el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === text.toLowerCase());
    for (const leaf of leafs) {
      for (let el = leaf; el; el = el.parentElement) {
        const sibling = el.nextElementSibling;
        if (!sibling) continue;
        const a = el.getBoundingClientRect();
        const b = sibling.getBoundingClientRect();
        if (Math.abs(a.width - b.width) < 2 && b.height >= 20 && b.height <= 40 && !sibling.querySelector('input')) {
          return sibling;
        }
      }
    }
    return null;
  },
  // The diet spectrum's pan area follows the head row that holds its readout.
  dietTrack: () => {
    const leaf = [...document.querySelectorAll('div, span')]
      .find((el) => el.children.length === 0 && /% animal$/.test(el.textContent.trim()));
    let head = leaf;
    while (head && !head.nextElementSibling) head = head.parentElement;
    return head ? head.nextElementSibling : null;
  },
  rect: (el) => {
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  },
}; true`;

async function rectOf(finder) {
  await evaluate(FINDERS);
  const rect = await evaluate(`window.__find.rect(${finder})`);
  if (!rect) throw new Error(`Element not found: ${finder}`);
  return rect;
}

async function mouse(type, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
}

async function click(finder, fx = 0.5, fy = 0.5) {
  await rectOf(finder);
  await sleep(150); // scrollIntoView
  const r = await rectOf(finder);
  const x = r.x + r.w * fx;
  const y = r.y + r.h * fy;
  await mouse('mouseMoved', x, y);
  await mouse('mousePressed', x, y);
  await sleep(40);
  await mouse('mouseReleased', x, y);
}

const clickLabel = (label) => click(`window.__find.byLabel(${JSON.stringify(label)})`);
const clickLabelLike = (pattern) => click(`window.__find.byLabelLike(${JSON.stringify(pattern)})`);
const clickRole = (role, index) => click(`window.__find.byRole(${JSON.stringify(role)}, ${index})`);
const clickTrack = (label, fraction) =>
  click(`window.__find.trackAfterLabel(${JSON.stringify(label)})`, fraction, 0.5);

async function labelLike(pattern) {
  await evaluate(FINDERS);
  return evaluate(
    `(window.__find.byLabelLike(${JSON.stringify(pattern)}) || {}).getAttribute?.('aria-label') ?? null`,
  );
}

async function goto(path) {
  await cdp.send('Page.navigate', { url: APP + path });
  await cdp.once('Page.loadEventFired');
  await waitFor('document.querySelector("[aria-label], [role]")', {
    label: 'app root',
    timeout: 120000,
  });
  await settle();
}

/** Continue, then wait for the step counter to advance. */
async function nextStep(step) {
  await clickLabel('Continue');
  const counter = `${String(step).padStart(2, '0')} / ${STEP_COUNT}`;
  await waitFor(`window.__find.leafWithText(${JSON.stringify(counter)})`, {
    label: `step ${step}`,
  });
  await settle();
}

let shot = 0;
async function screenshot(name) {
  shot += 1;
  const file = `${String(shot).padStart(2, '0')}-${name}.png`;
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, file), Buffer.from(data, 'base64'));
  console.log(`  ${file}`);

  // A second capture with the viewport stretched to the scroll content, so a
  // long page reads in one image. The ScrollView scrolls inside its own box,
  // not the document, so a taller viewport is the only way to get one.
  const contentHeight = await evaluate(`(() => {
    let max = 0;
    for (const el of document.querySelectorAll('*')) {
      const style = getComputedStyle(el);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        max = Math.max(max, el.scrollHeight + (window.innerHeight - el.clientHeight));
      }
    }
    return max;
  })()`);
  if (contentHeight > H + 40) {
    await viewport(Math.min(contentHeight, 6000));
    await sleep(400);
    await fixLayout();
    await sleep(300);
    const full = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, 'full', file), Buffer.from(full.data, 'base64'));
    await viewport(H);
    await sleep(300);
  }
}

// ---- the walk -------------------------------------------------------------------

console.log('Title screen');
await goto('/');
await evaluate(`localStorage.setItem('gospel-state-v1', JSON.stringify({
  state: {
    answers: {
      sex: null, weight_kg: null, age_years: null, diet_type: null,
      animal_food_fraction: null, activity_level: null,
      sun_zone: 'high_latitude', latitude: 51.5, longitude: -0.1,
      cuisines: [], maxDifficulty: null, maxMinutes: null, weeklyBudget: null,
    },
    onboardingComplete: false,
  },
  version: 0,
})); true`);
await goto('/');
await evaluate(FINDERS);
await waitFor('window.__find.byLabel("Begin")', { label: 'Begin button', timeout: 120000 });
await settle(1800);
await screenshot('title');

console.log('Onboarding');
await clickLabel('Begin');
await waitFor('window.__find.byLabel("Male")', { label: 'first question' });
await settle();

await clickLabel('Male');
await settle(600);
await screenshot('onboarding-01-sex');
await nextStep(2);

await clickTrack('age', 0.19); // 32 on a 16-100 scale
await settle(700);
await screenshot('onboarding-02-age');
await nextStep(3);

await clickTrack('weight', 0.24); // 75 kg on a 35-200 scale
await settle(700);
await screenshot('onboarding-03-weight');
await nextStep(4);

await click('window.__find.dietTrack()', 0.42, 0.5);
await settle(800);
await screenshot('onboarding-04-diet');
await nextStep(5);

await clickRole('radio', 1);
await settle(600);
await screenshot('onboarding-05-activity');
await nextStep(6);

// Seeded above; the crosshair springs to London on its own.
await settle(900);
await screenshot('onboarding-06-sun');
await nextStep(7);

await clickLabel('Italian').catch(() => clickRole('checkbox', 0));
await clickLabel('Japanese').catch(() => clickRole('checkbox', 1));
await settle(600);
await screenshot('onboarding-07-cuisines');
await nextStep(8);

await clickLabel('Standard');
await settle(600);
await screenshot('onboarding-08-difficulty');
await nextStep(9);

await clickTrack('ceiling', 0.2); // 55 min on a 10-240 scale
await settle(700);
await screenshot('onboarding-09-time');
await nextStep(10);

await clickTrack('per week', 0.3); // £90 on a 20-250 scale
await settle(700);
await screenshot('onboarding-10-budget');
await nextStep(11);

await clickRole('radio', 1);
await settle(600);
await screenshot('onboarding-11-cycle');
await nextStep(12);
await settle(2200);
await screenshot('onboarding-12-targets');

await clickLabel('Build my plan');
await waitFor('window.__find.byLabel("Nutrition")', { label: 'tab bar', timeout: 60000 });
await settle(2000);

console.log('Tabs');
await screenshot('plan');

await clickLabel('Nutrition');
await settle(2000);
await screenshot('nutrition');

await clickLabel('Grocery');
await settle(2000);
await screenshot('grocery');
const aisle = await labelLike('^produce$');
if (aisle) {
  await clickLabel(aisle);
  await settle(1500);
  await screenshot('grocery-aisle');
}

await clickLabel('Pantry');
await settle(2000);
await screenshot('pantry');

console.log('Detail pages');
await clickLabel('Plan');
await settle(1500);
const firstMeal = await evaluate(`(() => {
  const row = document.querySelector('[aria-label^="Replace "]');
  return row ? row.getAttribute('aria-label').slice('Replace '.length) : null;
})()`);
if (!firstMeal) throw new Error('No meal rows on the plan');

await clickLabel(firstMeal);
await waitFor('location.pathname.startsWith("/recipe/")', { label: 'recipe route' });
await settle(2000);
await screenshot('recipe');
await clickLabel('Close');
await settle(1200);

await clickLabel(`Replace ${firstMeal}`);
await waitFor('location.pathname.startsWith("/swap/")', { label: 'swap route' });
await settle(2500);
await screenshot('swap');
const topCard = await labelLike('per cent fit$');
if (topCard) {
  await clickLabel(topCard);
  await settle(1600);
  await screenshot('swap-open');
}
await clickLabel('Close');
await settle(1200);

await clickLabel('Nutrition');
await settle(1500);
const category = await labelLike('^macronutrients$');
await clickLabel(category);
await waitFor('location.pathname.startsWith("/nutrition/")', { label: 'category route' });
await settle(2000);
await screenshot('nutrition-category');

const nutrient = await evaluate(`(() => {
  const row = [...document.querySelectorAll('[aria-label]')]
    .find((el) => el.getAttribute('aria-label') !== 'Close' && el.getBoundingClientRect().top > 100);
  return row ? row.getAttribute('aria-label') : null;
})()`);
await clickLabel(nutrient);
await waitFor('location.pathname.startsWith("/nutrient/")', { label: 'nutrient route' });
await settle(2000);
await screenshot('nutrient');

// The nutrient page's sources link does not navigate on web, so open the
// route directly rather than through it.
await goto('/references');
await settle(2500);
await screenshot('references');

console.log('Done.');
if (consoleErrors.length) {
  console.log('\nConsole errors seen:');
  for (const error of consoleErrors.slice(0, 20)) console.log('  -', String(error).split('\n')[0]);
}
finish();
