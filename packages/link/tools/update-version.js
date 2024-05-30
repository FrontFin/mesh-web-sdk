import fs from 'fs'

const rawData = fs.readFileSync('package.json')
const packageModel = JSON.parse(rawData)
const version = packageModel?.version || '2.0.0'

fs.writeFileSync(
  'src/utils/version.ts',
  `export const sdkVersion = '${version}'\n`
)
