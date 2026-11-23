/**
 * How long {@link Link.openLink} waits for the Link iframe's `loaded` handshake
 * before emitting `linkLoadFailed`. Link announces `loaded` as soon as its app
 * code starts (before any API call), so this only covers fetching the document
 * and bundle and starting the app. It is generous on purpose: a false positive
 * can push a client to drop a healthy-but-slow session for the backup flow.
 */
export const LINK_LOAD_TIMEOUT_MS = 20000
