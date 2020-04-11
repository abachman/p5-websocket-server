/*
 * Sliding Window Rate Limiting
 *
 * Based on the sliding window algorithm described in:
 * https://www.figma.com/blog/an-alternative-approach-to-rate-limiting/
 *
 * The trickiest part is calculating an approximate "timeout" until actions
 * will be permitted again.
 *
 * Usage:
 *
 *    const limiter = new SlidingWindow({
 *      redis_client: client,
 *      namespace: 'example-limit',
 *
 *      maxInInterval: 10, // permitted attempts per interval
 *      interval: 30000,   // length of measured interval
 *    })
 *    ...
 *
 *    // PROMISE STYLE
 *    limiter.available('username').
 *    then((attempts_remaining) => {
 *      doPermittedThing()
 *    }).
 *    catch((throttle_time_remaining) => {
 *      console.error(`you have ${throttle_time_remaining} seconds until throttle reset`)
 *    })
 *
 */

import EventEmitter from "events";
import Redis from "ioredis";

class SlidingWindow extends EventEmitter {
  constructor(config) {
    super();

    this.redis_client = null;

    this.redis_host = null;
    this.redis_port = null;

    // defaults
    this.maxInInterval = 4; // burst limit in a given interval
    this.interval = 1000; // length of interval in ms
    this.namespace = "sw";

    Object.assign(this, config || {});

    if (this.redis_host && this.redis_port && !this.redis_client) {
      this.connect();
    } else {
      this.onReady();
    }
  }

  connect() {
    if (!this.redis_client) {
      this.redis_client = new Redis(this.redis_port, this.redis_host, {
        enableReadyCheck: true,
      });
    }
    this.redis_client.on("ready", this.onReady.bind(this));
  }

  onReady() {
    this.emit("ready");
  }

  _keys(key, current_span) {
    const prefix = this.namespace + ":" + key + ":";
    const current_span_key = prefix + (current_span & 0xffffff).toString(16);
    const previous_span_key =
      prefix + ((current_span - this.interval) & 0xffffff).toString(16);
    return [current_span_key, previous_span_key];
  }

  _calculateTimeout(previous_count, current_count, time_into_span) {
    let intervalWhichMustPass = 0;
    if (current_count > this.maxInInterval) {
      // time remaining in span
      intervalWhichMustPass += this.interval - time_into_span;
      // plus percentage of next interval which must pass to lower weight enough
      // for (previous_count * weight) + 0 to be under the limit
      let percentageOverLimit =
        (current_count - this.maxInInterval) / current_count;
      intervalWhichMustPass += Math.ceil(percentageOverLimit * this.interval);
    } else {
      // current total calculation breaks throttle only when it includes previous_count

      // How long until weight is low enough that:
      //
      //    (previous_count * weight) + current_count
      //
      // is less than this.maxInInterval?
      let weightLimit = (this.maxInInterval - current_count) / previous_count;
      let percentageIntervalMustPass =
        1 - weightLimit - time_into_span / this.interval;
      intervalWhichMustPass += Math.ceil(
        percentageIntervalMustPass * this.interval
      );
    }

    return Math.ceil(intervalWhichMustPass);
  }

  // When we don't actually care what the running total is
  increment(key, callback) {
    const now = Date.now();
    const time_into_span = now % this.interval;
    const current_span = now - time_into_span;
    const [current_span_key, previous_span_key] = this._keys(key, current_span);

    const commands = [
      ["incr", current_span_key],
      ["pexpire", current_span_key, this.interval * 2 - time_into_span],
    ];

    this.redis_client.multi(commands).exec((err, replies) => {
      if (err) {
        console.error(
          "SlidingWindow#increment failed to update Redis with multi(incr, expire) on ",
          key
        );
        console.error(err);
        process.exit(1);
      }

      callback();
    });
  }

  // Count events in the current interval. Doesn't really care about limits or
  // timeouts or success, just tracks events in interval time.
  //
  // takes callback which expects:
  //   (number events_counted, number previous_count, number current_count, number time_into_span)
  count(key, callback) {
    // all calculations in ms
    const now = Date.now();
    const time_into_span = now % this.interval;
    const current_span = now - time_into_span;
    const [current_span_key, previous_span_key] = this._keys(key, current_span);

    const commands = [
      ["get", previous_span_key],
      ["incr", current_span_key],
      ["pexpire", current_span_key, this.interval * 2 - time_into_span],
    ];

    this.redis_client.multi(commands).exec((err, replies) => {
      if (err) {
        console.error(
          "SlidingWindow#count failed to update Redis with multi(get, incr, expire) on ",
          key
        );
        console.error(err);
        process.exit(1);
      }

      // don't count past overages too heavily against the rate
      let previous_count = replies[0][1]
        ? Math.min(parseInt(replies[0][1]), this.maxInInterval + 1)
        : 0;
      let current_count = replies[1][1]
        ? Math.min(parseInt(replies[1][1]), this.maxInInterval + 1)
        : 0;

      const weight = (this.interval - time_into_span) / this.interval; // weight of previous window in current calculation
      const total = previous_count * weight + current_count;

      callback(total, previous_count, current_count, time_into_span);
    });
  }

  // promise-based interface
  available(key) {
    return new Promise((resolve, reject) => {
      this.limit(
        key,
        (success, attempts_remaining, estimated_time_remaining) => {
          if (success) {
            resolve(attempts_remaining);
          } else {
            reject(estimated_time_remaining);
          }
        }
      );
    });
  }

  pcount(key) {
    return new Promise((resolve, reject) => {
      this.count(key, (total) => {
        resolve(total);
      });
    });
  }
}

exports = module.exports = SlidingWindow;
