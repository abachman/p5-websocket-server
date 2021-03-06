function setup() {
  createCanvas(500, 500);
  connectWebsocket("wss://chat.reasonable.systems/color-popper");
}

let pops = [];
let started = false;
let bg = [255, 255, 255];

function draw() {
  background(bg);

  noFill();
  for (let pop of pops) {
    if (!pop.rad) {
      pop.rad = 10;
    }
    ellipse(pop.x, pop.y, pop.rad, pop.rad);
    pop.rad += 4;

    if (pop.rad > 160) {
      pop.die = true;
    }
  }

  for (let i = pops.length - 1; i >= 0; i--) {
    if (pops[i].die) {
      pops.splice(i, 1);
    }
  }

  if (!started) {
    fill(0);
    textSize(48);
    textAlign(CENTER, CENTER);
    text(">>> CLICK ON ME <<<", width / 2, height / 2);
  }
}

function messageReceived(data) {
  bg = [...data.color];
  pops.push(data);
}

function mousePressed() {
  started = true;
  sendMessage({
    x: mouseX,
    y: mouseY,
    color: [random(255), random(255), random(255)],
  });
}
