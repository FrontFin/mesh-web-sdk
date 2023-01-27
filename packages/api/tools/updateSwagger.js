import https from 'https'
import fs from 'fs'
import { exec } from 'child_process'

const swaggerFileUrl =
  'https://front-b2b-api-test.azurewebsites.net/swagger/v1/swagger.json'
const file = fs.createWriteStream('swagger.json')
https.get(swaggerFileUrl, function (response) {
  response.pipe(file)

  file.on('finish', () => {
    file.close()
    console.log('Download swagger file completed')

    const dockerCommand =
      `docker run --rm -v ${process.cwd()}:/local ` +
      'openapitools/openapi-generator-cli generate -i ' +
      '/local/swagger.json -g typescript-axios -o /local ' +
      '--additional-properties=useSingleRequestParameter=true'
    exec(dockerCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`)
        return
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`)
        return
      }
      console.log(`stdout: ${stdout}`)
    })
  })
})
