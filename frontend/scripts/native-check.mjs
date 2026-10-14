import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = path => readFile(resolve(root, path), 'utf8')
const config = JSON.parse(await read('capacitor.config.json'))
assert.equal(config.appId, 'com.jochookon.app', 'Review the development app ID before changing it.')
assert.equal(config.appName, '조축ON')
assert.equal(config.webDir, 'native-preview/dist')
assert.equal(config.server, undefined, 'Remote URLs or cleartext settings are outside this preparation stage.')
const packages = JSON.parse(await read('package.json'))
for (const name of ['core', 'android', 'ios']) assert.equal(packages.dependencies[`@capacitor/${name}`], '8.5.3')
assert.equal(packages.devDependencies['@capacitor/cli'], '8.5.3')
const files = ['index.html', 'jochook-on.svg', 'native-preview.css']
assert.deepEqual((await readdir(resolve(root, config.webDir))).sort(), files)
const html = await read(`${config.webDir}/index.html`)
assert.ok(html.includes("connect-src 'none'"), 'The preparation screen must not contact a server.')
assert.ok(html.includes('아직 이 앱에서 사용할 수 없어요'), 'The screen must explain that app features are not connected.')
assert.ok(!/<(?:script|form)\b/i.test(html), 'The preparation screen must not collect credentials or register the PWA worker.')
for (const [name, directory, nativeConfig] of [
  ['Android', 'android/app/src/main/assets/public', 'android/app/src/main/assets/capacitor.config.json'],
  ['iOS', 'ios/App/App/public', 'ios/App/App/capacitor.config.json'],
]) {
  const generated = JSON.parse(await read(nativeConfig))
  // Capacitor adds this iOS plugin list during copy. No plugins are enabled yet.
  if (name === 'iOS') { assert.deepEqual(generated.packageClassList, []); delete generated.packageClassList }
  assert.deepEqual(generated, config, `${name} must use the same local-only configuration.`)
  for (const file of files) {
    assert.equal(await read(`${directory}/${file}`), await read(`${config.webDir}/${file}`), `${name}: ${file} needs cap copy/sync.`)
  }
  console.log(`${name}: project asset copy and local-only configuration verified.`)
}
const manifest = await read('android/app/src/main/AndroidManifest.xml')
assert.ok(!/usesCleartextTraffic\s*=\s*"true"/.test(manifest), 'Android cleartext must remain disabled.')
assert.ok(!(await read('ios/App/App/Info.plist')).includes('NSAllowsArbitraryLoads'), 'iOS must not allow arbitrary insecure loads.')
console.log('Native preparation checks passed. APK/IPA builds, device runs and API authentication are not verified.')
