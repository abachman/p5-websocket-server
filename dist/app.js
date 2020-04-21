"use strict";

var _ws = _interopRequireDefault(require("ws"));

var _http = _interopRequireDefault(require("http"));

var _express = _interopRequireDefault(require("express"));

var _expressSession = _interopRequireDefault(require("express-session/"));

var _url = _interopRequireDefault(require("url"));

var _path = _interopRequireDefault(require("path"));

var _querystring = _interopRequireDefault(require("querystring"));

var _expressHandlebars = _interopRequireDefault(require("express-handlebars"));

var _frameguard = _interopRequireDefault(require("frameguard"));

var _uuid = require("uuid");

var _morgan = _interopRequireDefault(require("morgan"));

var _channel = _interopRequireDefault(require("./lib/channel"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

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

var publicDir = _path["default"].resolve(__dirname, "../public"); ///
// HTTP server, just demo sketches for now
///


app.use(_express["default"]["static"](publicDir));
app.use(sessionParser);
app.use((0, _morgan["default"])("combined"));
app.engine("handlebars", (0, _expressHandlebars["default"])());
app.set("view engine", "handlebars");
app.use((0, _frameguard["default"])({
  action: "sameorigin"
}));
app.disable("x-powered-by");
app.get("/", function (req, res) {
  res.header("x-frame-options", "SAMEORIGIN");
  res.render("home", {
    layout: "sketches"
  });
});
app.get("/sketch/:name", function (req, res) {
  res.header("x-frame-options", "SAMEORIGIN");
  res.render("sketch", {
    layout: "sketches",
    name: req.params["name"]
  });
});
app.get("/embed/:name", function (req, res) {
  res.header("x-frame-options", "SAMEORIGIN");
  res.render("embed", {
    layout: "embed",
    name: req.params["name"]
  });
});

var server = _http["default"].createServer(app); // Each channel lives in its own isolated namespace.
//
// If we wanted to make this a distributed system, we'd separate the websocket
// service from Channels. The top level channel collection would subscribe to
// a message bus that all other instances of the websocket server subscribe
// to.


var channels = {};
var defaultOptions = {
  echo: true,
  receiver: true,
  controller: true
};

function parsedOptions(optString) {
  var queryObject = _querystring["default"].decode(optString || "") || {};
  var options = Object.assign({}, defaultOptions, queryObject);

  for (var _i = 0, _Object$entries = Object.entries(options); _i < _Object$entries.length; _i++) {
    var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
        k = _Object$entries$_i[0],
        v = _Object$entries$_i[1];

    if (v === "true" || v === true || v === 1 || v === "1") {
      options[k] = true;
    } else {
      options[k] = false;
    }
  }

  return options;
}

server.on("upgrade", function (request, socket, head) {
  // get path
  var parsedUrl = _url["default"].parse(request.url);

  var pathname = parsedUrl.pathname;
  var options = parsedOptions(parsedUrl.query);

  if (!channels[pathname]) {
    console.log("starting sketch at", pathname);
    channels[pathname] = {
      path: pathname,
      sockets: new _channel["default"]()
    };
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    // console.log("handling upgrade with options", options);
    wss.emit("connection", ws, request, options);
  });
});
wss.on("connection", function (ws, req, options) {
  // console.log("on('connection') with options", options);
  var uid = (0, _uuid.v4)();

  var pathname = _url["default"].parse(req.url).pathname;

  var sketch = channels[pathname];

  if (!sketch) {
    // unrecognized!
    console.error("unrecognized path:", pathname, "closing session");
    ws.close();
    return;
  }

  var sockets = sketch.sockets;
  sockets.addConnection(ws, req, uid, options);
  ws.on("message", function (data) {
    // console.log("msg in", data);
    sockets.onMessage(ws, data, uid);
  });
  ws.on("close", function () {
    sockets.removeConnection(uid);
  });
}); // listen for requests :)

var listener = server.listen(process.env.PORT, function () {
  console.log("p5-websocket-server is listening on port ".concat(listener.address().port));
});