// HTTP and file I/O only; all behaviour lives in the tested modules beside this file.
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname } from 'node:path'
import { createApi, EMPTY_STATE, recoverSending } from './api.ts'
import { createRobotLink } from './robotLink.ts'
import { createRosBridge } from './rosbridge.ts'

const PORT = Number(process.env.BOONG_SERVER_PORT ?? 8787)
const DATA_FILE = process.env.BOONG_DATA_FILE ?? '.boong-data/state.json'
const ROSBRIDGE_URL = process.env.ROSBRIDGE_URL ?? 'ws://localhost:9090'
const BODY_LIMIT = 64 * 1024

function load() {
  if (!existsSync(DATA_FILE)) return EMPTY_STATE
  // A broken file stops the server rather than being overwritten with an empty day.
  return recoverSending({ ...EMPTY_STATE, ...JSON.parse(readFileSync(DATA_FILE, 'utf8')) })
}

function save(state) {
  mkdirSync(dirname(DATA_FILE), { recursive: true })
  const temp = `${DATA_FILE}.tmp`
  writeFileSync(temp, JSON.stringify(state))
  renameSync(temp, DATA_FILE)
}

let state = load()
const store = {
  get: () => state,
  update(change) {
    const next = change(state)
    if (next === state) return
    state = next
    save(state)
  },
}

const bridge = createRosBridge({ url: ROSBRIDGE_URL, createSocket: (url) => new WebSocket(url) })
const link = createRobotLink(bridge, store, () => Date.now())
const api = createApi(store, link, () => new Date(), randomUUID)

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    let chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > BODY_LIMIT) reject(Object.assign(new Error('too large'), { status: 413 }))
      else chunks = [...chunks, chunk]
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function respond(req) {
  const path = new URL(req.url, 'http://localhost').pathname
  if (req.method === 'GET') return api('GET', path, null)
  // Browsers cannot send JSON cross-site without a preflight this server never answers.
  if (!req.headers['content-type']?.startsWith('application/json')) return { status: 415, body: { error: 'JSON만 받아요' } }
  return api(req.method, path, JSON.parse(await readBody(req)))
}

createServer(async (req, res) => {
  const { status, body } = await respond(req).catch((e) => {
    if (e.status !== 413 && !(e instanceof SyntaxError)) console.error('요청 처리 실패:', e)
    return { status: e.status ?? (e instanceof SyntaxError ? 400 : 500), body: { error: '요청을 처리하지 못했어요' } }
  })
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}).listen(PORT, '127.0.0.1', () => {
  console.info(`붕붕 서버 http://127.0.0.1:${PORT} → ${ROSBRIDGE_URL}, 저장: ${DATA_FILE}`)
})
