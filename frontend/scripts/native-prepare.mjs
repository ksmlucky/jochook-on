import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = resolve(root, 'native-preview')
const output = resolve(source, 'dist')
const config = JSON.parse(await readFile(resolve(root, 'capacitor.config.json'), 'utf8'))
if (config.webDir !== 'native-preview/dist' || config.server) {
  throw new Error('Native preparation must use the isolated local preparation screen without a remote server.')
}
await mkdir(output, { recursive: true })
if ((await lstat(output)).isSymbolicLink()) throw new Error('Refusing to write native assets through a symbolic link.')
const files = ['index.html', 'native-preview.css', 'jochook-on.svg']
for (const name of await readdir(output)) {
  if (!files.includes(name)) throw new Error(`Unexpected native bundle file: ${name}. Review the isolated native-preview/dist directory before continuing.`)
}
await copyFile(resolve(source, 'index.html'), resolve(output, 'index.html'))
await copyFile(resolve(source, 'native-preview.css'), resolve(output, 'native-preview.css'))
await copyFile(resolve(root, 'public/icons/jochook-on.svg'), resolve(output, 'jochook-on.svg'))
console.log('Prepared the isolated native screen: native-preview/dist (API and login are not connected).')
