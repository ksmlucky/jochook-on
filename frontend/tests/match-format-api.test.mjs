import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'

const sourceRoot = new URL('../src/', import.meta.url).href
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && existsSync(new URL(`${specifier}.ts`, context.parentURL))) return nextResolve(`${specifier}.ts`, context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true }
    return nextLoad(url, context)
  },
})
const { suggestLineup, previewMatchWorkbook, downloadMatchTemplate } = await import('../src/features/matches/api.ts')
const { configureTeamAccess } = await import('../src/features/auth/teamRequest.ts')
hooks.deregister()

function setup(t) {
  const oldWindow=globalThis.window,oldDocument=globalThis.document
  globalThis.window=new EventTarget()
  globalThis.document={createElement:()=>({click(){}})}
  configureTeamAccess({username:'fixture-coach',role:'COACH',authType:'ACCOUNT',serviceAdmin:false,team:{id:11},teams:[]})
  const mock=t.mock.method(globalThis,'fetch',async path=>path==='/api/v1/auth/csrf'?Response.json({headerName:'X-CSRF-TOKEN',token:'fixture'}):path.includes('/template?')?new Response(new Blob(['fixture'])):Response.json({plannedLineup:[],rows:[],valid:true}))
  t.after(()=>{configureTeamAccess(null);globalThis.window=oldWindow;globalThis.document=oldDocument})
  return mock
}

test('lineup suggestion explicitly sends halves while a legacy caller omits the format',async t=>{
  const mock=setup(t),signal=new AbortController().signal
  await suggestLineup('2026-10-15',[1,2],null,5,signal,'F352','TWO_HALVES_30')
  await suggestLineup('2026-10-15',[1,2],null,5,signal,'F352')
  const requests=mock.mock.calls.filter(call=>call.arguments[0].endsWith('/lineup-suggestion'))
  assert.equal(JSON.parse(requests[0].arguments[1].body).matchFormat,'TWO_HALVES_30')
  assert.equal('matchFormat' in JSON.parse(requests[1].arguments[1].body),false)
  assert.ok(requests.every(call=>call.arguments[1].headers.get('X-Team-Id')==='11'))
})

test('workbook template and preview agree on selected format and preserve legacy URLs',async t=>{
  const mock=setup(t),file=new File(['fixture'],'fixture.xlsx')
  await previewMatchWorkbook(file,'F343','TWO_HALVES_30')
  await downloadMatchTemplate('F343','TWO_HALVES_30')
  await previewMatchWorkbook(file,'F343')
  await downloadMatchTemplate('F343')
  assert.deepEqual(mock.mock.calls.map(call=>call.arguments[0]).filter(path=>path.includes('/import/')),[
    '/api/v1/matches/import/preview?formation=F343&matchFormat=TWO_HALVES_30',
    '/api/v1/matches/import/template?formation=F343&matchFormat=TWO_HALVES_30',
    '/api/v1/matches/import/preview?formation=F343',
    '/api/v1/matches/import/template?formation=F343',
  ])
})
