/*
 * Four jobs.
 *
 * The instrument in the hero: the app icon, a plate read as a graduated
 * measure, brought to life. A day's meals land in a ledger, the plate fills
 * with their energy, and forty-eight nutrient targets around the bezel tick
 * over as they are met. One dinner is swapped for a better fit, the last two
 * targets close, and the drawing settles into the icon itself.
 *
 * The masthead's rule, which grows out from the ring as the reader scrolls.
 *
 * The title-screen reveal, where the two figures travel from zero.
 *
 * The download details, read from download/build.js so the page never states
 * a size the build does not have.
 */

(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // cubic-bezier(0.2, 0, 0, 1), the app's standard easing: fast out of the
  // gate, long settle. Solved for y at x by bisection.
  function ease(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bez = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bez(mid, 0.2, 0) < x) lo = mid;
      else hi = mid;
    }
    return bez((lo + hi) / 2, 0, 1);
  }

  /** Progress of `t` through [start, end], eased. */
  const phase = (t, start, end) => ease((t - start) / (end - start));

  // ---- reveal -------------------------------------------------------------------

  document.body.classList.add('reveal');

  const REVEAL = 900;
  const DELAY = 160;

  for (const el of document.querySelectorAll('[data-count]')) {
    const target = Number(el.dataset.count);
    if (reduced || !Number.isFinite(target)) continue;
    el.textContent = '0';
    let start = null;
    const tick = (now) => {
      if (start === null) start = now;
      const t = Math.min(1, Math.max(0, (now - start - DELAY) / REVEAL));
      el.textContent = String(Math.round(ease(t) * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---- the masthead's rule ------------------------------------------------------------

  {
    const root = document.documentElement;
    let queued = false;
    const update = () => {
      queued = false;
      const span = root.scrollHeight - innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, scrollY / span)) : 0;
      root.style.setProperty('--progress', p.toFixed(4));
    };
    addEventListener('scroll', () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  // ---- the instrument ---------------------------------------------------------------

  const svg = document.querySelector('.measure__svg');
  if (svg) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (name, attrs = {}, parent = svg) => {
      const node = document.createElementNS(NS, name);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      parent.appendChild(node);
      return node;
    };

    // Geometry, in the 640 x 760 viewBox. The ring, its stroke and the rule
    // keep the icon's proportions (scripts/build_app_icon.py), and the fill
    // level at "on target" is the icon's own level, a little above centre.
    const W = 640;
    const H = 700;
    const CX = 320;
    const CY = 300;
    const R = 150;
    const RING = 13;
    const LEVEL_SPAN = 1.114 * R;
    const TICK_IN = 190;
    const TICK_OUT = 202;
    const LABEL_R = 212;
    const TARGET_KCAL = 2755;

    // The forty-eight targets, in the workbook's order.
    const LABELS = [
      'ENERGY', 'WATER', 'PROTEIN', 'CARB', 'FIBRE', 'FAT −', 'FAT +', 'LA', 'ALA', 'EPA·DHA',
      'HIS', 'ILE', 'LEU', 'LYS', 'MET', 'PHE', 'THR', 'TRP', 'VAL',
      'VIT A', 'VIT D', 'VIT E', 'VIT K', 'VIT C', 'B1', 'B2', 'B3', 'B6', 'B9', 'B12', 'B5', 'B7', 'CHOLINE',
      'CA', 'P', 'MG', 'NA', 'K', 'CL', 'FE', 'ZN', 'CU', 'MN', 'I', 'SE', 'MO', 'CR', 'F',
    ];

    // The day. Figures are the plan's own for Monday, portions included.
    const MEALS = [
      { slot: 'BREAKFAST', name: 'TAMAGOYAKI', kcal: 375, factor: '×1.58' },
      { slot: 'LUNCH', name: 'ERWTENSOEP', kcal: 862, factor: '×1.58' },
      { slot: 'DINNER', name: 'YAKITORI', kcal: 1515, factor: '×1.50' },
      { slot: 'SWAP', name: 'RAMEN', kcal: 1518, factor: '×1.23' },
    ];

    // Which targets each meal closes, in the order they tick over. Energy
    // and the long-chain omega-3 wait for the swap.
    const MET_BY_STAGE = [
      [29, 25, 32, 44, 19, 20, 34, 14, 15, 17, 21],
      [2, 4, 10, 11, 12, 13, 16, 18, 22, 24, 26, 27, 28, 33, 35, 37, 39],
      [1, 3, 5, 6, 7, 8, 23, 30, 31, 36, 38, 40, 41, 42, 43, 45, 46, 47],
      [0, 9],
    ];

    // The timeline, in milliseconds from the top of the loop.
    const T = {
      fadeIn: [0, 400],
      rows: [600, 3200, 5800, 8900],
      levels: [[800, 1900], [3400, 4500], [6000, 7300], [9100, 9900]],
      ticks: [[1000, 1600], [3600, 4400], [6200, 7200], [9500, 9800]],
      pulse: 7600,
      strike: [8600, 8900],
      lock: 9900,
      stamp: 10100,
      fadeOut: [13300, 14000],
      loop: 14000,
    };
    const TYPE_MS = 480;
    const CUMULATIVE = [375, 1237, 2752, 2755];
    const FRACTIONS = CUMULATIVE.map((k) => k / TARGET_KCAL);

    // ---- drawing --------------------------------------------------------------------

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const stage = el('g', { class: 'm-stage' });
    const defs = el('defs', {}, stage);
    el('circle', { cx: CX, cy: CY, r: R }, el('clipPath', { id: 'm-plate' }, defs));
    const clipAbove = el('rect', { x: 0, y: 0, width: W, height: H }, el('clipPath', { id: 'm-above' }, defs));
    const clipBelow = el('rect', { x: 0, y: H, width: W, height: 0 }, el('clipPath', { id: 'm-below' }, defs));

    // The rule, under everything, and knocked out by the labels it crosses.
    const ruleLeft = el('line', { class: 'm-rule', x1: 0, x2: CX - R - RING / 2 }, stage);
    const ruleRight = el('line', { class: 'm-rule', x1: CX + R + RING / 2, x2: W }, stage);

    // The bezel.
    const ticks = [];
    const labels = [];
    for (let i = 0; i < 48; i++) {
      const a = ((-90 + i * 7.5) * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      ticks.push(el('line', {
        class: 'm-tick',
        x1: (CX + TICK_IN * cos).toFixed(2), y1: (CY + TICK_IN * sin).toFixed(2),
        x2: (CX + TICK_OUT * cos).toFixed(2), y2: (CY + TICK_OUT * sin).toFixed(2),
      }, stage));
      const lx = CX + LABEL_R * cos;
      const ly = CY + LABEL_R * sin;
      // Radial, reading outward from the tick, and turned so that both
      // halves read left to right.
      const right = cos >= -0.001;
      const deg = (a * 180) / Math.PI + (right ? 0 : 180);
      const label = el('text', {
        class: 'm-tick-label',
        x: lx.toFixed(2), y: ly.toFixed(2),
        'text-anchor': right ? 'start' : 'end',
        transform: `rotate(${deg.toFixed(2)} ${lx.toFixed(2)} ${ly.toFixed(2)})`,
      }, stage);
      label.textContent = LABELS[i];
      labels.push(label);
    }

    // The plate.
    const fill = el('rect', {
      class: 'm-fill', 'clip-path': 'url(#m-plate)',
      x: CX - R, width: 2 * R, y: CY + R, height: 0,
    }, stage);
    el('circle', { class: 'm-ring', cx: CX, cy: CY, r: R }, stage);

    // The readout, twice: light where the plate is empty, dark where it is
    // filled, so the figure inverts as the level passes through it.
    const readouts = [];
    for (const [cls, clip] of [['m-readout-light', 'm-above'], ['m-readout-dark', 'm-below']]) {
      const g = el('g', { class: cls, 'clip-path': `url(#${clip})` }, stage);
      const small1 = el('text', { class: 'm-readout-small', x: CX, y: CY - 30 }, g);
      small1.textContent = 'KCAL TODAY';
      const big = el('text', { class: 'm-readout-big', x: CX, y: CY + 42 }, g);
      const small2 = el('text', { class: 'm-readout-small', x: CX, y: CY + 74 }, g);
      small2.textContent = `OF ${TARGET_KCAL}`;
      readouts.push(big);
    }

    // The corners.
    const cornerLabel = (x, y, text, anchor) => {
      const node = el('text', { class: 'm-corner', x, y, 'text-anchor': anchor }, stage);
      node.textContent = text;
      return node;
    };
    const cornerValue = (x, y, anchor) => el('text', { class: 'm-corner-value', x, y, 'text-anchor': anchor }, stage);
    cornerLabel(0, 32, 'DAY', 'start');
    const dayValue = cornerValue(0, 54, 'start');
    dayValue.textContent = 'MONDAY';
    cornerLabel(W, 32, 'TARGETS MET', 'end');
    const metValue = cornerValue(W, 54, 'end');

    // The stamp that replaces the counter when every target is met.
    const stamp = el('g', { class: 'm-stamp' }, stage);
    const stampBox = el('rect', { class: 'm-stamp-box', x: W - 112, y: 36, width: 112, height: 26, rx: 2 }, stamp);
    const stampText = el('text', { class: 'm-stamp-text', x: W - 56, y: 49.5 }, stamp);
    stampText.textContent = '48 / 48 MET';
    // Fit the box to the text once fonts are in, whatever size the screen set.
    const fitStamp = () => {
      const width = Math.ceil(stampText.getComputedTextLength()) + 24;
      const height = Math.ceil(parseFloat(getComputedStyle(stampText).fontSize) * 1.9);
      stampBox.setAttribute('width', width);
      stampBox.setAttribute('x', W - width);
      stampBox.setAttribute('height', height);
      stampBox.setAttribute('y', 62 - height);
      stampText.setAttribute('x', W - width / 2);
      stampText.setAttribute('y', 62 - height / 2 + 0.5);
    };
    document.fonts?.ready.then(fitStamp);
    addEventListener('resize', fitStamp);

    // The ledger.
    const ROW_Y = [566, 599, 632, 665];
    const rows = MEALS.map((meal, i) => {
      const y = ROW_Y[i];
      const g = el('g', { class: 'm-row' }, stage);
      const slot = el('text', { class: 'm-row-slot', x: 0, y }, g);
      const name = el('text', { class: 'm-row-name', x: 118, y }, g);
      const cursor = el('rect', { class: 'm-cursor', x: 118, y: y - 11, width: 7, height: 13 }, g);
      const kcal = el('text', { class: 'm-row-figure', x: 520, y }, g);
      const factor = el('text', { class: 'm-row-figure', x: W, y }, g);
      const strike = el('line', { class: 'm-strike', x1: 118, x2: 118, y1: y - 4, y2: y - 4 }, g);
      el('line', { class: 'm-hair', x1: 0, x2: W, y1: y + 12, y2: y + 12 }, g);
      return { meal, g, slot, name, cursor, kcal, factor, strike, shown: null };
    });

    // ---- state from time ---------------------------------------------------------------

    const metAt = new Array(48).fill(Infinity);
    MET_BY_STAGE.forEach((ids, s) => {
      const [start, end] = T.ticks[s];
      ids.forEach((id, i) => {
        metAt[id] = start + ((end - start) * i) / Math.max(1, ids.length - 1);
      });
    });

    function fractionAt(t) {
      let f = 0;
      T.levels.forEach(([start, end], s) => {
        const from = s === 0 ? 0 : FRACTIONS[s - 1];
        if (t >= start) f = from + (FRACTIONS[s] - from) * phase(t, start, end);
      });
      return f;
    }

    let lastMet = -1;
    let lastKcal = -1;
    let lastLocked = null;
    let lastStamp = null;

    function render(t) {
      // The plate.
      const f = fractionAt(t);
      const level = CY + R - f * LEVEL_SPAN;
      fill.setAttribute('y', level.toFixed(2));
      fill.setAttribute('height', Math.max(0, CY + R - level).toFixed(2));
      for (const rule of [ruleLeft, ruleRight]) {
        rule.setAttribute('y1', level.toFixed(2));
        rule.setAttribute('y2', level.toFixed(2));
      }
      clipAbove.setAttribute('height', Math.max(0, level).toFixed(2));
      clipBelow.setAttribute('y', level.toFixed(2));
      clipBelow.setAttribute('height', Math.max(0, H - level).toFixed(2));

      const kcal = Math.round(f * TARGET_KCAL);
      if (kcal !== lastKcal) {
        lastKcal = kcal;
        for (const node of readouts) node.textContent = String(kcal);
      }

      // The bezel.
      let met = 0;
      for (let i = 0; i < 48; i++) {
        const isMet = t >= metAt[i];
        if (isMet) met += 1;
        ticks[i].classList.toggle('is-met', isMet);
        labels[i].classList.toggle('is-met', isMet);
        ticks[i].classList.toggle('is-unmet', !isMet && t >= T.pulse);
      }
      if (met !== lastMet) {
        lastMet = met;
        metValue.textContent = `${met} / 48`;
      }

      // The ledger.
      rows.forEach((row, i) => {
        const start = T.rows[i];
        const typed = Math.max(0, Math.min(1, (t - start) / TYPE_MS));
        const chars = t < start ? 0 : Math.round(typed * row.meal.name.length);
        const shown = row.meal.name.slice(0, chars);
        if (shown !== row.shown) {
          row.shown = shown;
          row.slot.textContent = t < start ? '' : row.meal.slot;
          row.name.textContent = shown;
          const done = chars === row.meal.name.length;
          row.kcal.textContent = done ? `${row.meal.kcal} kcal` : '';
          row.factor.textContent = done ? row.meal.factor : '';
          row.cursor.setAttribute('x', (118 + chars * 7.8 + 2).toFixed(1));
          row.cursor.style.opacity = t >= start && !done ? '1' : '0';
        }
      });
      const struck = phase(t, T.strike[0], T.strike[1]);
      const dinner = rows[2];
      const nameWidth = dinner.meal.name.length * 7.8;
      dinner.strike.setAttribute('x2', (118 + nameWidth * struck).toFixed(1));
      dinner.g.classList.toggle('is-struck', struck >= 1);

      // The lock, and the stamp.
      const locked = t >= T.lock;
      if (locked !== lastLocked) {
        lastLocked = locked;
        svg.classList.toggle('is-locked', locked);
      }
      const stamped = t >= T.stamp;
      if (stamped !== lastStamp) {
        lastStamp = stamped;
        stamp.classList.toggle('is-on', stamped);
        metValue.style.opacity = stamped ? '0' : '1';
      }

      // The loop's seam.
      const opacity = t < T.fadeIn[1]
        ? phase(t, T.fadeIn[0], T.fadeIn[1])
        : t >= T.fadeOut[0] ? 1 - phase(t, T.fadeOut[0], T.fadeOut[1]) : 1;
      stage.style.opacity = opacity.toFixed(3);
    }

    // ---- the clock ----------------------------------------------------------------------

    if (reduced) {
      render(12000);
    } else {
      let running = false;
      let held = false;
      let origin = null;
      let paused = 0;
      let pausedAt = null;

      const frame = (now) => {
        if (!running) return;
        if (origin === null) origin = now;
        render((now - origin - paused) % T.loop);
        requestAnimationFrame(frame);
      };
      const start = () => {
        if (running || held) return;
        running = true;
        if (pausedAt !== null) {
          paused += performance.now() - pausedAt;
          pausedAt = null;
        }
        requestAnimationFrame(frame);
      };
      const stop = () => {
        if (!running) return;
        running = false;
        pausedAt = performance.now();
      };

      // Only runs while it can be seen.
      new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
        threshold: 0.1,
      }).observe(svg);
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
      render(0);

      // For anyone who wants to step through it: hold(t) parks the loop at a
      // moment, release() lets it run again.
      window.gospelMeasure = {
        timeline: T,
        hold(t) {
          held = true;
          stop();
          render(t);
        },
        release() {
          held = false;
          start();
        },
      };
    }
  }

  // ---- the build ------------------------------------------------------------------

  // The file name, size and floor, and the address to fetch it from when it
  // is hosted elsewhere than download/.
  const build = window.GOSPEL_BUILD;
  if (!build || !build.file) return;

  const ANDROID = {
    21: '5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1',
    28: '9', 29: '10', 30: '11', 31: '12', 32: '12', 33: '13', 34: '14', 35: '15', 36: '16',
  };

  const mb = build.bytes ? `${(build.bytes / 1048576).toFixed(1)} MB` : null;
  const android = build.minSdk && ANDROID[build.minSdk]
    ? `Android ${ANDROID[build.minSdk]} and up`
    : null;

  const values = {
    href: build.url || `download/${build.file}`,
    file: build.file,
    size: mb,
    android,
  };

  for (const node of document.querySelectorAll('[data-build]')) {
    const value = values[node.dataset.build];
    if (value == null) continue;
    if (node.dataset.build === 'href') node.setAttribute('href', value);
    else node.textContent = value;
  }
})();
