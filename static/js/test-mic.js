let mic;

function startAudio() {
  console.log('starting audio...');
  getAudioContext().resume();

  mic = new p5.AudioIn();
  mic.start();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  console.log('setting up...');
  // getAudioContext().suspend();
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent("sketch-container");
}

function draw() {
  background('black');
  if (mic === undefined) { return; }

  background('gray');
  fill('white');
  text(mic.enabled, 100, 100);
  // text(mic.currentSource, 300, 100);
  // text(mic.input, 500, 100);

  let v = mic.getLevel();
  text(v, 300, 300);
}

function mousePressed() {
  if (mic === undefined) {
    startAudio();
  }
}
