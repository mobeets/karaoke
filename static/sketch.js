let mic, fft; // for listening
let osc, playing, freq, amp; // for playing
let canvasWidth = 700;
let canvasHeight = 400;
let spectrumSmoothing = 0.8; // between 0.0 and 1.0
let spectrumBins = 1024; // 2^k for k between 4 and 10
let nFramesPerStep = 30;
let fr = 30; // frame rate (fps)
let firstMidiNote = 60; // 60 middle C
let nMidiNotes = 24;
let octaveBands;
let freqs; // Hz
let frameStart;
let spectrum;
let userInput;
let curStep;
let userInputs;
let data; // for storing fft data per note

function setup() {
   frameRate(fr); // Attempt to refresh at starting FPS

   let canvas = createCanvas(canvasWidth, canvasHeight);
   canvas.parent('sketch-container');
   noFill();
   textFont('Georgia');

   // monitor microphone input
   mic = new p5.AudioIn();
   mic.start();
   fft = new p5.FFT(spectrumSmoothing, spectrumBins);
   fft.setInput(mic);

   // prepare to play tone
   osc = new p5.Oscillator('triangle');

   // generate desired frequencies
   freqs = [];
   for (var i = 0; i < nMidiNotes; i++) {
      freqs.push(midiToFreq(firstMidiNote + i));
   }

   // for logging fft data per note
   data = [];
   userInputs = [];
   octaveBands = fft.getOctaveBands(12, 16.3516);
   // n.b. 16.3515 chosen so the centers of the bands match the frequencies of midi notes
}

function playOscillator() {
   // starting an oscillator on a user gesture will enable audio
   // in browsers that have a strict autoplay policy.
   // See also: userStartAudio();
   osc.start();
   osc.amp(1, 0.1);
   playing = true;
   frameStart = frameCount;
   curStep = 0;
   userInputs = [];
}

function stopOscillator() {
   // ramp amplitude to 0 over 0.5 seconds
   osc.amp(0, 0.5);
   playing = false;
}

function togglePlaying() {
   if (!playing) {
      playOscillator();
   }
   else {
      stopOscillator();
   }
}

function updateStep() {
   // curStep = Math.floor((frameCount - frameStart) / nFramesPerStep);
   if ((frameCount - frameStart) % nFramesPerStep == 0) {
      logData();
      curStep++;
   }
   if (curStep >= freqs.length) { stopOscillator(); }
}

function updateSynth() {
   if (!playing) { return; }
   
   updateStep();
   freq = constrain(freqs[curStep], Math.min.apply(Math, freqs), Math.max.apply(Math, freqs));
   amp = 1;

   fill('black');
   noStroke();
   text('freq: ' + freq, 20, 20);
   text('curStep: ' + curStep, 20, 40);
   text('amp: ' + amp, 20, 60);

   if (playing) {
      // smooth the transitions by 0.1 seconds
      osc.freq(freq, 0.1);
      osc.amp(amp, 0.1);
   }
}

function draw() {
   background(255);

   // display processed mic input
   getAndShowInput();

   // update synth frequency and amplitude
   updateSynth();
}

function downloadData() {
   let content = JSON.stringify(data, null, 2);
   let fileName = 'data.json';
   let contentType = 'text/plain';
   var a = document.createElement("a");
   var file = new Blob([content], {type: contentType});
   a.href = URL.createObjectURL(file);
   a.download = fileName;
   a.click();
}

function logData() {
   // change to make userInput into multiple entries
   let row = {'curStep': curStep, 'freq': freq, 'userInputs': userInputs, 'octaveBands': octaveBands};
   data.push(row);
   userInputs = [];
}

function getAndShowInput() {
   spectrum = fft.analyze(spectrumBins);
   noFill();
   let c = color(255, 187, 0);
   stroke(c);
   strokeWeight(2);

   let amps = fft.logAverages(octaveBands);
   // let amps = spectrum;
   for (i = 0; i<amps.length; i++) {      
      let vx = map(i, 0, amps.length, 0, width);
      let vy = map(amps[i], 0, 255, height, 0);
      line(vx, height, vx, vy);
   }
   userInput = amps;
   userInputs.push(userInput);
}

function keyPressed() {
   if (keyCode === RIGHT_ARROW) {
   }
   if (keyCode === UP_ARROW) {
   }
}
