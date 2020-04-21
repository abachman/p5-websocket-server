A prototype / standard [p5.websocket](https://github.com/abachman/p5.websocket/) backend.

Accepts any connection, isolates sketches to channels based on websocket request path, and has just a little bit of deployment tooling.

### Deploying

Setup a server with node.js and install pm2.

Create your own pm2 ecosystem.config.js file. Here's an example:

```js
// configure these
const remote_user = "deploy";
const remote_host = "hostname.com";
const remote_root = "/var/www/p5-websocket-server";

const remote_server = `${remote_user}@${remote_host}`;
const remote_shared = `${remote_root}/shared`;
const remote_current = `${remote_root}/current`;

const pre_deploy_local = [
  `scp .nconf.production.json ${remote_server}:${remote_shared}/.nconf.json`,
  `scp ecosystem.config.js ${remote_server}:${remote_shared}/`,
].join(" && ");

const post_deploy = [
  `ln -fs ${remote_shared}/.nconf.json ${remote_current}/`,
  `ln -fs ${remote_shared}/ecosystem.config.js ${remote_current}/`,
  "yarn install --production",
  "pm2 startOrRestart ecosystem.config.js --env production",
].join(" && ");

module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps: [
    {
      name: "p5-websocket-server",
      script: "dist/app.js",
      watch: true,
      env: {
        PORT: "8083",
        NODE_ENV: "development",
        NCONF_FILE: ".nconf.json",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "8080",
      },
    },
  ],

  /**
   * Deployment section
   * http://pm2.keymetrics.io/docs/usage/deployment/
   */
  deploy: {
    production: {
      user: remote_user,
      host: remote_host,
      ref: "origin/master",
      repo: "git@github.com:username/repository",
      path: remote_root,
      "pre-deploy-local": pre_deploy_local,
      "post-deploy": post_deploy,
    },
  },
};
```

Build a production version of the server with `yarn build`. Commit `dist/` and push.

Deploy with `pm2 deploy production`.

In short:

Make changes to code in src/.

```
$ yarn build
$ git ci -am "made changes" && git push
$ pm2 deploy production
```

### nginx configuration

In production, with the above configuration, the app will start up on port 8080. If you're using [certbot](https://certbot.eff.org/lets-encrypt/ubuntubionic-nginx) to get an SSL certificate (you ought to), you might use an nginx config that looks like this:

```
server {
  server_name stream.p5websocketdemo.com;

  location '/.well-known/acme-challenge' {
    default_type "text/plain";
    root         /var/www/app/shared/.well-known;
  }

  location / {
    return 301 https://$server_name$request_uri;
  }
}

server {
  server_name stream.p5websocketdemo.com;

  listen 443 ssl;
  listen [::]:443 ssl;
  include snippets/ssl-params.conf;

  location / {
    try_files /nonexistent @$http_upgrade;
  }

  location @websocket {
    # websocket related stuff
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_read_timeout 86400;
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }

  location @ {
    # web related stuff
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
  }

  ssl_certificate /etc/letsencrypt/live/stream.p5websocketdemo.com/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/stream.p5websocketdemo.com/privkey.pem; # managed by Certbot
}

```

The tricky piece is the `location /` block with the line: `try_files /nonexistent @$http_upgrade;`. That configuration is forcing nginx to dynamically chose whether to proxy the connection as a websocket or as plain http. This lets us boot up one nodejs http server process that can handle websocket and http communication.

## TODO

- don't get overwhelmed
- allow protocol negotiation with p5.websocket client library on connect
