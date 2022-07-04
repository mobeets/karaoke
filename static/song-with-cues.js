let audioEl;
let songName = "adele-rolling-in-the-deep";
let songNotes = [];
let source, fft, lowPass;
let freq = 0;
let songNoteTranspose = 60;
let songOffsetMsecs = 0;
let doDetectPitch = true;
let showLyricsAboveStaff = true;

// todo: convert "timeOnScreen" to be per pixels,
//    since what is acceptable will be constant wrt screen width

const opts = {
  backgroundColor: '#383636',
  midiNoteStaffMin: 55, // lowest note drawn on staff
  midiNoteStaffMax: 75, // highest note drawn on staff
  midiNoteScreenMin: 50, // lowest note in range of screen
  midiNoteScreenMax: 80, // highest note in range of screen
  timePerThousandPixels: 3, // time (in seconds) shown on screen before/after
  noteColorDefault: '#898989', // default color for lyrics
  noteColorActive: 'white', // color for active lyric
  pitchColor: '#5751b0', // color for circle showing pitch being sung
  pitchDiameter: 10, // diameter for circle showing pitch being sung
  errorCentsThresh: 50, // error allowed for a note counting
  fontSizeLyrics: 14, // font size for lyrics
  fontSizeScore: 20, // font size for showing score
  fontSizeTitle: 14, // font size for song title
  colorHitNote: 'green',
  colorMissedNote: 'red',
  colorLyricsUpcoming: 'white',
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
    this.score = NaN; // mean abs error in cents
    this.scoreSigned = NaN; // mean error in cents
    this.scoreCount = 0;
  }

  isUpcoming(curSongTime) {
    return this.startTime >= curSongTime;
  }

  isActive(curSongTime) {
    return (this.startTime <= curSongTime) && (curSongTime <= this.startTime + this.duration);
  }

  isPassed(curSongTime) {
    return curSongTime >= this.startTime + this.duration;
  }

  updateScore(freq) {
    if (isNaN(this.score)) {
      this.score = 0;
      this.scoreSigned = 0;
    }

    let curError = 100*12*(Math.log(freq) - Math.log(this.freq));
    let curScore = curError;

    this.scoreCount += 1;
    this.score = this.score + (Math.abs(curScore) - this.score)/this.scoreCount;
    this.scoreSigned = this.scoreSigned + (curScore - this.scoreSigned)/this.scoreCount;
  }

  getColor(curSongTime) {
    if (this.isActive(curSongTime)) {
      // return this.colorActive;
      if (this.score < opts.errorCentsThresh) {
        return opts.colorHitNote;
      } else {
        return opts.colorMissedNote;
      }
    } else if (this.isPassed(curSongTime)) {
      if (this.score < opts.errorCentsThresh) {
        return opts.colorHitNote;
      } else {
        return opts.colorMissedNote;
      }
    } else {
      return this.colorDefault;
    }
  }

  draw(curSongTime, freq) {
    if (this.startTime < curSongTime - this.windowSecs) { return; }
    if (this.startTime + this.duration > curSongTime + this.windowSecs) { return; }
    let x1 = map(this.startTime, curSongTime - this.windowSecs, curSongTime + this.windowSecs, 0, width);
    let x2 = map(this.startTime + this.duration, curSongTime - this.windowSecs, curSongTime + this.windowSecs, 0, width);

    if (this.isActive(curSongTime)) {
      this.updateScore(freq);
    }
    let color = this.getColor(curSongTime);

    // draw note
    noStroke();
    fill(color);
    rect(x1, this.height - this.diameter/2, x2-x1, this.diameter);

    // write word
    textAlign(LEFT);
    if (this.isUpcoming(curSongTime)) {
      fill(opts.colorLyricsUpcoming);
    }
    textSize(opts.fontSizeLyrics);
    let wordHeight = this.height - this.diameter/2; // with note
    if (showLyricsAboveStaff) {
      wordHeight = freqToHeight(midiToFreq(opts.midiNoteStaffMax)) - opts.fontSizeLyrics/2;
    }
    text(this.name, x1, wordHeight);
  }
}

function drawStaffs() {
  for (var i = opts.midiNoteStaffMin; i <= opts.midiNoteStaffMax; i++) {
    let curHeight = freqToHeight(midiToFreq(i));
    stroke('white');
    strokeWeight(1);
    line(0, curHeight, width, curHeight);
  }
}

function showScore(curSongTime) {
  let nNotes = 0;
  let nHit = 0;
  let sumScore = 0;
  let errWhenHit = 0;
  for (let note of songNotes) {
    if (note.isPassed(curSongTime)) {
      nNotes += 1;
      if (!isNaN(note.score)) {
        sumScore += note.score;
        if (note.score < opts.errorCentsThresh) {
          errWhenHit += note.scoreSigned;
        }
      }
      nHit += (note.score < opts.errorCentsThresh);
    }
  }
  // if (nNotes === 0) { return; }
  let meanScore = sumScore/nNotes;
  let meanScoreWhenHit = errWhenHit/nHit;
  let pctHit = 100*nHit/nNotes;

  let scoreHeight = 20 + opts.fontSizeScore;

  fill(opts.colorHitNote); noStroke();
  ellipse(width/2, scoreHeight-opts.fontSizeScore/3, 0.9*scoreHeight, 0.9*scoreHeight);

  // average error
  if (!isNaN(meanScoreWhenHit)) {
    let errAng = map(meanScoreWhenHit, -opts.errorCentsThresh, opts.errorCentsThresh, -PI/2, PI/2);
    let startAng = -PI/2;
    let endAng = startAng + errAng;
    if (endAng < startAng) {
      let tmpAng = endAng;
      endAng = startAng;
      startAng = tmpAng;
    }    
    noFill();
    stroke('red');
    strokeWeight(3);
    arc(width/2, scoreHeight-opts.fontSizeScore/3, 0.9*scoreHeight, 0.9*scoreHeight, startAng, endAng);
  }

  // total score
  textSize(opts.fontSizeScore);
  fill('white');
  noStroke();
  textAlign(CENTER);
  text(nHit.toFixed(0 ), width/2, scoreHeight);
  textAlign(LEFT);
}

function showTitle() {
  let a = songData.artist;
  let b = songData.title;
  textAlign(CENTER);
  textSize(opts.fontSizeTitle);
  fill('white');
  noStroke();
  text('"' + b + '" by ' + a, width/2, height-1.5*opts.fontSizeTitle);
  textAlign(LEFT);
}

function draw() {
  background(opts.backgroundColor);
  drawStaffs();

  // draw notes if on screen
  let curSongTime = audioEl.time();
  for (let note of songNotes) {
    note.draw(curSongTime, freq);
  }

  // show current time
  stroke('white');
  strokeWeight(1);

  let y1 = freqToHeight(midiToFreq(opts.midiNoteStaffMin));
  let y2 = freqToHeight(midiToFreq(opts.midiNoteStaffMax));
  line(width/2, y1, width/2, y2);

  // show pitch being sung
  if (doDetectPitch) {
    freq = detectPitch(fft);
    let freqHeight = freqToHeight(freq);
    noStroke(); fill(opts.pitchColor);
    ellipse(width/2, freqHeight, opts.pitchDiameter);
  }

  showScore(curSongTime);
  showTitle();
}

function keyPressed() {
  if (keyCode === 70) { // F key
    doDetectPitch = !doDetectPitch;
  }
}
