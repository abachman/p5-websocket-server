import WebSocket from 'ws'
import http from 'http'

type ChannelConnection = {
  conn: WebSocket
  ip: string
  options: ChannelOptions
}

export type ChannelOptions = {
  echo: boolean
  receiver: boolean
  controller: boolean
}

class Channel {
  connections: Record<string, ChannelConnection>

  constructor() {
    this.connections = {}
  }

  addConnection(
    conn: WebSocket,
    req: http.IncomingMessage,
    uid: string,
    options: ChannelOptions
  ) {
    let ip
    if (
      req.headers['x-forwarded-for'] &&
      typeof req.headers['x-forwarded-for'] === 'string'
    ) {
      ip = req.headers['x-forwarded-for'].split(/\s*,\s*/)[0]
    } else if (
      req.headers['x-forwarded-for'] &&
      Array.isArray(req.headers['x-forwarded-for'])
    ) {
      ip = req.headers['x-forwarded-for'][0]
    } else {
      ip = req.socket.remoteAddress
    }

    this.connections[uid] = {
      conn,
      ip: ip || 'unknown',
      options,
    }
    // console.log("connection from", ip, "with id", uid, "and options", options);

    // send only the connecting sketch
    conn.send(
      JSON.stringify({
        type: 'onopen',
        id: uid,
      })
    )

    // broadcast to everyone but the connecting sketch
    this.broadcast(
      {
        type: 'connect',
        id: uid,
      },
      conn
    )
  }

  // clean up when a connection is removed
  removeConnection(uid: string) {
    // console.log("removing", uid);
    delete this.connections[uid]

    this.broadcast({
      type: 'disconnect',
      id: uid,
    })
  }

  onMessage(sender: WebSocket, message: string | object, uid: string) {
    this.broadcast(
      {
        type: 'data',
        id: uid,
        data: message,
      },
      sender
    )
  }

  // broadcast messages to all connections (if they are receivers)
  broadcast(messageObj: Record<string, string | object>, sender?: WebSocket) {
    // console.log("broadcasting", message);
    const removes = []
    for (const [uid, connection] of Object.entries(this.connections)) {
      const { conn, options } = connection

      if (messageObj.type === 'connect' && conn === sender) {
        continue
      }

      if (options.receiver && (options.echo || conn !== sender)) {
        try {
          // console.log("sending", message, "to", uid);
          conn.send(JSON.stringify(messageObj))
        } catch (ex) {
          // console.error("error!", ex.message, ex);
          removes.push(uid)
        }
      }
    }
    removes.forEach((uid) => this.removeConnection(uid))
  }
}

export default Channel
