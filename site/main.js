/*
 * Two jobs. The title-screen reveal, where the two figures travel from zero
 * the way every number in the app does, and the download details, read from
 * download/build.js so the page never states a size or checksum the build
 * does not have.
 */

(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- reveal -------------------------------------------------------------------

  document.body.classList.add('reveal');

  // cubic-bezier(0.2, 0, 0, 1), the app's standard easing: fast out of the
  // gate, long settle. Solved for y at x by bisection, which is plenty for a
  // number that only needs to look right.
  function ease(x) {
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

  const REVEAL = 900;
  const DELAY = 160; // the figures land third, after the doctrine and the lede

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

  // ---- the build ------------------------------------------------------------------

  const build = window.GOSPEL_BUILD;
  if (!build || !build.file) return;

  // API level -> the version a reader knows it by.
  const ANDROID = {
    21: '5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1',
    28: '9', 29: '10', 30: '11', 31: '12', 32: '12', 33: '13', 34: '14', 35: '15', 36: '16',
  };

  const mb = build.bytes ? `${(build.bytes / 1048576).toFixed(1)} MB` : null;
  const android = build.minSdk && ANDROID[build.minSdk]
    ? `Android ${ANDROID[build.minSdk]} and up`
    : null;
  const androidLong = build.minSdk && ANDROID[build.minSdk]
    ? `Android ${ANDROID[build.minSdk]} (API ${build.minSdk}) and up`
    : null;
  const built = build.builtAt
    ? new Date(build.builtAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const values = {
    href: build.url || `download/${build.file}`,
    file: build.file,
    version: build.version ?? null,
    size: mb,
    bytes: mb && build.bytes ? `${mb} (${build.bytes.toLocaleString('en-GB')} bytes)` : mb,
    android,
    'android-long': androidLong,
    abis: Array.isArray(build.abis) ? build.abis.join(', ') : null,
    built,
    sha256: build.sha256 ?? null,
  };

  for (const el of document.querySelectorAll('[data-build]')) {
    const value = values[el.dataset.build];
    if (value == null) continue;
    if (el.dataset.build === 'href') el.setAttribute('href', value);
    else el.textContent = value;
  }
})();
