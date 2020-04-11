class SocketCollection {
  constructor() {
    this.connections = {};
  }

  addConnection(conn, req, uid) {
    let ip;
    if (req.headers["x-forwarded-for"]) {
      ip = req.headers["x-forwarded-for"].split(/\s*,\s*/)[0];
    } else {
      ip = req.connection.remoteAddress;
    }

    this.connections[uid] = {
      conn,
      ip,
    };
  }

  // clean up when a connection is removed
  removeConnection(uid) {
    // console.log("removing", uid);
    delete this.connections[uid];
  }

  // broadcast messages to all connections
  onMessage(message) {
    // console.log("broadcasting", message);
    let removes = [];
    for (let [uid, connection] of Object.entries(this.connections)) {
      const { conn } = connection;
      try {
        // console.log("sending", message, "to", uid);
        conn.send(message);
      } catch (ex) {
        // console.error("error!", ex.message, ex);
        removes.push(uid);
      }
    }
    removes.forEach((uid) => this.removeConnection(uid));
  }
}

export default SocketCollection;
