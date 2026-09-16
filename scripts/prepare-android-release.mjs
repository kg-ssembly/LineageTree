import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(scriptDirectory, '..')

const readJson = (fileName) => {
  const filePath = path.join(projectDirectory, fileName)
  return {
    filePath,
    value: JSON.parse(fs.readFileSync(filePath, 'utf8')),
  }
}

const writeJson = ({ filePath, value }) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

const bumpPatchVersion = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) {
    throw new Error(`Expected a stable semantic version, received: ${version}`)
  }

  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

const appConfig = readJson('app.json')
const packageConfig = readJson('package.json')
const lockConfig = readJson('package-lock.json')

const currentVersion = appConfig.value.expo.version
const packageVersion = packageConfig.value.version

if (packageVersion !== currentVersion) {
  throw new Error(
    `Version mismatch: app.json is ${currentVersion}, package.json is ${packageVersion}. Sync them before building.`,
  )
}

const nextVersion = bumpPatchVersion(currentVersion)

appConfig.value.expo.version = nextVersion
packageConfig.value.version = nextVersion
lockConfig.value.version = nextVersion
if (lockConfig.value.packages?.['']) {
  lockConfig.value.packages[''].version = nextVersion
}

writeJson(appConfig)
writeJson(packageConfig)
writeJson(lockConfig)

console.log(`Prepared Android release ${nextVersion}.`)
console.log('EAS will assign the next Android versionCode using remote auto-increment.')
