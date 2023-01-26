export const clientId = process.env.REACT_APP_CLIENT_ID as string
// added only for example, please do not add your secrects to the frontend code
const clientSecret = process.env.REACT_APP_CLIENT_SECRET as string
export const frontApiUrl = process.env.REACT_APP_FRONT_API_URL as string

export const headers = {
  Accept: '*/*',
  Connection: 'keep-alive',
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip, deflate, br',
  'X-Client-Id': clientId,
  'X-Client-Secret': clientSecret
}
