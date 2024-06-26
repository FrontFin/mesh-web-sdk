import fs from 'fs'

const rawData = fs.readFileSync('package.json')
const packageModel = JSON.parse(rawData)
delete packageModel.main
delete packageModel.module
delete packageModel.types
delete packageModel.scripts
delete packageModel.type

packageModel.exports = './index.js'
packageModel.module = './index.js'
packageModel.main = './index.js'
packageModel.types = './index.d.ts'

const versionFromNodeApi = fs.readFileSync('../node-api/package.json')
const version = JSON.parse(versionFromNodeApi).version

packageModel.dependencies['@meshconnect/node-api'] = `^${version}`

const data = JSON.stringify(packageModel, null, 2)
fs.writeFileSync('dist/package.json', data)
console.log('package.json.dist was copied to ./dist folder')

fs.copyFileSync('README.md', 'dist/README.md')
console.log('README.md was copied to ./dist folder')
