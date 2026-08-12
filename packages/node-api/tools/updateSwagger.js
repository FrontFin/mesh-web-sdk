// HEADS UP - `pnpm updateApi` will produce a very large, BREAKING diff.
//
// swagger-typescript-api was bumped 12.x -> 13.x during the pnpm migration
// (PRG-324) to clear security advisories, but api.ts was deliberately NOT
// regenerated in that PR. The committed api.ts is therefore still 12.x output.
//
// Regenerating it is a ~10.5k-line diff, and 13.x changes the enum style: v12
// emitted a real `ContentType` enum, v13 (with --enum-style=union, as configured
// in the updateApi script) emits a type-only union. `ContentType.Json` stops
// existing, which is a breaking change for consumers of @meshconnect/node-api.
//
// So: do not fold a regeneration into an unrelated change. It needs its own PR,
// a major version bump and release notes.
//
// Background: https://linear.app/meshconnect/issue/PRG-324
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
