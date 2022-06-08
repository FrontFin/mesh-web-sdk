import localforage from 'localforage'

const nonceKey = 'front-nonce'
export async function generateAndSaveNonce(): Promise<string> {
  const nonce = Math.random().toString(16).substr(2)
  await localforage.setItem(nonceKey, nonce)
  return nonce
}

export async function validateNonce(nonce: string): Promise<boolean> {
  const savedNonce = await localforage.getItem<string>(nonceKey)
  if (!savedNonce) {
    return false
  }

  await localforage.removeItem(nonceKey)
  const isNonceValid = savedNonce === nonce
  if (isNonceValid) {
    console.warn('Front nonce is not valid')
  }

  return isNonceValid
}
