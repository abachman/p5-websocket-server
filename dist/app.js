var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __exportStar = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __exportStar(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};
var import_ws = __toModule(require("ws"));
var import_http = __toModule(require("http"));
var import_express = __toModule(require("express"));
var import_express_session = __toModule(require("express-session"));
var import_path = __toModule(require("path"));
var import_express_handlebars = __toModule(require("express-handlebars"));
var import_frameguard = __toModule(require("frameguard"));
var import_uuid = __toModule(require("uuid"));
var import_morgan = __toModule(require("morgan"));
var import_channel = __toModule(require("./lib/channel"));
const app = (0, import_express.default)();
const wss = new import_ws.default.Server({clientTracking: false, noServer: true});
const sessionParser = (0, import_express_session.default)({
  saveUninitialized: false,
  secret: process.env.APP_SECRET || "$ecReT",
  resave: false
});
const publicDir = import_path.default.resolve(__dirname, "../public");
app.use(import_express.default.static(publicDir));
app.use(sessionParser);
app.use((0, import_morgan.default)("combined"));
app.engine("handlebars", (0, import_express_handlebars.default)());
app.set("view engine", "handlebars");
app.use((0, import_frameguard.default)({action: "sameorigin"}));
app.disable("x-powered-by");
app.get("/", (req, res) => {
  res.header("x-frame-options", "SAMEORIGIN");
  res.render("home", {layout: "sketches"});
});
app.get("/sketch/:name", (req, res) => {
  res.header("x-frame-options", "SAMEORIGIN");
  let height = req.query.height || "500";
  if (req.params.name === "battle-spots") {
    height = "720";
  }
  res.render("sketch", {
    layout: "sketches",
    name: req.params.name,
    height
  });
});
app.get("/embed/:name", (req, res) => {
  res.header("x-frame-options", "SAMEORIGIN");
  res.render("embed", {layout: "embed", name: req.params["name"]});
});
const server = import_http.default.createServer(app);
const channels = {};
const defaultOptions = {
  echo: true,
  receiver: true,
  controller: true
};
function parsedOptions(queryObject) {
  const options = Object.assign({}, defaultOptions, queryObject);
  for (let [k, v] of Object.entries(options)) {
    if (v === "true" || v === true || v === 1 || v === "1") {
      options[k] = true;
    } else {
      options[k] = false;
    }
  }
  return options;
}
server.on("upgrade", function(request, socket, head) {
  const parsedUrl = new URL(request.url);
  const pathname = parsedUrl.pathname;
  const options = parsedOptions(parsedUrl.searchParams);
  if (!channels[pathname]) {
    console.log("starting sketch at", pathname);
    channels[pathname] = {
      path: pathname,
      sockets: new import_channel.default()
    };
  }
  wss.handleUpgrade(request, socket, head, function(ws) {
    wss.emit("connection", ws, request, options);
  });
});
wss.on("connection", function(ws, req, options) {
  console.log("on('connection') with options", options);
  if (!req.url)
    return;
  const uid = (0, import_uuid.v4)();
  const pathname = new URL(req.url).pathname;
  const sketch = channels[pathname];
  if (!sketch) {
    console.error("unrecognized path:", pathname, "closing session");
    ws.close();
    return;
  }
  const {sockets} = sketch;
  sockets.addConnection(ws, req, uid, options);
  ws.on("message", (data) => {
    sockets.onMessage(ws, data, uid);
  });
  ws.on("close", () => {
    sockets.removeConnection(uid);
  });
});
const listener = server.listen(process.env.PORT, () => {
  if (listener && listener.address()) {
    const addr = listener.address();
    console.log(`p5-websocket-server is listening on port ${typeof addr !== "string" && addr !== null ? addr.port : addr}`);
  }
});
