import { ethers } from 'ethers'
import { EVMProvider } from './types'

// Keep track of the active provider
let activeEVMProvider: ethers.BrowserProvider | null = null
let activeRawProvider: EVMProvider | null = null

export const setActiveEVMProvider = (
  provider: ethers.BrowserProvider,
  rawProvider: EVMProvider
) => {
  activeEVMProvider = provider
  activeRawProvider = rawProvider
}

export const getActiveEVMProvider = () => activeEVMProvider
export const getActiveRawProvider = () => activeRawProvider

export const clearActiveProviders = () => {
  activeEVMProvider = null
  activeRawProvider = null
}
