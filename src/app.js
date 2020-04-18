import Websocket from "ws";
import http from "http";
import express from "express";
import session from "express-session/";
import url from "url";
import path from "path";
import exphbs from "express-handlebars";
import { v4 as uuid4 } from "uuid";
import morgan from "morgan";

import SocketCollection from "./lib/socket_collection";

const app = express();
const wss = new Websocket.Server({ clientTracking: false, noServer: true });
const sessionParser = session({
  saveUninitialized: false,
  secret: process.env.APP_SECRET || "$ecReT",
  resave: false,
});

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));
app.use(sessionParser);
app.use(morgan("combined"));
app.engine("handlebars", exphbs());
app.set("view engine", "handlebars");

app.get("/", (req, res) => {
  res.render("home", { layout: "sketches" });
});

app.get("/sketch/:name", (req, res) => {
  res.render("sketch", { layout: "sketches", name: req.params["name"] });
});

app.get("/embed/:name", (req, res) => {
  res.header("X-Frame-Options", "SAMEORIGIN");
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Requested-With, Authorization, X-Frame-Options"
  );
  res.render("embed", { layout: "embed", name: req.params["name"] });
});

const server = http.createServer(app);

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
