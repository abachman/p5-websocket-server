"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var Channel = /*#__PURE__*/function () {
  function Channel() {
    _classCallCheck(this, Channel);

    this.connections = {};
  }

  _createClass(Channel, [{
    key: "addConnection",
    value: function addConnection(conn, req, uid, options) {
      var ip;

      if (req.headers["x-forwarded-for"]) {
        ip = req.headers["x-forwarded-for"].split(/\s*,\s*/)[0];
      } else {
        ip = req.connection.remoteAddress;
      }

      this.connections[uid] = {
        conn: conn,
        ip: ip,
        options: options
      };
      console.log("connection from", ip, "with id", uid, "and options", options);
      this.broadcast({
        type: "connect",
        id: uid
      });
    } // clean up when a connection is removed

  }, {
    key: "removeConnection",
    value: function removeConnection(uid) {
      // console.log("removing", uid);
      delete this.connections[uid];
      this.broadcast({
        type: "disconnect",
        id: uid
      });
    }
  }, {
    key: "onMessage",
    value: function onMessage(sender, message) {
      this.broadcast({
        type: "data",
        data: message
      }, sender);
    } // broadcast messages to all connections (if they are receivers)

  }, {
    key: "broadcast",
    value: function broadcast(messageObj) {
      var _this = this;

      var sender = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      // console.log("broadcasting", message);
      var removes = [];

      for (var _i = 0, _Object$entries = Object.entries(this.connections); _i < _Object$entries.length; _i++) {
        var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
            uid = _Object$entries$_i[0],
            connection = _Object$entries$_i[1];

        var conn = connection.conn,
            options = connection.options;

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

      removes.forEach(function (uid) {
        return _this.removeConnection(uid);
      });
    }
  }]);

  return Channel;
}();

var _default = Channel;
exports["default"] = _default;