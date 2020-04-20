let lines = [];

function setup() {
  createCanvas(500, 500);
  connectWebsocket("wss://chat.reasonable.systems/line-drawings", {
    echo: false, // don't send me my own messages
  });
  background(0);
}

function draw() {
  background(0);

  strokeWeight(3);
  for (let l of lines) {
    stroke(l[0]);
    line(l[1], l[2], l[3], l[4]);
  }

  if (dragging) {
    stroke(80);
    strokeWeight(1);
    line(mx, my, mouseX, mouseY);
    ellipse(mouseX, mouseY, 3, 3);
  }
}

function messageReceived(data) {
  lines.push([[255, 140, 200], data.startX, data.startY, data.endX, data.endY]);
}

let mx = 0;
let my = 0;
let dragging = false;

function mousePressed() {
  mx = mouseX;
  my = mouseY;
  dragging = true;
  ellipse(mx, my, 3, 3);
}

function mouseReleased() {
  sendMessage({
    startX: mx,
    startY: my,
    endX: mouseX,
    endY: mouseY,
  });

  lines.push([[255, 255, 255], mx, my, mouseX, mouseY]);

  dragging = false;
}
