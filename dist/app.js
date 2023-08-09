"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const path_1 = __importDefault(require("path"));
const express_handlebars_1 = require("express-handlebars");
const frameguard_1 = __importDefault(require("frameguard"));
const uuid_1 = require("uuid");
const morgan_1 = __importDefault(require("morgan"));
const channel_1 = __importDefault(require("./lib/channel"));
const app = (0, express_1.default)();
const wss = new ws_1.default.Server({ clientTracking: false, noServer: true });
const sessionParser = (0, express_session_1.default)({
    saveUninitialized: false,
    secret: process.env.APP_SECRET || '$ecReT',
    resave: false,
});
const publicDir = path_1.default.resolve(__dirname, '../public');
///
// HTTP server, just demo sketches for now
///
app.use(express_1.default.static(publicDir));
app.use(sessionParser);
app.use((0, morgan_1.default)('combined'));
// templates
app.engine('.hbs', (0, express_handlebars_1.engine)({ extname: '.hbs' }));
app.set('view engine', '.hbs');
app.set('views', './views');
app.use((0, frameguard_1.default)({ action: 'sameorigin' }));
app.disable('x-powered-by');
app.get('/', (_, res) => {
    res.header('x-frame-options', 'SAMEORIGIN');
    res.render('home', { layout: 'sketches' });
});
app.get('/sketch/:name', (req, res) => {
    res.header('x-frame-options', 'SAMEORIGIN');
    let height = req.query.height || '500';
    if (req.params.name === 'battle-spots') {
        height = '720';
    }
    res.render('sketch', {
        layout: 'sketches',
        name: req.params.name,
        height: height,
    });
});
app.get('/embed/:name', (req, res) => {
    res.header('x-frame-options', 'SAMEORIGIN');
    res.render('embed', { layout: 'embed', name: req.params['name'] });
});
const server = http_1.default.createServer(app);
const channels = {};
const defaultOptions = {
    echo: true,
    receiver: true,
    controller: true,
};
function parsedOptions(queryObject) {
    const options = Object.assign({}, defaultOptions, queryObject);
    // coerce options to boolean
    for (const [k, v] of Object.entries(options)) {
        if (v === 'true' || v === true || v === '1') {
            options[k] = true;
        }
        else {
            options[k] = false;
        }
    }
    return options;
}
server.on('upgrade', function (request, socket, head) {
    // get path
    const parsedUrl = new URL(request.url || '/');
    const pathname = parsedUrl.pathname;
    const options = parsedOptions(parsedUrl.searchParams);
    if (!channels[pathname]) {
        console.log('starting sketch at', pathname);
        channels[pathname] = {
            path: pathname,
            sockets: new channel_1.default(),
        };
    }
    wss.handleUpgrade(request, socket, head, function (ws) {
        // console.log("handling upgrade with options", options);
        wss.emit('connection', ws, request, options);
    });
});
wss.on('connection', function (ws, req, options) {
    console.log("on('connection') with options", options);
    if (!req.url)
        return;
    const uid = (0, uuid_1.v4)();
    const pathname = new URL(req.url).pathname;
    const sketch = channels[pathname];
    if (!sketch) {
        // unrecognized!
        console.error('unrecognized path:', pathname, 'closing session');
        ws.close();
        return;
    }
    const { sockets } = sketch;
    sockets.addConnection(ws, req, uid, options);
    ws.on('message', (data) => {
        // console.log("msg in", data);
        sockets.onMessage(ws, data, uid);
    });
    ws.on('close', () => {
        sockets.removeConnection(uid);
    });
});
// listen for requests :)
const listener = server.listen(process.env.PORT, () => {
    if (listener && listener.address()) {
        const addr = listener.address();
        console.log(`p5-websocket-server is listening on port ${typeof addr !== 'string' && addr !== null ? addr.port : addr}`);
    }
});
