import WebSocket from 'ws'
import http from 'http'
import express from 'express'
import session from 'express-session'
import path from 'path'
import { engine } from 'express-handlebars'
import frameguard from 'frameguard'
import { v4 as uuid4 } from 'uuid'
import morgan from 'morgan'

import Channel, { ChannelOptions } from './lib/channel'

const app = express()
const wss = new WebSocket.Server({ clientTracking: false, noServer: true })
const sessionParser = session({
  saveUninitialized: false,
  secret: process.env.APP_SECRET || '$ecReT',
  resave: false,
})

const publicDir = path.resolve(__dirname, '../public')

///
// HTTP server, just demo sketches for now
///

app.use(express.static(publicDir))
app.use(sessionParser)
app.use(morgan('combined'))

// templates
app.engine('.hbs', engine({ extname: '.hbs' }))
app.set('view engine', '.hbs')
app.set('views', './views')

app.use(frameguard({ action: 'sameorigin' }))
app.disable('x-powered-by')

app.get('/', (_, res) => {
  res.header('x-frame-options', 'SAMEORIGIN')
  res.render('home', { layout: 'sketches' })
})

app.get('/sketch/:name', (req, res) => {
  res.header('x-frame-options', 'SAMEORIGIN')

  let height = req.query.height || '500'
  if (req.params.name === 'battle-spots') {
    height = '720'
  }

  res.render('sketch', {
    layout: 'sketches',
    name: req.params.name,
    height: height,
  })
})

app.get('/embed/:name', (req, res) => {
  res.header('x-frame-options', 'SAMEORIGIN')
  res.render('embed', { layout: 'embed', name: req.params['name'] })
})

const server = http.createServer(app)

// Each channel lives in its own isolated namespace.
//
// If we wanted to make this a distributed system, we'd separate the websocket
// service from Channels. The top level channel collection would subscribe to
// a message bus that all other instances of the websocket server subscribe
// to.
type PathChannel = {
  path: string
  sockets: Channel
}
const channels: Record<string, PathChannel> = {}

const defaultOptions: Record<string, string | boolean> = {
  echo: true,
  receiver: true,
  controller: true,
}

function parsedOptions(queryObject: URLSearchParams): ChannelOptions {
  const options: Record<string, string | boolean> = Object.assign(
    {},
    defaultOptions,
    queryObject
  )

  // coerce options to boolean
  for (const [k, v] of Object.entries(options)) {
    if (v === 'true' || v === true || v === '1') {
      options[k] = true
    } else {
      options[k] = false
    }
  }

  return options as ChannelOptions
}

server.on('upgrade', function (request, socket, head) {
  // get path
  const parsedUrl = new URL(request.url || '/')
  const pathname = parsedUrl.pathname
  const options = parsedOptions(parsedUrl.searchParams)

  if (!channels[pathname]) {
    console.log('starting sketch at', pathname)
    channels[pathname] = {
      path: pathname,
      sockets: new Channel(),
    }
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    // console.log("handling upgrade with options", options);
    wss.emit('connection', ws, request, options)
  })
})

wss.on(
  'connection',
  function (ws: WebSocket, req: http.IncomingMessage, options: ChannelOptions) {
    console.log("on('connection') with options", options)
    if (!req.url) return

    const uid = uuid4()

    const pathname = new URL(req.url).pathname
    const sketch = channels[pathname]
    if (!sketch) {
      // unrecognized!
      console.error('unrecognized path:', pathname, 'closing session')
      ws.close()
      return
    }

    const { sockets } = sketch
    sockets.addConnection(ws, req, uid, options)

    ws.on('message', (data) => {
      // console.log("msg in", data);
      sockets.onMessage(ws, data, uid)
    })

    ws.on('close', () => {
      sockets.removeConnection(uid)
    })
  }
)

// listen for requests :)
const listener = server.listen(process.env.PORT, () => {
  if (listener && listener.address()) {
    const addr = listener.address()
    console.log(
      `p5-websocket-server is listening on port ${
        typeof addr !== 'string' && addr !== null ? addr.port : addr
      }`
    )
  }
})
