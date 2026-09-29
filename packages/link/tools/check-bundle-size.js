#!/usr/bin/env node
/*
 * CI guard for the Tier-2 backup bundle size budget (OR-475 / design §5H, §11
 * Decision 8).
 *
 * The shipped Tier-2 asset is the single self-contained widget.offline.html
 * (shell + inlined catalog snapshot + top-N logos). Measured budget (2026-09):
 * ~43 KB gzip. The full logo set (~1.25 MB gzip) must NEVER be inlined. This
 * script enforces a gzip cap and a raw cap on the shipped HTML, a hard cap on the
 * number of inlined logos (read from the co-vendored snapshot), that the HTML is
 * self-contained, and that the committed generated.ts is in sync with it.
 */
import fs from 'fs'
import zlib from 'zlib'
import {
  generate,
  HTML_PATH,
  SNAPSHOT_PATH,
  OUT_PATH
} from './embed-backup-bundle.js'

const KB = 1024

// Caps sit above the measured sizes with headroom, but far below anything
// resembling the full logo set — the point is to catch a regression (e.g. the
// whole logo catalog leaking in), not to shave bytes.
const LIMITS = {
  widgetGzip: 52 * KB, // ~43 KB gz measured (shell + names catalog + top-16 logos)
  widgetRaw: 300 * KB, // ~138 KB raw measured; full logo set would be ~MBs
  maxLogos: 24 // top-8/8 = 16; `N` tunable, but never the full set
}

const gzipBytes = str => zlib.gzipSync(Buffer.from(str, 'utf8')).length
const fmt = n => `${(n / KB).toFixed(1)} KB`

const failures = []
function check(ok, msg) {
  console.log(`${ok ? '  ✅' : '  ❌'} ${msg}`)
  if (!ok) failures.push(msg)
}

console.log('Checking Tier-2 backup bundle budget… 📏')

if (!fs.existsSync(HTML_PATH)) {
  console.error(`Missing bundle file: ${HTML_PATH} ❌`)
  process.exit(1)
}

const html = fs.readFileSync(HTML_PATH, 'utf8')
const widgetGz = gzipBytes(html)

check(
  widgetGz <= LIMITS.widgetGzip,
  `offline widget: ${fmt(widgetGz)} gz (limit ${fmt(LIMITS.widgetGzip)})`
)
check(
  html.length <= LIMITS.widgetRaw,
  `offline widget: ${fmt(html.length)} raw (limit ${fmt(LIMITS.widgetRaw)})`
)
check(
  !/(src|href)\s*=\s*["']https?:/i.test(html),
  'offline widget is self-contained (no external http(s) references)'
)

// Logo cap is read from the co-vendored snapshot (the source the HTML inlines).
if (fs.existsSync(SNAPSHOT_PATH)) {
  let logoCount = null
  try {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
    logoCount = Object.keys(snapshot.logos || {}).length
  } catch (e) {
    check(false, `catalog.snapshot.json is not valid JSON: ${e.message}`)
  }
  if (logoCount !== null) {
    check(
      logoCount <= LIMITS.maxLogos,
      `inlined logos: ${logoCount} (limit ${LIMITS.maxLogos} — full logo set must never bundle)`
    )
  }
} else {
  check(
    false,
    `Missing ${SNAPSHOT_PATH} (co-vendored snapshot for the logo cap)`
  )
}

// generated.ts must match a fresh projection of the vendored HTML.
let inSync = false
try {
  const { content } = generate()
  const committed = fs.existsSync(OUT_PATH)
    ? fs.readFileSync(OUT_PATH, 'utf8')
    : ''
  inSync = committed === content
} catch (e) {
  console.error(`  ❌ could not regenerate bundle module: ${e.message}`)
}
check(
  inSync,
  'generated.ts in sync with widget.offline.html (run `pnpm bundle:embed` if this fails)'
)

console.log(
  `\nShipped Tier-2 bundle: ${fmt(widgetGz)} gz / ${fmt(html.length)} raw.`
)

if (failures.length) {
  console.error(`\nBundle budget check FAILED (${failures.length}) ❌`)
  process.exit(1)
}
console.log('Bundle budget check passed ✅')
