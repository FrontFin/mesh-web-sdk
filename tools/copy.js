import fs from 'fs'

fs.copyFile('package.json', 'dist/package.json', err => {
  if (err) {
    throw err
  }
  console.log('package.json was copied to ./dist folder')
})

fs.copyFile('README.md', 'dist/README.md', err => {
  if (err) {
    throw err
  }
  console.log('README.md was copied to ./dist folder')
})
