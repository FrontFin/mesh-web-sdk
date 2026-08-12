// Moved out of package.json so transformIgnorePatterns can carry the explanation
// below. Three separate reviewers have read that regex as "transforms the whole
// dependency tree", so it needs the comment more than it needs to be inline.
//
// Jest tests transformIgnorePatterns against the RESOLVED (realpath) filename and
// the regex is UNANCHORED, so every `/node_modules/` boundary in a path is tried
// and the file is ignored if ANY of them matches.
//
// Under pnpm a dependency path has two boundaries:
//
//   /repo/node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/index.js
//                    ^1 next segment: .pnpm/          ^2 next segment: lodash/
//
// The `\.pnpm/` alternative suppresses the match at boundary 1. Without it,
// boundary 1 matches for EVERY dependency (`.pnpm` is in nobody's allowlist), so
// every ESM dep is ignored, goes untransformed, and dies with "Cannot use import
// statement outside a module" - the allowlist becomes dead code.
//
// The allowlist then does the real work at boundary 2:
//   - lodash  -> not listed -> boundary 2 matches -> ignored (NOT transformed)
//   - ethers  -> listed     -> no boundary matches -> transformed
//
// So the allowlist is fully live; `.pnpm/` only stops the store directory itself
// from being mistaken for a package name.
//
// Do NOT "simplify" this into an optional prefix group, e.g.
//   /node_modules/(?!(\.pnpm/[^/]+/node_modules/)?(<allowlist>)/)
// That form looks tidier but breaks for allowlisted packages reached through
// pnpm's hoisted alias directory (node_modules/.pnpm/node_modules/<pkg>), where
// the `[^/]+/node_modules/` prefix does not match and boundary 1 then ignores the
// file.
//
// Under yarn's flat layout only boundary 2 exists, so behaviour is unchanged.
const ESM_DEPS = [
  String.raw`@meshconnect/solana-web3\.js`,
  'uuid',
  'jayson',
  'superstruct',
  '@noble',
  '@meshconnect',
  'ethers'
]

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['./jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageDirectory: './coverage',
  transform: {
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      { presets: ['@babel/preset-env', '@babel/preset-typescript'] }
    ]
  },
  transformIgnorePatterns: [
    String.raw`/node_modules/(?!\.pnpm/|(${ESM_DEPS.join('|')})/)`
  ],
  testEnvironmentOptions: { url: 'http://localhost/' }
}
