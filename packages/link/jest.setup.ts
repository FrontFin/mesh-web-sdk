import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// jsdom doesn't implement URL.createObjectURL/revokeObjectURL; the Tier-2 backup
// cascade uses them to load the bundled widget as a blob: URL. Stub them so tests
// can assert the blob:-based swap.
if (typeof URL.createObjectURL !== 'function') {
  let blobSeq = 0
  URL.createObjectURL = jest.fn(() => {
    blobSeq += 1
    return `blob:mock/${blobSeq}`
  })
  URL.revokeObjectURL = jest.fn()
}

// Mock console.error to prevent error logging during tests
global.console.error = jest.fn()
