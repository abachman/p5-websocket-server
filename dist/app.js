"use strict";

var _ws = _interopRequireDefault(require("ws"));

var _http = _interopRequireDefault(require("http"));

var _url = _interopRequireDefault(require("url"));

var _uuid = require("uuid");

var _socket_collection = _interopRequireDefault(require("./lib/socket_collection"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var wss = new _ws["default"].Server({
  clientTracking: false,
  noServer: true
});

var httpHandler = function httpHandler(req, res) {
  console.log("".concat(req.method, " ").concat(req.url));
  res.setHeader("Content-type", "text/plain");
  res.end("helo worl");
};

var server = _http["default"].createServer(httpHandler);

var sketches = {};
server.on("upgrade", function (request, socket, head) {
  // get path
  var pathname = _url["default"].parse(request.url).pathname;

  if (!sketches[pathname]) {
    console.log("starting sketch at", pathname);
    sketches[pathname] = {
      sockets: new _socket_collection["default"]()
    };
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    wss.emit("connection", ws, request);
  });
});
wss.on("connection", function (ws, req) {
  var uid = (0, _uuid.v4)();

  var pathname = _url["default"].parse(req.url).pathname;

  var sketch = sketches[pathname];

  if (!sketch) {
    // unrecognized!
    console.error("unrecognized path:", pathname, "closing session");
    ws.close();
    return;
  }

  var sockets = sketch.sockets;
  sockets.addConnection(ws, req, uid);
  ws.on("message", function (data) {
    sockets.onMessage(data);
  });
  ws.on("close", function () {
    sockets.removeConnection(uid);
  });
}); // listen for requests :)

var listener = server.listen(process.env.PORT, function () {
  console.log("Your app is listening on port " + listener.address().port);
});