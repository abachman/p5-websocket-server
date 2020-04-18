"use strict";

var _ws = _interopRequireDefault(require("ws"));

var _http = _interopRequireDefault(require("http"));

var _express = _interopRequireDefault(require("express"));

var _expressSession = _interopRequireDefault(require("express-session/"));

var _url = _interopRequireDefault(require("url"));

var _path = _interopRequireDefault(require("path"));

var _expressHandlebars = _interopRequireDefault(require("express-handlebars"));

var _uuid = require("uuid");

var _morgan = _interopRequireDefault(require("morgan"));

var _socket_collection = _interopRequireDefault(require("./lib/socket_collection"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var app = (0, _express["default"])();
var wss = new _ws["default"].Server({
  clientTracking: false,
  noServer: true
});
var sessionParser = (0, _expressSession["default"])({
  saveUninitialized: false,
  secret: process.env.APP_SECRET || "$ecReT",
  resave: false
});

var publicDir = _path["default"].resolve(__dirname, "../public");

app.use(_express["default"]["static"](publicDir));
app.use(sessionParser);
app.use((0, _morgan["default"])("combined"));
app.engine("handlebars", (0, _expressHandlebars["default"])());
app.set("view engine", "handlebars");
app.get("/", function (req, res) {
  res.render("home", {
    layout: "sketches"
  });
});
app.get("/sketch/:name", function (req, res) {
  res.render("sketch", {
    layout: "sketches",
    name: req.params["name"]
  });
});
app.get("/embed/:name", function (req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Authorization, X-Frame-Options");
  res.render("embed", {
    layout: "embed",
    name: req.params["name"]
  });
});

var server = _http["default"].createServer(app);

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