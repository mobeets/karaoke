// Duplicated and transformed from: https://editor.p5js.org/josazar/sketches/-ALr34zi6
const model_url = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';
let pitch;
let mic;
let freq = 0;
let pitchHistory = [];
const opts = {
  stepX: 2,
  lowFreq: 110,
  highFreq: 300,
  freqThresh: 5, // to make lines wiggle
}
let state = 'notready';
let songCurrentTime = 0;
let notesObj = [];

const notes = {
  do2: '130.81',
  re2: '146.83',
  mi2: '164.81',
  fa2: '174.61',
  sol2: '196',
  la2: '220',
  si2: '246.94',
  do3: '261.63',
  re3: '293.66'
}
var lineNotes = [];

// TODO: load JSON
const songNotes = {
  name: 'Bowie',
  notes: [
    {
      name:  'Do',
      id:    'do2',
      time:  50
    },
    {
      name:  'Ré',
      id:    're2',
      time:  80
    },
    {
      name:  'Ré',
      id:    're2',
      time:  160
    },
    {
      name:  'La',
      id:    'la2',
      time:  200
    },
    {
      name:  'Si',
      id:    'si2',
      time:  260
    },
  
  ]
};

function setup() {
  createCanvas(600, 400);
  audioContext = getAudioContext();
  mic = new p5.AudioIn();
  mic.start(listening);
  initPitchHistory(width / 2);
  initLineNotes(notes);
}

function initLineNotes(notes) {
  for (let [key, value] of Object.entries(notes)) {
    let freq = map(value, opts.lowFreq, opts.highFreq, height, 0);
    lineNotes.push(new LineNote(value, key, freq));
  }
}

function updateLineNotes() {
  // Line Notes
  for (let line of lineNotes) {    
    line.draw();
    if (line.isFocus(freq, opts.freqThresh) ) {
     // modif sur la ligne 
      line.setOn();
    } else {
      line.setOff();
    }
  }
}

function drawSongNotes() {
  // on parcours les notes    
  let n = songNotes.notes;
  let index = 0;
  
  songCurrentTime++;
  for (let note of n) {
    if (songCurrentTime == note.time) {
      let name = note.name;
      let id = note.id;
      let freq = notes[id];
      let posY = map(freq, opts.lowFreq, opts.highFreq, height, 0);
      let pos = createVector(width, posY);
      notesObj.push(new Note(name, pos));
    } else if (songCurrentTime > note.time) {
        notesObj[index].update();
        notesObj[index].draw();                 
    }
    index++;
  }
}

function draw() {
  background("#352f3b");
  noStroke();
  textAlign(LEFT, TOP);
  fill(255);
  textSize(24);
  text(freq.toFixed(2), 50, 50);

  let currentFreq = map(freq.toFixed(2), opts.lowFreq, opts.highFreq, height, 0);
  drawPitchHistory(pitchHistory, currentFreq);
  updateLineNotes();
  
  // Song notes
  if (state.localeCompare("play") == 0) {
    drawSongNotes();    
  }
  
  // show FPS
  let fps = frameRate();
  text(fps.toFixed(0), width - 50, 50);
}

function drawPitchHistory(pitchHistory, currentFreq) {
  stroke('red');
  noFill();
  strokeWeight(1);
  beginShape();
  for (let i = 0; i < pitchHistory.length; i++) {
    vertex(i * opts.stepX, pitchHistory[i]);
    if (i > 0) {
      pitchHistory[i - 1] = pitchHistory[i]
    }
  }
  pitchHistory[pitchHistory.length - 1] = currentFreq;
  endShape();
}

function initPitchHistory(stageWidth) {
  for (let i = 0; i < stageWidth + opts.stepX; i += opts.stepX) {
    pitchHistory.push(0);
  }
}

/** UTILS **/
function listening() {
  console.log('listening');
  pitch = ml5.pitchDetection(
    model_url,
    audioContext,
    mic.stream,
    modelLoaded
  );
}

function modelLoaded() {
  console.log('model loaded');
  pitch.getPitch(gotPitch);
  state = "stop";
}

function gotPitch(error, frequency) {
  if (error) {
    console.error(error);
  } else {
    if (frequency) {
      freq = frequency;
    }
    pitch.getPitch(gotPitch);
  }
}

function mouseClicked() {
  if (state.localeCompare("notready") == 0) { return; }

  if (state.localeCompare("play") == 0) {
    state = "stop";
    notesObj = [];
    songCurrentTime = 0;
  } else {
    state = "play";
  }
}
