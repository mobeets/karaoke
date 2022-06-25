/**
 *  Pitch Detection using Auto Correlation.
 *  
 *  Auto correlation multiplies each sample in a buffer by all
 *  of the other samples. This emphasizes the fundamental
 *  frequency.
 *
 *  Running the signal through a low pass filter prior to
 *  autocorrelation helps bring out the fundamental frequency.
 *  
 *  The visualization is a correlogram, which plots
 *  the autocorrelations.
 *
 *  We calculate the pitch by counting the number of samples
 *  between peaks.
 *  
 *  Example by Jason Sigal and Golan Levin.
 */

var source, fft, lowPass;

// center clip nullifies samples below a clip amount
let centerClipThreshold = 0.0;
let varThreshold = 0.0;

let baseFrequency = 440; // Hz (440 = middle A)
var lineNotes = [];
let pitchHistory = [];
let pitchConfidenceHistory = [];

const opts = {
  stepX: 2,
  lowFreq: 100,
  highFreq: 1000,
  freqThresh: 5, // to make lines wiggle
  preNormalize: true, // normalize pre autocorrelation
  postNormalize: true, // normalize post autocorrelation
  doCenterClip: false, // zero out any values below the centerClipThreshold
  alphaSmoothing: 0.8, // alpha for exponential smoothing of frequency
  alphaSmoothingVar: 0.8, // alpha for exponential smoothing of frequency
}

let freq = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();

  source = new p5.AudioIn();
  source.start();

  lowPass = new p5.LowPass();
  lowPass.disconnect();
  source.connect(lowPass);

  fft = new p5.FFT();
  fft.setInput(lowPass);

  initPitchHistory(width / 2);
  initLineNotes();
}

function draw() {
  background(200);

  // array of values from -1 to 1
  var timeDomain = fft.waveform(1024, 'float32');
  var corrBuff = autoCorrelate(timeDomain);

  freq = constrain(findFrequency(corrBuff), 0, 5*opts.highFreq);
  fill('black');
  text('Center Clip: ' + centerClipThreshold.toFixed(2), 20, 20);
  text('Variance threshold: ' + varThreshold.toFixed(2), 20, 35);
  text('Fundamental Frequency: ' + freq.toFixed(2), 20, 50);

  let currentFreq = map(freq.toFixed(2), opts.lowFreq, opts.highFreq, height, 0);
  let showCurrentFreq = drawPitchHistory(pitchHistory, currentFreq);
  updateLineNotes(showCurrentFreq);
}

function drawPitchHistory(pitchHistory, currentFreq) {
  stroke('red');
  noFill();
  strokeWeight(1);
  beginShape();
  
  let runningMean = 0;
  let runningVar = 0;
  varThreshold = Math.pow(map(mouseY, height, 0, 0, 40), 2);
  for (let i = 0; i < pitchHistory.length; i++) {
    if (pitchHistory[i] > 0) {
      runningMean = (1-opts.alphaSmoothing)*runningMean + opts.alphaSmoothing*pitchHistory[i];
      runningVar = (1-opts.alphaSmoothingVar)*runningVar + opts.alphaSmoothingVar*Math.pow(pitchHistory[i] - runningMean, 2);
      if (runningVar < varThreshold) {
        vertex(i * opts.stepX, pitchHistory[i]);
      } else {
        endShape(); beginShape();
      }
    }
    if (i > 0) {
      pitchHistory[i - 1] = pitchHistory[i];
      pitchConfidenceHistory[i - 1] = pitchConfidenceHistory[i];
    }
  }
  pitchHistory[pitchHistory.length - 1] = currentFreq;
  runningVar = (1-opts.alphaSmoothingVar)*runningVar + opts.alphaSmoothingVar*Math.pow(currentFreq - runningMean,2);
  pitchConfidenceHistory[pitchHistory.length - 1] = runningVar;
  endShape();

  let showCurrentFreq = true;
  if ((runningVar > varThreshold) || (currentFreq <= 0)) {
    showCurrentFreq = false;
  }
  return showCurrentFreq;
}

function updateLineNotes(showCurrentFreq) {
  // Line Notes
  for (let line of lineNotes) {    
    line.draw();
    if (showCurrentFreq && line.isFocus(freq, opts.freqThresh)) {
      line.setOn();
    } else {
      line.setOff();
    }
  }
}

function initPitchHistory(stageWidth) {
  for (let i = 0; i < stageWidth + opts.stepX; i += opts.stepX) {
    pitchHistory.push(0);
    pitchConfidenceHistory.push(0);
  }
}

function initLineNotes() {
  let noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#','G', 'G#'];
  for (var i = -24; i < 24; i++) {
    let curFrequency = baseFrequency * Math.pow(2, i/12);
    let freq = constrain(map(curFrequency, opts.lowFreq, opts.highFreq, height, 0), 0, height);
    let key = noteNames[((i + 24) % noteNames.length)];
    lineNotes.push(new LineNote(curFrequency, key, freq));
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
