import crypto from 'node:crypto'
import tls from 'node:tls'

const HOST = 'speech.platform.bing.com'
const BASE_PATH = '/consumer/speech/synthesize/readaloud/edge/v1'
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`
const EXTENSION_ORIGIN = process.env.EDGE_TTS_EXTENSION_ORIGIN || 'chrome-extension://gdmejpkonanmppgfhkbepklggkickdbh'
const WINDOWS_EPOCH_SECONDS = 11_644_473_600n
const SEC_MS_GEC_WINDOW_SECONDS = 300n
const TICKS_PER_SECOND = 10_000_000n

const probes = [
  {
    name: 'page-origin',
    origin: 'https://www.tool-ui.com',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  },
  {
    name: 'page-origin+protocol',
    origin: 'https://www.tool-ui.com',
    protocol: 'synthesize',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  },
  {
    name: 'extension-origin',
    origin: EXTENSION_ORIGIN,
    protocol: 'synthesize',
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`,
    extraHeaders: {
      'Sec-CH-UA': `" Not;A Brand";v="99", "Microsoft Edge";v="${CHROMIUM_FULL_VERSION.split('.')[0]}", "Chromium";v="${CHROMIUM_FULL_VERSION.split('.')[0]}"`,
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
    },
  },
  {
    name: 'extension-origin-no-protocol',
    origin: EXTENSION_ORIGIN,
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`,
  },
  {
    name: 'extension-origin-chrome-matching-ua',
    origin: EXTENSION_ORIGIN,
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36`,
  },
  {
    name: 'extension-origin-chrome-newer-ua',
    origin: EXTENSION_ORIGIN,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  },
  {
    name: 'page-origin-edge-matching-ua',
    origin: 'https://www.tool-ui.com',
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`,
  },
]

for (const probe of probes) {
  // eslint-disable-next-line no-await-in-loop
  const result = await probeHandshake(probe)
  console.log(JSON.stringify(result))
}

async function probeHandshake(probe) {
  const secMsGec = await generateSecMsGec()
  const connectionId = crypto.randomUUID().replace(/-/g, '')
  const path = `${BASE_PATH}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${encodeURIComponent(SEC_MS_GEC_VERSION)}&ConnectionId=${connectionId}`
  const key = crypto.randomBytes(16).toString('base64')
  const headers = {
    Host: HOST,
    Connection: 'Upgrade',
    Upgrade: 'websocket',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': key,
    Origin: probe.origin,
    'User-Agent': probe.userAgent || 'Mozilla/5.0',
    Accept: '*/*',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    ...(probe.protocol ? { 'Sec-WebSocket-Protocol': probe.protocol } : {}),
    ...(probe.extraHeaders || {}),
  }

  const request = [
    `GET ${path} HTTP/1.1`,
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    '',
    '',
  ].join('\r\n')

  return new Promise((resolve) => {
    const socket = tls.connect({
      host: HOST,
      port: 443,
      servername: HOST,
      ALPNProtocols: ['http/1.1'],
    }, () => {
      socket.write(request)
    })

    let buffer = ''
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve({
        name: probe.name,
        ok: false,
        error: 'timeout',
      })
    }, 10_000)

    socket.setEncoding('utf8')
    socket.on('data', (chunk) => {
      buffer += chunk
      if (!buffer.includes('\r\n\r\n')) return
      clearTimeout(timeout)
      const headerBlock = buffer.slice(0, buffer.indexOf('\r\n\r\n'))
      const [statusLine, ...rest] = headerBlock.split('\r\n')
      const statusMatch = /^HTTP\/1\.1\s+(\d+)/.exec(statusLine)
      const status = statusMatch ? Number(statusMatch[1]) : null
      const responseHeaders = Object.fromEntries(rest.map((line) => {
        const index = line.indexOf(':')
        if (index < 0) return [line, '']
        return [line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim()]
      }))
      socket.destroy()
      resolve({
        name: probe.name,
        ok: status === 101,
        status,
        responseHeaders,
        firstBytes: buffer.slice(0, 256),
      })
    })

    socket.on('error', (error) => {
      clearTimeout(timeout)
      resolve({
        name: probe.name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  })
}

async function generateSecMsGec() {
  const unixSeconds = BigInt(Math.floor(Date.now() / 1000))
  const roundedSeconds = unixSeconds - (unixSeconds % SEC_MS_GEC_WINDOW_SECONDS)
  const windowsTicks = (roundedSeconds + WINDOWS_EPOCH_SECONDS) * TICKS_PER_SECOND
  const hashInput = `${windowsTicks}${TRUSTED_CLIENT_TOKEN}`
  return crypto.createHash('sha256').update(hashInput).digest('hex').toUpperCase()
}
