import https from 'https'
import fs from 'fs'

const swaggerFileUrl =
  'https://integration-api.meshconnect.com/swagger/v1/swagger.json'
const file = fs.createWriteStream('swagger.json')
https.get(swaggerFileUrl, function (response) {
  response.pipe(file)

  file.on('finish', () => {
    file.close()
    console.log('Download swagger file completed')
  })
})
