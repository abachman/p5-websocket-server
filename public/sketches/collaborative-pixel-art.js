let colors = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 0],
  [255, 255, 255],
];
let selectedColor = colors[colors.length - 1];

let pixelSize = 20;

function setup() {
  createCanvas(700, 500);
  background(0);

  // Part 1: Inside the setup() function, call connectWebsocket() with a
  // websocket server address. This looks just like a web page address (URL) but
  // it starts with wss:// instead of https:// and the server we're connecting
  // to is built especially to support p5.websocket sketches.
  //
  // Using a different word after the 'wss://chat.reasonable.systems/' will
  // connect you to a different "room". That means this sketch will only
  // receive messages from other sketches connected to /pixel-art
  connectWebsocket("wss://chat.reasonable.systems/pixel-art");

  noStroke();
  fill(255);

  drawPalette();
  drawBorder();
}

function draw() {}

function mousePressed() {
  // if clicking inside border, make a mark and then
  // tell everyone else we made a mark
  if (insideBorder(mouseX, mouseY)) {
    drawAtPoint(mouseX, mouseY, selectedColor);
    sendMessage({ x: mouseX, y: mouseY, color: selectedColor });
  }

  // if clicking inside palette, pick a new color
  if (mouseY > height - pixelSize) {
    // select color at palette step i
    let palStep = Math.floor(width / colors.length);
    let i = Math.floor(mouseX / palStep);
    console.log("pick color", i);
    selectedColor = colors[i];
    drawPalette();
  }
}

// someone else is drawing!
function messageReceived(data) {
  if (data.x && data.y && data.color) {
    drawAtPoint(data.x, data.y, data.color);
  }
}

// draw a grid-aligned "pixel" at the point described
function drawAtPoint(x, y, c) {
  noStroke();
  fill(c);
  rect(
    Math.floor(x / pixelSize) * pixelSize,
    Math.floor(y / pixelSize) * pixelSize,
    pixelSize,
    pixelSize
  );
}

// draw the color selection pallette
function drawPalette() {
  let pStep = width / colors.length;
  noStroke();

  // clear
  fill(0);
  rect(0, height - (pixelSize * 2 - 2), width, pixelSize * 2);

  for (let i = 0; i < colors.length; i++) {
    fill(colors[i]);
    rect(i * pStep, height - pixelSize, pStep, pixelSize);

    if (selectedColor === colors[i]) {
      // clear selection indicator
      fill(colors[i]);
      ellipse(i * pStep + pStep / 2, height - pixelSize - 10, 10, 10);
    }
  }
}

function drawBorder() {
  noFill();
  stroke(255);
  rect(
    pixelSize - 1,
    pixelSize - 1,
    width - (pixelSize - 1) * 2,
    height - (pixelSize - 1) - (pixelSize * 2 - 1)
  );
}

// decide if x and y are inside the border
function insideBorder(x, y) {
  return (
    x >= pixelSize &&
    x <= width - pixelSize &&
    y >= pixelSize &&
    y < height - pixelSize * 2
  );
}
