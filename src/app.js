import Websocket from "ws";
import http from "http";
import express from "express";
import session from "express-session/";
import url from "url";
import path from "path";
import querystring from "querystring";
import exphbs from "express-handlebars";
import frameguard from "frameguard";
import { v4 as uuid4 } from "uuid";
import morgan from "morgan";

import Channel from "./lib/channel";

const app = express();
const wss = new Websocket.Server({ clientTracking: false, noServer: true });
const sessionParser = session({
  saveUninitialized: false,
  secret: process.env.APP_SECRET || "$ecReT",
  resave: false,
});

const publicDir = path.resolve(__dirname, "../public");

///
// HTTP server, just demo sketches for now
///

app.use(express.static(publicDir));
app.use(sessionParser);
app.use(morgan("combined"));
app.engine("handlebars", exphbs());
app.set("view engine", "handlebars");
app.use(frameguard({ action: "sameorigin" }));
app.disable("x-powered-by");

app.get("/", (req, res) => {
  res.header("x-frame-options", "SAMEORIGIN");
  res.render("home", { layout: "sketches" });
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
    height: height,
  });
});

app.get("/embed/:name", (req, res) => {
  res.header("x-frame-options", "SAMEORIGIN");
  res.render("embed", { layout: "embed", name: req.params["name"] });
});

const server = http.createServer(app);

// Each channel lives in its own isolated namespace.
//
// If we wanted to make this a distributed system, we'd separate the websocket
// service from Channels. The top level channel collection would subscribe to
// a message bus that all other instances of the websocket server subscribe
// to.
const channels = {};

const defaultOptions = {
  echo: true,
  receiver: true,
  controller: true,
};

function parsedOptions(optString) {
  const queryObject = querystring.decode(optString || "") || {};
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

server.on("upgrade", function (request, socket, head) {
  // get path
  const parsedUrl = url.parse(request.url);
  const pathname = parsedUrl.pathname;
  const options = parsedOptions(parsedUrl.query);

  if (!channels[pathname]) {
    console.log("starting sketch at", pathname);
    channels[pathname] = {
      path: pathname,
      sockets: new Channel(),
    };
  }

  wss.handleUpgrade(request, socket, head, function (ws) {
    // console.log("handling upgrade with options", options);
    wss.emit("connection", ws, request, options);
  });
});

wss.on("connection", function (ws, req, options) {
  // console.log("on('connection') with options", options);
  const uid = uuid4();

  const pathname = url.parse(req.url).pathname;
  const sketch = channels[pathname];
  if (!sketch) {
    // unrecognized!
    console.error("unrecognized path:", pathname, "closing session");
    ws.close();
    return;
  }

  const { sockets } = sketch;
  sockets.addConnection(ws, req, uid, options);

  ws.on("message", function (data) {
    // console.log("msg in", data);
    sockets.onMessage(ws, data, uid);
  });

  ws.on("close", function () {
    sockets.removeConnection(uid);
  });
});

// listen for requests :)
const listener = server.listen(process.env.PORT, () => {
  console.log(
    `p5-websocket-server is listening on port ${listener.address().port}`
  );
});
