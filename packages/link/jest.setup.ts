import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock console.error to prevent error logging during tests
global.console.error = jest.fn()
