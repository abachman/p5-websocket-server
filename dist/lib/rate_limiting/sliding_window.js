"use strict";

var _events = _interopRequireDefault(require("events"));

var _ioredis = _interopRequireDefault(require("ioredis"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { return function () { var Super = _getPrototypeOf(Derived), result; if (_isNativeReflectConstruct()) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

var SlidingWindow = /*#__PURE__*/function (_EventEmitter) {
  _inherits(SlidingWindow, _EventEmitter);

  var _super = _createSuper(SlidingWindow);

  function SlidingWindow(config) {
    var _this;

    _classCallCheck(this, SlidingWindow);

    _this = _super.call(this);
    _this.redis_client = null;
    _this.redis_host = null;
    _this.redis_port = null; // defaults

    _this.maxInInterval = 4; // burst limit in a given interval

    _this.interval = 1000; // length of interval in ms

    _this.namespace = "sw";
    Object.assign(_assertThisInitialized(_this), config || {});

    if (_this.redis_host && _this.redis_port && !_this.redis_client) {
      _this.connect();
    } else {
      _this.onReady();
    }

    return _this;
  }

  _createClass(SlidingWindow, [{
    key: "connect",
    value: function connect() {
      if (!this.redis_client) {
        this.redis_client = new _ioredis["default"](this.redis_port, this.redis_host, {
          enableReadyCheck: true
        });
      }

      this.redis_client.on("ready", this.onReady.bind(this));
    }
  }, {
    key: "onReady",
    value: function onReady() {
      this.emit("ready");
    }
  }, {
    key: "_keys",
    value: function _keys(key, current_span) {
      var prefix = this.namespace + ":" + key + ":";
      var current_span_key = prefix + (current_span & 0xffffff).toString(16);
      var previous_span_key = prefix + (current_span - this.interval & 0xffffff).toString(16);
      return [current_span_key, previous_span_key];
    }
  }, {
    key: "_calculateTimeout",
    value: function _calculateTimeout(previous_count, current_count, time_into_span) {
      var intervalWhichMustPass = 0;

      if (current_count > this.maxInInterval) {
        // time remaining in span
        intervalWhichMustPass += this.interval - time_into_span; // plus percentage of next interval which must pass to lower weight enough
        // for (previous_count * weight) + 0 to be under the limit

        var percentageOverLimit = (current_count - this.maxInInterval) / current_count;
        intervalWhichMustPass += Math.ceil(percentageOverLimit * this.interval);
      } else {
        // current total calculation breaks throttle only when it includes previous_count
        // How long until weight is low enough that:
        //
        //    (previous_count * weight) + current_count
        //
        // is less than this.maxInInterval?
        var weightLimit = (this.maxInInterval - current_count) / previous_count;
        var percentageIntervalMustPass = 1 - weightLimit - time_into_span / this.interval;
        intervalWhichMustPass += Math.ceil(percentageIntervalMustPass * this.interval);
      }

      return Math.ceil(intervalWhichMustPass);
    } // When we don't actually care what the running total is

  }, {
    key: "increment",
    value: function increment(key, callback) {
      var now = Date.now();
      var time_into_span = now % this.interval;
      var current_span = now - time_into_span;

      var _this$_keys = this._keys(key, current_span),
          _this$_keys2 = _slicedToArray(_this$_keys, 2),
          current_span_key = _this$_keys2[0],
          previous_span_key = _this$_keys2[1];

      var commands = [["incr", current_span_key], ["pexpire", current_span_key, this.interval * 2 - time_into_span]];
      this.redis_client.multi(commands).exec(function (err, replies) {
        if (err) {
          console.error("SlidingWindow#increment failed to update Redis with multi(incr, expire) on ", key);
          console.error(err);
          process.exit(1);
        }

        callback();
      });
    } // Count events in the current interval. Doesn't really care about limits or
    // timeouts or success, just tracks events in interval time.
    //
    // takes callback which expects:
    //   (number events_counted, number previous_count, number current_count, number time_into_span)

  }, {
    key: "count",
    value: function count(key, callback) {
      var _this2 = this;

      // all calculations in ms
      var now = Date.now();
      var time_into_span = now % this.interval;
      var current_span = now - time_into_span;

      var _this$_keys3 = this._keys(key, current_span),
          _this$_keys4 = _slicedToArray(_this$_keys3, 2),
          current_span_key = _this$_keys4[0],
          previous_span_key = _this$_keys4[1];

      var commands = [["get", previous_span_key], ["incr", current_span_key], ["pexpire", current_span_key, this.interval * 2 - time_into_span]];
      this.redis_client.multi(commands).exec(function (err, replies) {
        if (err) {
          console.error("SlidingWindow#count failed to update Redis with multi(get, incr, expire) on ", key);
          console.error(err);
          process.exit(1);
        } // don't count past overages too heavily against the rate


        var previous_count = replies[0][1] ? Math.min(parseInt(replies[0][1]), _this2.maxInInterval + 1) : 0;
        var current_count = replies[1][1] ? Math.min(parseInt(replies[1][1]), _this2.maxInInterval + 1) : 0;
        var weight = (_this2.interval - time_into_span) / _this2.interval; // weight of previous window in current calculation

        var total = previous_count * weight + current_count;
        callback(total, previous_count, current_count, time_into_span);
      });
    } // promise-based interface

  }, {
    key: "available",
    value: function available(key) {
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        _this3.limit(key, function (success, attempts_remaining, estimated_time_remaining) {
          if (success) {
            resolve(attempts_remaining);
          } else {
            reject(estimated_time_remaining);
          }
        });
      });
    }
  }, {
    key: "pcount",
    value: function pcount(key) {
      var _this4 = this;

      return new Promise(function (resolve, reject) {
        _this4.count(key, function (total) {
          resolve(total);
        });
      });
    }
  }]);

  return SlidingWindow;
}(_events["default"]);

exports = module.exports = SlidingWindow;