var mic, fft, pos, vel, A, B, c, trgPos;
var gain = 0.002;
var canvasWidth = 700;
var canvasHeight = 500;
var circRadius = 25;
var score = 0;
var ntrials = 0;
var cursorTrace;
var spectrumSmoothing = 0.8; // between 0.0 and 1.0
var spectrumBins = 1024; // 2^k for k between 4 and 10
var spectrum;
var userInput;
// var nInputDims = 1024; // spectrum.length
var nInputDims = 32;
var showCheat = false;

var pdClrInds; // for cheating
var trgRadius = 50;
var trgDistance = 200;
var curTrgInd = 0;
var curTrgClr = 0;
var trgAngs = new Array(0, 45, 90, 135, 180, 225, 270, 315);
var trgClrs = [[0.8431,0.1882,0.1529],
   [0.9569,0.4275,0.2627],
   [0.9922,0.6824,0.3804],
   [0.9961,0.8784,0.5451],
   [0.8510,0.9373,0.5451],
   [0.6510,0.8510,0.4157],
   [0.4000,0.7412,0.3882],
   [0.1020,0.5961,0.3137]];

function setup() {
   var canvas = createCanvas(canvasWidth, canvasHeight);
   canvas.parent('sketch-container');
   noFill();
   textFont('Georgia');

   // monitor microphone input
   mic = new p5.AudioIn();
   mic.start();
   fft = new p5.FFT(spectrumSmoothing, spectrumBins);
   fft.setInput(mic);

   // initialize experiment
   startNewExperiment();
}

function startNewExperiment() {
   setDecoder();
   startNewTrial(false);
   score = 0;
   ntrials = 0;
}

function setDecoder() {
   c = createVector(0, 0);
   A = [createVector(0.5, 0), createVector(0, 0.5)];
   B = new Array();

   var nextMax = -2;
   var j = -1;
   var pdInds = new Array(); // pushing directions
   pdInds = new Array(0, 1, 2, 3, 4, 5, 6, 7);
   pdInds = shuffle(pdInds);
   var pd;
   pdClrInds = new Array();
   // angs = new Array();
   for (i = 0; i<nInputDims; i++) {
      if (i > nextMax) { // move to next quadrant
         j = j + 1;
         nextMax = random(i+2, i+4); // index of next quadrant change
      }
      if (j == pdInds.length) {
         j = 0;
         pdInds = shuffle(pdInds);
      }
      pd = trgAngs[pdInds[j]]; // current quadrant
      pd = pd + random(-10, 10); // add jitter
      pdClrInds = concat(pdClrInds, pdInds[j]);
      ang = pd*PI/180; // convert to radians
      B = concat(B, createVector(cos(ang), sin(ang)));
   }
}

function startNewTrial(isSuccess) {
   pos = createVector(canvasWidth/2.0,canvasHeight/2.0);
   vel = createVector(0,0);
   trgPos = setRandomTarget();
   cursorTrace = new Array();
   if (isSuccess) {
      score = score + 1;
   }
   ntrials = ntrials + 1;
}

function draw() {

   // draw target, cursor history, and score
   background(255);
   showTarget();
   showCursorHistory();
   showScore();

   // display processed mic input
   getAndShowInput();

   // update decoder with mic input
   updateAndDrawCursor();
   checkIfCursorAcquiredTarget();   

}

function getAndShowInput() {
   spectrum = fft.analyze(spectrumBins);
   noFill();
   var c = color(255, 187, 0);
   stroke(c);
   strokeWeight(2);

   beginShape();
   var amps = fft.logAverages(fft.getOctaveBands(3));
   for (i = 0; i<amps.length; i++) {      
      var vx = map(i, 0, amps.length, 0, width);
      vertex(vx, map(amps[i], 0, 255, height, height/2));
   }
   endShape();
   userInput = amps;

   if (showCheat) {
      strokeWeight(2);
      var curClr;
      for (i = 0; i<pdClrInds.length; i++) {
         curClr = trgClrs[pdClrInds[i]];
         curClr = color(255*curClr[0], 255*curClr[1], 255*curClr[2]);
         stroke(curClr);
         fill(curClr);
         var vx = map(i, 0, pdClrInds.length, 0, width);
         // line(vx, height, vx, 7*height/8);
         ellipse(vx, height, 0.5*width/pdClrInds.length);
         // map(pdClrInds[i], -1, 7, height, 3*height/4));
      }
      noFill();
   }
}

function showCursorHistory() {
   beginShape();
   noFill();
   stroke(0);
   for (i = 0; i<cursorTrace.length; i++) {
      vertex(cursorTrace[i].x, cursorTrace[i].y);
   }
   endShape();
}

function updateAndDrawCursor() {
   vel = updateCursorVel(userInput, vel, A, B, c);
   pos = updateCursorPos(pos, vel, gain);
   resetIfHitBoundary();

   // draw cursor
   var clr = color(121, 141, 224);
   fill(clr);
   noStroke();
   ellipse(pos.x, pos.y, circRadius); // x, y, w, h
}

function showTarget() {
   var clr = color(255*curTrgClr[0], 255*curTrgClr[1], 255*curTrgClr[2]);
   fill(clr);
   noStroke();
   ellipse(trgPos.x, trgPos.y, trgRadius); // x, y, w, h
}

function setRandomTarget() {
   curTrgInd = random([0,1,2,3,4,5,6,7]);
   var angle = trgAngs[curTrgInd]*PI/180;
   curTrgClr = trgClrs[curTrgInd];
   trgPos = createVector(cos(angle), sin(angle));
   trgPos.mult(trgDistance);
   trgPos.add(canvasWidth/2.0, canvasHeight/2.0);
   return trgPos;
}

function updateCursorVel(spectrum, vel, A, B, c) {
   // vel[t] = A*vel[t-1] + B*spectrum + c

   // compute A*vel[t-1]
   var velx = p5.Vector.dot(A[0], vel);
   var vely = p5.Vector.dot(A[1], vel);
   var velNext = createVector(velx, vely);

   // compute B*spectrum
   for (i = 0; i<spectrum.length; i++) {
      velNext.add(p5.Vector.mult(B[i], spectrum[i]));
   }

   velNext.add(c);
   return velNext;
}

function updateCursorPos(pos, vel, gain) {
   pos = p5.Vector.add(pos, p5.Vector.mult(vel, gain));
   var curPos = createVector(pos.x, pos.y)
   append(cursorTrace, curPos);
   return pos;
}

function resetIfHitBoundary() {
   if (pos.x < 0 || pos.x > canvasWidth || pos.y < 0 || pos.y > canvasHeight) {
      startNewTrial(false);
   }
}

function checkIfCursorAcquiredTarget() {
   var d = dist(pos.x, pos.y, trgPos.x, trgPos.y);
   if (d < circRadius/2 + trgRadius/2) {
      var clr = color(100, 54, 50);
      fill(clr);
      noStroke();
      ellipse(trgPos.x, trgPos.y, trgRadius);
      startNewTrial(true);
   }
}

function showScore() {
  textSize(16);
  fill(0);
  strokeWeight(1);
  var msg = "Score: " + score.toString() + " out of " + ntrials.toString();
  text(msg, 15, 15);
}

function mouseClicked() {
   startNewExperiment();
}

function keyPressed() {
   if (keyCode === RIGHT_ARROW) {
      startNewTrial(false);
   }
   if (keyCode === UP_ARROW) {
      showCheat = !showCheat;
   }
}
