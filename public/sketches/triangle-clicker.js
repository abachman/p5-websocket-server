let points = 0;
let a = null;
let b = null;
let tris = [];
let myColor;

function setup() {
  createCanvas(500, 500);
  colorMode(HSB);
  noStroke();
  myColor = [random(255), 255, 255];
  connectWebsocket("wss://chat.reasonable.systems/triangular-clicker");
}

function draw() {
  background(220);

  fill(myColor);
  rect(0, 0, 10, 10);

  for (let t of tris) {
    fill(t[3]);
    triangle(t[0][0], t[0][1], t[1][0], t[1][1], t[2][0], t[2][1]);
  }

  fill(0);
  noStroke();
  if (a) {
    ellipse(a[0], a[1], 3, 3);
  }
  if (b) {
    ellipse(b[0], b[1], 3, 3);
  }
}

function messageReceived(data) {
  // add to list locally
  tris.push(data);
}

function mousePressed() {
  points += 1;
  if (points == 1) {
    a = [mouseX, mouseY];
  } else if (points == 2) {
    b = [mouseX, mouseY];
  } else if (points == 3) {
    finalize();
  }
}

function keyPressed() {
  myColor = [random(255), 255, 255];
}

function finalize() {
  // publish
  sendMessage([a, b, [mouseX, mouseY], myColor]);

  // reset
  a = null;
  b = null;
  points = 0;
}
