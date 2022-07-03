// pitch detection from code via Jason Sigal and Golan Levin.

let source, fft, lowPass;
let showCurrentFreq = true; // for showing or not based on noise
let centerClipThreshold = 0.0; // nullifies samples below a clip amount
let varThreshold = 0.0;
let freq = 0;
let lineNotes = [];
let pitchHistory = [];
let pitchConfidenceHistory = [];
// let viewStyle = 'frequency';
let viewStyle = 'chromatic';
let showStats = false;
let lastScore = { score: 0, percentCorrect: 0, notesHit: 0, notesMissed: 0, notesTotal: 0};
let lastScoreTime = 0;
let fps = 45; // frames per second (attempted)
let songNoteTranspose = -12; // midi notes to add to every note
let bpm = 120; // beats per minute
let stepX = 2; // pixel translations per frame
let tickDivisor = 1; // for fitting in one tick per frame

const opts = {
  pitchHistoryProportion: 0.5, // proportion of screen
  pitchHistoryColor: '#9691e6',
  cursorColor: '#5751b0',
  cursorDiameter: 14, // radius of circle showing current pitch
  noteDiameter: 14, // radius of circle showing note
  midiNoteScreenMin: 45, // lowest note in range of screen
  midiNoteScreenMax: 77, // highest note in range of screen
  midiNoteStaffMin: 50, // lowest note drawn on staff
  midiNoteStaffMax: 72, // highest note drawn on staff
  centsThresh: 100, // to make lines wiggle
  preNormalize: true, // normalize pre autocorrelation
  postNormalize: true, // normalize post autocorrelation
  doCenterClip: false, // zero out any values below the centerClipThreshold
  alphaSmoothing: 0.8, // alpha for exponential smoothing of frequency
  alphaSmoothingVar: 0.8, // alpha for exponential smoothing of frequency
  timeBuffer: 100, // buffer at end of song before scoring
  framesToShowScore: 200, // number of frames to show score
  fontSizeNote: 14,
  fontSizeDefault: 14,
  fontSizeScore: 14,
  fontSizeLyrics: 12,
};

let songState = 'stop';
let songStateOnPause;
let songCurrentTime = -1;
let notesObj = [];
let songData = {};
let randomSongLength = 5;

function makeRandomSong(nNotes) {
  let firstTime = 1;
  let timeSpacing = 40;
  let noteRange = (opts.midiNoteStaffMax - opts.midiNoteStaffMin);
  let songNotes = [];
  let randomWords = ['hi', 'i', 'love', 'your', 'body', 'so', 'what'];
  for (var i = 0; i < nNotes; i++) {
    let randomMidiNote = +(opts.midiNoteStaffMin + noteRange*random()).toFixed(0);
    let randomWordIndex = +((randomWords.length-1)*random() - 0.5).toFixed(0);
    let curNote = {
      note: randomMidiNote,
      time: timeSpacing*i + firstTime,
      name: randomWords[randomWordIndex] };
    songNotes.push(curNote);
  }
  songData = { name: "Random", notes: songNotes };
}

function tempoToBpm(tempo) { return (60 * 1000000) / tempo; }

function loadSong(songName) {
  songData = letItBe;
  bpm = tempoToBpm(songData.tempos[0].tempo);
  let tps = songData.ticks_per_beat * (bpm/60); // ticks per second
  tickDivisor = (tps/fps)/stepX; // ticks per frame
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  frameRate(fps);

  source = new p5.AudioIn();
  source.start();

  lowPass = new p5.LowPass();
  lowPass.disconnect();
  source.connect(lowPass);

  fft = new p5.FFT();
  fft.setInput(lowPass);

  // makeRandomSong(randomSongLength);
  loadSong('let-it-be');
  initPitchHistory(opts.pitchHistoryProportion*width);
  initLineNotes();
}

function draw() {
  background('#383636');
  let isPaused = songState.localeCompare("pause") == 0;

  if (!isPaused) {
    // array of values from -1 to 1
    var timeDomain = fft.waveform(1024, 'float32');
    var corrBuff = autoCorrelate(timeDomain);
    freq = constrain(findFrequency(corrBuff), 0, midiToFreq(opts.midiNoteScreenMax));
  }
  noStroke();
  if (showStats) {
    fill('white');
    textSize(opts.fontSizeDefault);
    // text('Center Clip: ' + centerClipThreshold.toFixed(2), width - 220, 20);
    text('Frame rate: ' + frameRate().toFixed(0), width - 220, 20);
    text('Variance threshold: ' + varThreshold.toFixed(1), width - 220, 35);
    // text('Fundamental Frequency: ' + freq.toFixed(1), width - 220, 50);
  }

  // music staff
  drawMusicStaff(showCurrentFreq);
  noFill(); stroke('#ababab'); strokeWeight(1); line(width/2,0,width/2,height);

  // pitch history
  let freqPos = freqToHeight(freq);
  showCurrentFreq = drawPitchHistory(pitchHistory, freqPos, isPaused);
  if (showCurrentFreq) {
    fill(opts.cursorColor);
    noStroke();
    ellipse(pitchHistory.length * stepX, freqPos, opts.cursorDiameter);
    labelCurrentNote(freqPos);
  }
  
  // song notes
  if (songState.localeCompare("play") == 0) {
    drawSongNotes(showCurrentFreq, isPaused);
  }

  if (!isPaused) {
    checkIfSongEnded();
    scoreSong();
  }
  showScore();
}

function roundTo(x, n) { return +x.toFixed(n); }

function drawSongNotes(showCurrentFreq, isPaused) { 
  let n = songData.notes;
  
  for (var i = 0; i < stepX; i++) { // draw the next stepX notes
    let index = 0;
    songCurrentTime += 1;
    for (let note of n) {
      if (isPaused) {
        continue;
      } else if (songCurrentTime === roundTo(note.time/tickDivisor, 0)) {
        // create note (just to right edge of screen)
        let id = note.note + songNoteTranspose;
        let noteFreq = midiToFreq(id);
        let posY = freqToHeight(noteFreq);
        let pos = createVector(width, posY);
        notesObj.push(new Note(noteFreq, pos, opts.noteDiameter, note.name));
      } else if (songCurrentTime > roundTo(note.time/tickDivisor, 0)) {
        // note is in view
        if (songCurrentTime - (+(opts.pitchHistoryProportion*width).toFixed(0)) === roundTo(note.time/tickDivisor, 0)) {
          // note currently being sung
          notesObj[index].setScore(freq, opts.centsThresh, showCurrentFreq);
        } else {
          // note currently on screen
          if (showCurrentFreq && notesObj[index].isFocus(freq, opts.centsThresh)) {
            notesObj[index].setOn();
          } else {
            notesObj[index].setOff();
          }
        }
        notesObj[index].update();
        notesObj[index].draw();
      }
      index++;
    }
  }
}

function checkIfSongEnded() {
  let maxSongTime = songData.notes[songData.notes.length-1].time;
  if (songCurrentTime - width*opts.pitchHistoryProportion > maxSongTime + opts.timeBuffer) {
    console.log('song ended');
    endSong();
  }
}

function endSong() {
  songState = "play"; // restarts song
  notesObj = [];
  songCurrentTime = -1;
}

function scoreSong() {
  // todo: update incrementally, as notes are passed

  // get scores of all notes that have passed
  let avgError = 0;
  let nNotesPassed = 0;
  let nNotesHit = 0;
  let nNotesSung = 0;
  for (let note of notesObj) {
    if (note.isPassed) {
      nNotesPassed += 1;
      let score = note.score;
      if (!isNaN(score)) {
        nNotesSung += 1;
        avgError += Math.abs(score);
        nNotesHit += Math.abs(score) < opts.centsThresh;
      }
    }
  }

  if (nNotesSung > 0) {
    lastScore = {
      score: avgError/nNotesSung,
      percentCorrect: 100*nNotesHit/nNotesSung,
      notesHit: nNotesHit,
      notesMissed: nNotesPassed-nNotesSung,
      notesTotal: nNotesPassed
    };
    lastScoreTime = frameCount;
  }
}

function showScore() {
  if ((lastScoreTime > 0)) {// && (frameCount - lastScoreTime < opts.framesToShowScore)) {
    textSize(opts.fontSizeScore);
    fill('white');
    noStroke();
    text('Average error (cents): ' + lastScore.score.toFixed(1), 20, 20);
    text('Notes hit: ' + lastScore.notesHit + ' of ' + lastScore.notesTotal + ' (' + lastScore.percentCorrect.toFixed(1) + '%)', 20, 25 + opts.fontSizeScore);
    textSize(opts.fontSizeDefault);
  }
}

function drawPitchHistory(pitchHistory, freqPos, isPaused) {
  // stroke('#ff6969');
  stroke(opts.pitchHistoryColor);
  noFill();
  strokeWeight(2);
  beginShape();
  
  let runningMean = 0;
  let runningVar = 0;
  varThreshold = Math.pow(map(mouseY, height, 0, 0, 40), 2);
  for (let i = 0; i < pitchHistory.length; i++) {
    if (pitchHistory[i] > 0) {
      runningMean = (1-opts.alphaSmoothing)*runningMean + opts.alphaSmoothing*pitchHistory[i];
      runningVar = (1-opts.alphaSmoothingVar)*runningVar + opts.alphaSmoothingVar*Math.pow(pitchHistory[i] - runningMean, 2);
      if (runningVar < varThreshold) {
        vertex(i * stepX, pitchHistory[i]);
      } else {
        endShape(); beginShape();
      }
    }
    if (!isPaused && (i > 0)) {
      pitchHistory[i - 1] = pitchHistory[i];
      pitchConfidenceHistory[i - 1] = pitchConfidenceHistory[i];
    }
  }
  if (!isPaused) {
    pitchHistory[pitchHistory.length - 1] = freqPos;
    runningVar = (1-opts.alphaSmoothingVar)*runningVar + opts.alphaSmoothingVar*Math.pow(freqPos - runningMean,2);
    pitchConfidenceHistory[pitchHistory.length - 1] = runningVar;
  }
  endShape();

  let showCurrentFreq = true;
  if ((runningVar > varThreshold) || (freqPos <= 0)) {
    showCurrentFreq = false;
  }
  return showCurrentFreq;
}

function drawMusicStaff(showCurrentFreq) {
  // Line Notes
  for (let line of lineNotes) {    
    line.draw();
    if (showCurrentFreq && line.isFocus(freq, opts.centsThresh)) {
      line.setOn();
    } else {
      line.setOff();
    }
  }
}

function labelCurrentNote(freqPos) {
  // Line Notes
  for (let line of lineNotes) {    
    if (line.isOn) {
      textSize(opts.fontSizeNote);
      textAlign(CENTER);
      noStroke();
      fill('white');
      // text(line.name, opts.pitchHistoryProportion*width, freqPos - opts.cursorDiameter);
      text(line.name, opts.pitchHistoryProportion*width, line.posY - opts.cursorDiameter);
      textAlign(LEFT);
      textSize(opts.fontSizeDefault);
      return;
    }
  }
}

function initPitchHistory(stageWidth) {
  for (let i = 0; i < stageWidth + stepX; i += stepX) {
    pitchHistory.push(0);
    pitchConfidenceHistory.push(0);
  }
}

function initLineNotes() {
  let noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#','G', 'G#'];
  for (var i = opts.midiNoteStaffMin; i <= opts.midiNoteStaffMax; i++) {
    let curFrequency = midiToFreq(i);
    let freqPos = freqToHeight(curFrequency);
    // 69 is middle A
    let key = noteNames[((i - 69 + 12*5) % noteNames.length)];
    lineNotes.push(new LineNote(curFrequency, key, freqPos));
  }
}

function freqToHeight(curFreq) {
  if (viewStyle.localeCompare("frequency") == 0) {
    return map(+curFreq.toFixed(2), midiToFreq(opts.midiNoteScreenMin), midiToFreq(opts.midiNoteScreenMax), height, 0);
  } else if (viewStyle.localeCompare("chromatic") == 0) {
    if (curFreq <= 0) { return 0; }
    let fcur = Math.log(curFreq) - Math.log(midiToFreq(opts.midiNoteScreenMin));
    let fmax = Math.log(midiToFreq(opts.midiNoteScreenMax)) - Math.log(midiToFreq(opts.midiNoteScreenMin));
    return map(+fcur.toFixed(2), 0, fmax, height, 0);
    // convert curFreq to cents rel. to lowFreq
    // convert to proportion between 0 and 1
    // map to height
  }
}

function mouseClicked() {
  if (songState.localeCompare("notready") == 0) { return; }
  if (songState.localeCompare("play") == 0) {
    console.log("stopping song");
    endSong();
  } else {
    console.log("playing song");
    songState = "play";
  }
}

function keyPressed() {
  // todo: make it space bar
  if (keyCode === 32) {
    if (songState.localeCompare("pause") == 0) {
      songState = songStateOnPause;
      console.log("restoring state: " + songStateOnPause);
    } else {
      songStateOnPause = songState;
      songState = "pause";
      console.log("pausing");
    }
  } else if (keyCode === DOWN_ARROW) {
    showStats = !showStats;
  }
}

// accepts a timeDomainBuffer and multiplies every value
function autoCorrelate(timeDomainBuffer) {
  
  var nSamples = timeDomainBuffer.length;

  // pre-normalize the input buffer
  if (opts.preNormalize){
    timeDomainBuffer = normalize(timeDomainBuffer);
  }

  // zero out any values below the centerClipThreshold
  if (opts.doCenterClip) {
    timeDomainBuffer = centerClip(timeDomainBuffer);
  }

  var autoCorrBuffer = [];
  for (var lag = 0; lag < nSamples; lag++){
    var sum = 0; 
    for (var index = 0; index < nSamples; index++){
      var indexLagged = index+lag;
      if (indexLagged < nSamples){
        var sound1 = timeDomainBuffer[index];
        var sound2 = timeDomainBuffer[indexLagged];
        var product = sound1 * sound2;
        sum += product;
      }
    }

    // average to a value between -1 and 1
    autoCorrBuffer[lag] = sum/nSamples;
  }

  // normalize the output buffer
  if (opts.postNormalize){
    autoCorrBuffer = normalize(autoCorrBuffer);
  }

  return autoCorrBuffer;
}


// Find the biggest value in a buffer, set that value to 1.0,
// and scale every other value by the same amount.
function normalize(buffer) {
  var biggestVal = 0;
  var nSamples = buffer.length;
  for (var index = 0; index < nSamples; index++){
    if (abs(buffer[index]) > biggestVal){
      biggestVal = abs(buffer[index]);
    }
  }
  for (var index = 0; index < nSamples; index++){

    // divide each sample of the buffer by the biggest val
    buffer[index] /= biggestVal;
  }
  return buffer;
}

// Accepts a buffer of samples, and sets any samples whose
// amplitude is below the centerClipThreshold to zero.
// This factors them out of the autocorrelation.
function centerClip(buffer) {
  var nSamples = buffer.length;

  // center clip removes any samples whose abs is less than centerClipThreshold
  centerClipThreshold = map(mouseY, 0, height, 0, 1);

  if (centerClipThreshold > 0.0) {
    for (var i = 0; i < nSamples; i++) {
      var val = buffer[i];
      buffer[i] = (Math.abs(val) > centerClipThreshold) ? val : 0;
    }
  }
  return buffer;
}

// Calculate the fundamental frequency of a buffer
// by finding the peaks, and counting the distance
// between peaks in samples, and converting that
// number of samples to a frequency value.
function findFrequency(autocorr) {

  var nSamples = autocorr.length;
  var valOfLargestPeakSoFar = 0;
  var indexOfLargestPeakSoFar = -1;

  for (var index = 1; index < nSamples; index++){
    var valL = autocorr[index-1];
    var valC = autocorr[index];
    var valR = autocorr[index+1];

    var bIsPeak = ((valL < valC) && (valR < valC));
    if (bIsPeak){
      if (valC > valOfLargestPeakSoFar){
        valOfLargestPeakSoFar = valC;
        indexOfLargestPeakSoFar = index;
      }
    }
  }
  
  var distanceToNextLargestPeak = indexOfLargestPeakSoFar - 0;

  // convert sample count to frequency
  var fundamentalFrequency = sampleRate() / distanceToNextLargestPeak;
  return fundamentalFrequency;
}
