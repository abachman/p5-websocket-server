/*
this is an example of distributed state with p5.websockets.

The server remembers _nothing_, so it's up to every client to remember and
let future clients know what's up!

message types:
  { type: 'join', ... }
    when a player joins
  { type: 'roster', ... }
    reports on connected players and the state of the game board
  { type: 'play' }
    when a player takes a turn
*/

// TODO:
// - evaluate win conditions
// - age out older plays

let ident;
let myUid;
let players = {};
let played = false;

// grid
let pad = 80;
let spaces = 16;
let gstep;

let tics = [];
for (let i = 0; i < spaces; i++) {
  let row = [];
  for (let n = 0; n < spaces; n++) {
    row.push(null);
  }
  tics.push(row);
}

function setup() {
  createCanvas(700, 700);
  background(0);
  connectWebsocket("wss://chat.reasonable.systems/battle-spots");

  // grid
  gstep = (width - pad * 2) / spaces;
}

// socket has finished connecting, this function receives p5.websocket's unique
// identifier for our connection
function onConnection(uid) {
  myUid = uid;
  ident = generateIdenticon(myUid);

  sendMessage({ type: "join", uid: uid });
}

// another player has disconnected, remove them from the player list
function disconnectReceived(uid) {
  if (players[uid]) {
    delete players[uid];

    // remove their plays
    tics = tics.map(function (row) {
      return row.map(function (cell) {
        if (cell && cell.uid !== uid) return cell;
        else return null;
      });
    });
  }
}

function draw() {
  background(0);

  noStroke();
  fill(255);
  textSize(14);
  textAlign(LEFT);

  if (ident) {
    text("you are", 10, height - 22);
    image(ident, 64, height - 46);
  }

  textSize(48);
  textAlign(CENTER);
  text("BATTLE SPOTS", width / 2, 40);

  textSize(18);
  text(`${Object.keys(players).length} CONNECTED`, width / 2, 60);

  textAlign(RIGHT);
  if (played) {
    text("waiting for another player to go...", width - 10, height - 22);
  } else {
    text("you can go!", width - 10, height - 22);
  }

  drawGrid();
}

function drawGrid() {
  stroke(255);
  strokeWeight(2);

  for (let x = 0; x < spaces + 1; x++) {
    line(x * gstep + pad, pad, x * gstep + pad, height - pad);
  }

  for (let y = 0; y < spaces + 1; y++) {
    line(pad, y * gstep + pad, width - pad, y * gstep + pad);
  }

  for (let row of tics) {
    for (let play of row) {
      if (play !== null) {
        // console.log("draw play", play);
        let gloc = gridToCoords(play.grid);
        image(play.ident, gloc[0], gloc[1]);
      }
    }
  }
}

function coordsToGrid(x, y) {
  if (x < pad || x > width - pad || y < pad || y > height - pad) {
    return null;
  }

  let d = width - pad * 2;

  let gx = Math.floor((x - pad) / gstep);
  let gy = Math.floor((y - pad) / gstep);

  return [gx, gy];
}

// grid coords (0, 0) to pixel screen at grid center
function gridToCoords(grid) {
  return [pad + grid[0] * gstep + 2, pad + grid[1] * gstep + 2];
}

function mousePressed() {
  if (played) return;

  let grid = coordsToGrid(mouseX, mouseY);
  if (grid !== null) {
    let event = {
      type: "play",
      uid: myUid,
      grid: grid,
      age: 0,
    };

    // console.log("i played", event);
    played = true;
    sendMessage(event);
  }
}

// getting messages
function messageReceived(data, uid) {
  if (data.type === "join") {
    // console.log("join event", data, "from", uid);

    players[data.uid] = data;
    players[data.uid].ident = generateIdenticon(data.uid);

    // if it's not my own join message, let the newbie know who's here
    if (uid !== myUid) {
      // console.log("send tics", tics);
      sendMessage({
        type: "roster",
        // tics and players must be JSON safe format
        tics: tics.map(function (row) {
          return row.map(function (cell) {
            if (cell) {
              return {
                uid: cell.uid,
                age: cell.age,
                grid: cell.grid,
              };
            }
          });
        }),
        players: Object.values(players).map(function (player) {
          // console.log("build array out with player", uid, player);
          return {
            uid: player.uid,
          };
        }),
      });
    }
  } else if (data.type === "roster") {
    if (uid === myUid) {
      return;
    }

    // console.log("roster event", data, "from", uid);

    // expect roster to be an array of players
    data.players.forEach(function (player) {
      if (!players[player.uid]) {
        players[player.uid] = player;
        players[player.uid].ident = generateIdenticon(player.uid);
      }
    });

    if (data.tics) {
      tics = data.tics.map(function (row) {
        return row.map(function (play) {
          if (play && players[play.uid]) {
            // generate ident images
            play.ident = players[play.uid].ident;
          }

          return play;
        });
      });
    }
  } else if (data.type === "play") {
    // network says someone else made a play!
    // console.log("play event", data, "from", uid);

    if (!players[uid]) {
      players[uid] = {
        uid: uid,
        ident: generateIdenticon(data.uid),
      };
    }

    // all spots age up by 1
    for (let row of tics) {
      for (let play of row) {
        if (play !== null) {
          play.age += 1;
        }
      }
    }

    // reset play ability!
    if (data.uid !== myUid) {
      played = false;
    }

    // set age of played spot to 0
    data.age = 0;

    // set identicon image
    data.ident = players[data.uid].ident;

    // store play in grid
    tics[data.grid[0]][data.grid[1]] = data;
  }
}

function generateIdenticon(id) {
  let d = 30;

  // id should be a random string
  let graphic = createGraphics(d, d);
  graphic.clear();

  // take first 3 characters
  let sid = id.slice(0, 3);

  id.charCodeAt(0);

  graphic.noStroke();
  graphic.fill(
    (sid.charCodeAt(0) * 1.5) % 200,
    (sid.charCodeAt(1) * 2) % 200,
    (sid.charCodeAt(2) * 3) % 200
  );
  graphic.ellipse(d / 2, d / 2, d, d);
  graphic.fill(255);
  graphic.textAlign(CENTER, CENTER);
  graphic.text(sid, d / 2, d / 2);

  return graphic;
}
