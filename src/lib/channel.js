class Channel {
  constructor() {
    this.connections = {};
  }

  addConnection(conn, req, uid, options) {
    let ip;
    if (req.headers["x-forwarded-for"]) {
      ip = req.headers["x-forwarded-for"].split(/\s*,\s*/)[0];
    } else {
      ip = req.connection.remoteAddress;
    }

    this.connections[uid] = {
      conn,
      ip,
      options,
    };
    console.log("connection from", ip, "with id", uid, "and options", options);

    this.broadcast({
      type: "connect",
      id: uid,
    });
  }

  // clean up when a connection is removed
  removeConnection(uid) {
    // console.log("removing", uid);
    delete this.connections[uid];

    this.broadcast({
      type: "disconnect",
      id: uid,
    });
  }

  onMessage(sender, message) {
    this.broadcast(
      {
        type: "data",
        data: message,
      },
      sender
    );
  }

  // broadcast messages to all connections (if they are receivers)
  broadcast(messageObj, sender = null) {
    // console.log("broadcasting", message);
    let removes = [];
    for (let [uid, connection] of Object.entries(this.connections)) {
      const { conn, options } = connection;

      if (options.receiver && (options.echo || conn !== sender)) {
        try {
          // console.log("sending", message, "to", uid);
          conn.send(JSON.stringify(messageObj));
        } catch (ex) {
          // console.error("error!", ex.message, ex);
          removes.push(uid);
        }
      }
    }
    removes.forEach((uid) => this.removeConnection(uid));
  }
}

export default Channel;
