let audioEl;
let songName = "adele-rolling-in-the-deep";
let songNotes = [];
let source, fft, lowPass;
let freq = 0;
let songNoteTranspose = 48;
let songOffsetMsecs = 0;
let doDetectPitch = true;
let showLyricsAboveStaff = true;

// todo: convert "timeOnScreen" to be per pixels,
//    since what is acceptable will be constant wrt screen width

const opts = {
  backgroundColor: '#383636',
  midiNoteStaffMin: 45, // lowest note drawn on staff
  midiNoteStaffMax: 65, // highest note drawn on staff
  midiNoteScreenMin: 40, // lowest note in range of screen
  midiNoteScreenMax: 70, // highest note in range of screen
  timePerThousandPixels: 3, // time (in seconds) shown on screen before/after
  fontSizeLyrics: 14, // font size for lyrics
  noteColorDefault: '#898989', // default color for lyrics
  noteColorActive: 'white', // color for active lyric
  pitchColor: '#5751b0', // color for circle showing pitch being sung
  pitchDiameter: 10, // diameter for circle showing pitch being sung
};

function roundTo(x, n) { return +x.toFixed(n); }

function setup() {
  // prepare canvas
  let cnv = createCanvas(windowWidth, windowHeight-50);
  cnv.parent("sketch-container");

  // load mp3
  audioEl = createAudio('assets/mp3s/' + songName + '.mp3');
  audioEl.parent("audio-controls");
  audioEl.showControls();

  // load notes/lyrics of song
  loadSong(audioEl, songData);

  // prepare to detect pitch
  source = new p5.AudioIn();
  source.start();
  lowPass = new p5.LowPass();
  lowPass.disconnect();
  source.connect(lowPass);
  fft = new p5.FFT();
  fft.setInput(lowPass);
}

function freqToHeight(curFreq) {
  if (curFreq <= 0) { return 0; }
  let fcur = Math.log(curFreq) - Math.log(midiToFreq(opts.midiNoteScreenMin));
  let fmax = Math.log(midiToFreq(opts.midiNoteScreenMax)) - Math.log(midiToFreq(opts.midiNoteScreenMin));
  return map(roundTo(fcur, 2), 0, fmax, height, 0);
}

function loadSong(audioEl, songData) {
  let bps = songData.bpm/60; // beats per second
  let gap = songData.gap/1000 - songOffsetMsecs/1000; // time in seconds when lyrics start
  let ns = songData.notes;
  for (var i = 0; i < ns.length; i++) {
    let note = ns[i];
    let noteStartTime = gap + note.time/(4*bps);
    let noteDuration = note.duration/(4*bps);
    let noteFreq = midiToFreq(note.note + songNoteTranspose);
    let noteHeight = freqToHeight(noteFreq);
    songNotes.push(new Note(noteFreq, noteStartTime, noteDuration, note.name, noteHeight));
  }
}

class Note {
  constructor(freq, startTime, duration, name, height) {
    this.freq = freq;
    this.startTime = startTime;
    this.duration = duration;
    this.height = height;
    this.name = name;
    this.diameter = 10;
    this.colorDefault = opts.noteColorDefault;
    this.colorActive = opts.noteColorActive;
    this.windowSecs = opts.timePerThousandPixels * (windowWidth/1000); // time on screen before or after
  }
  draw(curSongTime) {
    if (this.startTime < curSongTime - this.windowSecs) { return; }
    if (this.startTime + this.duration > curSongTime + this.windowSecs) { return; }
    let x1 = map(this.startTime, curSongTime - this.windowSecs, curSongTime + this.windowSecs, 0, width);
    let x2 = map(this.startTime + this.duration, curSongTime - this.windowSecs, curSongTime + this.windowSecs, 0, width);

    let color = this.colorDefault;
    if ((this.startTime <= curSongTime) && (curSongTime <= this.startTime + this.duration)) {
      color = this.colorActive;
    }

    // draw note
    noStroke();
    fill(color);
    rect(x1, this.height - this.diameter/2, x2-x1, this.diameter);

    // write word
    textAlign(LEFT);
    textSize(opts.fontSizeLyrics);
    let wordHeight = this.height - this.diameter/2; // with note
    if (showLyricsAboveStaff) {
      wordHeight = freqToHeight(midiToFreq(opts.midiNoteStaffMax));
    }
    text(this.name, x1, wordHeight);
  }
}

function drawStaffs() {
  for (var i = opts.midiNoteStaffMin; i < opts.midiNoteStaffMax; i++) {
    let curHeight = freqToHeight(midiToFreq(i));
    stroke('white');
    strokeWeight(1);
    line(0, curHeight, width, curHeight);
  }
}

function draw() {
  background(opts.backgroundColor);
  drawStaffs();

  // draw notes if on screen
  let curSongTime = audioEl.time();
  for (let note of songNotes) {
    note.draw(curSongTime);
  }

  // show current time
  stroke('white');
  strokeWeight(1);
  line(width/2, 0, width/2, height);

  // show pitch being sung
  if (doDetectPitch) {
    freq = detectPitch(fft);
    let freqHeight = freqToHeight(freq);
    noStroke(); fill(opts.pitchColor);
    ellipse(width/2, freqHeight, opts.pitchDiameter);
  }

}

function keyPressed() {
  if (keyCode === 70) { // F key
    doDetectPitch = !doDetectPitch;
  }
}
