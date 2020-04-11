import Websocket from "ws";
import http from "http";
import url from "url";
import { v4 as uuid4 } from "uuid";

import SocketCollection from "./lib/socket_collection";

const wss = new Websocket.Server({ clientTracking: false, noServer: true });

const httpHandler = (req, res) => {
  console.log(`${req.method} ${req.url}`);
  res.setHeader("Content-type", "text/plain");
  res.end(`helo worl`);
};

const server = http.createServer(httpHandler);

const sketches = {};

server.on("upgrade", function (request, socket, head) {
  // get path
  const pathname = url.parse(request.url).pathname;

  if (!sketches[pathname]) {
    console.log("starting sketch at", pathname);
    sketches[pathname] = {
      sockets: new SocketCollection(),
    };
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", function (ws, req) {
  const uid = uuid4();

  const pathname = url.parse(req.url).pathname;
  const sketch = sketches[pathname];
  if (!sketch) {
    // unrecognized!
    console.error("unrecognized path:", pathname, "closing session");
    ws.close();
    return;
  }

  const { sockets } = sketch;
  sockets.addConnection(ws, req, uid);

  ws.on("message", function (data) {
    sockets.onMessage(data);
  });

  ws.on("close", function () {
    sockets.removeConnection(uid);
  });
});

// listen for requests :)
const listener = server.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
