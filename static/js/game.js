let dataUrl = 'https://mobeets.github.io/ksdb/';
let songList;
let songData;
let curSession;
let curSongKey;
let mostRecentScore;

let hasBeenPlayed = false;
let hasBeenWarned = false;
let maxSongTime = 0;
let audioEl;
let songNotes = [];
let source, fft, lowPass;
let pitchHistory;
let pointMessages;
let freq = 0;
let songSelectionIndex = 0;
let songNoteTranspose = 60;
let songOffsetMsecs = 0;
let doDetectPitch = true;
let showLyricsAboveStaff = true;
let ignoreOctaveShifts = true; // does nothing yet!
let lastNoteCount = 0;
let lastHighlightTime = -1000;
let fps = 30;

let opts = {
  backgroundColor: '#383636',
  midiNoteStaffMin: 55, // lowest note drawn on staff
  midiNoteStaffMax: 75, // highest note drawn on staff
  midiNoteScreenMin: 50, // lowest note in range of screen
  midiNoteScreenMax: 80, // highest note in range of screen
  timePerThousandPixels: 3, // time (in seconds) shown on screen before/after
  noteColorDefault: '#898989', // default color for lyrics
  noteColorActive: 'white', // color for active lyric
  pitchColor: 'white', // color for circle showing pitch being sung
  pitchDiameter: 10, // diameter for circle showing pitch being sung
  pitchHistoryColor: '#cdcdcd', // color for circle showing pitch being sung
  errorCentsThresh: 50, // error allowed for a note counting
  highlightScoreDuration: fps/4,
  fontSizeLyrics: 14, // font size for lyrics
  fontSizeScore: 20, // font size for showing score
  colorHitNote: '#4ab833',
  colorMissedNote: '#e8514f',
  colorLyricsUpcoming: 'white',
};

function roundTo(x, n) { return +x.toFixed(n); }

function startAudio() {
  console.log('starting audio...');
  getAudioContext().resume();

  // prepare to detect pitch
  source = new p5.AudioIn();
  try {
    source.start();
  } catch {
    return;
  }
  lowPass = new p5.LowPass();
  lowPass.disconnect();
  source.connect(lowPass);
  fft = new p5.FFT();
  fft.setInput(lowPass);
  pitchHistory = new PitchHistory(width/2, opts.pitchHistoryColor);
  pointMessages = new PointMessages();
}

function setup() {
  // prepare canvas
  let cnv = createCanvas(windowWidth, windowHeight-80);
  cnv.parent("sketch-container");
  frameRate(fps);
}

function freqToHeight(curFreq) {
  if (curFreq <= 0) { return 0; }
  let fcur = Math.log(curFreq) - Math.log(midiToFreq(opts.midiNoteScreenMin));
  let fmax = Math.log(midiToFreq(opts.midiNoteScreenMax)) - Math.log(midiToFreq(opts.midiNoteScreenMin));
  return map(roundTo(fcur, 2), 0, fmax, height, 0);
}

function loadSongNotesAndLyrics(audioEl, songData) {
  let bps = songData.bpm/60; // beats per second
  let gap = songData.gap/1000 - songOffsetMsecs/1000; // time in seconds when lyrics start

  let ns = songData.notes;
  let songNoteTranspose = songData.note_transpose;

  // first need to find min/max notes for setting range
  let minNote = 100; let maxNote = 0;
  for (var i = 0; i < ns.length; i++) {
    let note = ns[i];
    if ((note.note + songNoteTranspose) < minNote) { minNote = note.note + songNoteTranspose; }
    if ((note.note + songNoteTranspose) > maxNote) { maxNote = note.note + songNoteTranspose; }
  }
  opts.midiNoteStaffMin = minNote;
  opts.midiNoteStaffMax = maxNote;
  opts.midiNoteScreenMin = opts.midiNoteStaffMin-2;
  opts.midiNoteScreenMax = opts.midiNoteStaffMax+2;

  // now create notes
  let lastStartTime = -1000;
  let lastWordOffset = 0;
  for (var i = 0; i < ns.length; i++) {
    let note = ns[i];
    let noteStartTime = gap + note.time/(4*bps);
    let noteDuration = note.duration/(4*bps);
    let noteFreq = midiToFreq(note.note + songNoteTranspose);
    let noteHeight = freqToHeight(noteFreq);
    let noteDiameter = roundTo(noteHeight - freqToHeight(Math.exp(opts.errorCentsThresh/(100*12) + Math.log(noteFreq))),1);
    let wordOffset = 0;
    if ((noteStartTime - lastStartTime < 0.25) && (lastWordOffset === 0)) {
      // if word is close enough, give it an offset
      wordOffset = 1;
    }

    songNotes.push(new Note(noteFreq, noteStartTime, noteDuration, note.name, noteHeight, noteDiameter, wordOffset));
    lastStartTime = noteStartTime;
    lastWordOffset = wordOffset;
  }
}

class PointMessages {
  constructor() {
    this.queue = [];
  }

  add(msg, x1, y1, x2, y2, color, duration, textSize) {
    let curPoint = {
      msg: msg,
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      color: color,
      duration: duration,
      textSize: textSize,
      t: 0,
    };
    this.queue.push(curPoint);
  }

  update() {
    let newQueue = [];
    for (var i = 0; i < this.queue.length; i++) {
      this.queue[i].t += 1;
      if (this.queue[i].t < this.queue[i].duration) {
        newQueue.push(this.queue[i]);
      }
    }
    this.queue = newQueue;
  }

  draw() {
    for (var i = 0; i < this.queue.length; i++) {
      let cp = this.queue[i];
      textSize(cp.textSize);
      fill(cp.color); noStroke();
      let t = cp.t / cp.duration;
      let x = cp.x1 + t*(cp.x2 - cp.x1);
      let y = cp.y1 + t*(cp.y2 - cp.y1);
      text(cp.msg, x, y);
    }
  }
}

function median(values){
  if(values.length === 0) throw new Error("No inputs");

  values.sort(function(a,b){
    return a-b;
  });

  var half = Math.floor(values.length / 2);
  
  if (values.length % 2)
    return values[half];
  
  return (values[half - 1] + values[half]) / 2.0;
}

class Note {
  constructor(freq, startTime, duration, name, height, diameter, wordOffset) {
    this.freq = freq;
    this.startTime = startTime;
    this.duration = duration;
    this.height = height;
    this.name = name;
    this.diameter = diameter;
    this.wordOffset = wordOffset; // for lyric height
    this.colorDefault = opts.noteColorDefault;
    this.colorActive = opts.noteColorActive;
    this.windowSecs = opts.timePerThousandPixels * (windowWidth/1000); // time on screen before or after
    this.score = NaN; // mean abs error in cents
    this.scoreSigned = NaN; // mean error in cents
    this.errs = [];
    this.errsSigned = [];
    this.scoreCount = 0;
    this.hasBeenActive = false;
    this.alerted = false;
    this.hasBeenFinalized = false;
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

  errorInCents(freq) {
    return 100*12*(Math.log(freq) - Math.log(this.freq));
  }

  updateScore(freq) {
    if (isNaN(this.score)) {
      this.score = 0;
      this.scoreSigned = 0;
      this.hasBeenActive = true;
    }

    let curError = this.errorInCents(freq);
    let curScore = curError;
    this.errs.push(Math.abs(curScore));
    this.errsSigned.push(curScore);

    this.scoreCount += 1;
    this.score = this.score + (Math.abs(curScore) - this.score)/this.scoreCount;
    this.scoreSigned = this.scoreSigned + (curScore - this.scoreSigned)/this.scoreCount;
  }

  finalizeScore() {
    this.score = median(this.errs);
    this.scoreSigned = median(this.errsSigned);
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
    if (this.startTime + this.duration < curSongTime - this.windowSecs) { return; }
    if (this.startTime > curSongTime + this.windowSecs) { return; }
    let x1 = map(this.startTime, curSongTime - this.windowSecs, curSongTime + this.windowSecs, 0, width);
    let x2 = map(this.startTime + this.duration, curSongTime - this.windowSecs, curSongTime + this.windowSecs, 0, width);

    if (this.isActive(curSongTime)) {
      this.updateScore(freq);
    } else if (this.hasBeenActive && !this.hasBeenFinalized) {
      this.finalizeScore();
      this.hasBeenFinalized = true;
    }
    let color = this.getColor(curSongTime);

    // draw note
    noStroke();
    if (this.isActive(curSongTime)) {
      fill(this.colorDefault);
      rect(width/2, this.height - this.diameter/2, x2-width/2, this.diameter);
      fill(color);
      rect(x1, this.height - this.diameter/2, width/2-x1, this.diameter);
    } else {
      fill(color);
      rect(x1, this.height - this.diameter/2, x2-x1, this.diameter);
    }

    // write word
    textAlign(LEFT);
    if (this.isUpcoming(curSongTime)) {
      fill(opts.colorLyricsUpcoming);
    }
    textSize(opts.fontSizeLyrics);
    let wordHeight;
    if (showLyricsAboveStaff) {
      wordHeight = freqToHeight(midiToFreq(opts.midiNoteStaffMax)) - opts.fontSizeLyrics/2;
      wordHeight -= this.wordOffset*opts.fontSizeLyrics/1.5;
    } else { // with note
      wordHeight = this.height - this.diameter/1.8;
    }
    text(this.name, x1, wordHeight);
  }
}

function drawStaffs() {
  for (var i = opts.midiNoteStaffMin; i <= opts.midiNoteStaffMax; i++) {
    stroke('white');
    strokeWeight(1);
    let curHeight = freqToHeight(midiToFreq(i));
    line(0, curHeight, width, curHeight);
  }
}

function getScoreHistory() {
  // load existing history
  let history = {};
  if (localStorage.getItem('history') !== null) {
    history = JSON.parse(localStorage.getItem('history'));
  }
  return history;
}

function logScore(mostRecentScore) {
  let history = getScoreHistory();

  // save, replacing data from current session if it exists
  if (history[mostRecentScore.song] === undefined) {
    history[mostRecentScore.song] = {};
    history[mostRecentScore.song][mostRecentScore.curSession] = mostRecentScore;
  } else {
    let curHistory = history[mostRecentScore.song][mostRecentScore.curSession];
    if (curHistory != undefined && (curHistory.curSession === mostRecentScore.curSession)) {
      if (curHistory.nHit > mostRecentScore.nHit) {
        // prevent overwriting history from the current session when the current time in the song has been moved earlier than where we have hit notes
        return;
      }
    }
    history[mostRecentScore.song][mostRecentScore.curSession] = mostRecentScore;
  }

  // update history
  localStorage.setItem('history', JSON.stringify(history));
}

function showScore(curTime) {
  let nNotes = 0;
  let nHit = 0;
  let sumScore = 0;
  let errWhenHit = 0;
  
  // score relative to the max time we've encountered
  // (to account for manual changes to curSongTime)
  curTime = max(maxSongTime, curTime);

  for (let note of songNotes) {
    if (note.isPassed(curTime)) {
      nNotes += 1;
      if (!isNaN(note.score)) {
        sumScore += note.score;
        if (note.score < opts.errorCentsThresh) {
          errWhenHit += note.scoreSigned;
        }
        if (note.startTime > maxSongTime) {
          // track max time in song encountered
          maxSongTime = note.startTime;
        }
      }
      nHit += (note.score < opts.errorCentsThresh);
    }
  }
  // if (nNotes === 0) { return; }
  let meanScore = sumScore/nNotes;
  let meanScoreWhenHit = errWhenHit/nHit;
  let pctHit = 100*nHit/nNotes;

  let scoreYPos = height - opts.fontSizeScore;
  let scoreHeight = 0.9*(20 + opts.fontSizeScore);

  // if we just got a point, highlight that
  let fontSizeScore = opts.fontSizeScore;
  // if ((mostRecentScore !== undefined) && (nHit > mostRecentScore.nHit) || ((frameCount - lastHighlightTime) < opts.highlightScoreDuration)) {
  //   if (nHit > mostRecentScore.nHit) {
  //     lastHighlightTime = frameCount;
  //   }
  //   fontSizeScore *= 1.5;
  //   scoreHeight *= 1.5;
  // }

  fill(opts.colorHitNote); noStroke();
  ellipse(width/2, scoreYPos-opts.fontSizeScore/3, scoreHeight, scoreHeight);

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
    arc(width/2, scoreYPos-opts.fontSizeScore/3, scoreHeight, scoreHeight, startAng, endAng);
  }

  // total score
  textSize(fontSizeScore);
  fill('white');
  noStroke();
  textAlign(CENTER);
  text(nHit.toFixed(0), width/2, scoreYPos);
  textAlign(LEFT);

  mostRecentScore = {
    'curSession': curSession,
    'song': curSongKey,
    'time': curTime,
    'nHit': nHit,
    'nNotes': nNotes,
    'meanScoreWhenHit': meanScoreWhenHit,
    'totalNotes': songNotes.length,
  };
}

function showTitle() {
  textSize(opts.fontSizeTitle);
  let a = songData.artist;
  let b = songData.title;
  $('#song-title').html('"' + b + '" by ' + a);
}

function showScoreCard() {

  let nHit = mostRecentScore.nHit;
  let totalNotes = mostRecentScore.totalNotes;
  let pctHit = 100*(nHit/totalNotes);

  fill(opts.colorHitNote); noStroke();
  ellipse(width/2, height/2, 0.5*min(width, height));
  fill('white');
  textAlign(CENTER, CENTER);
  textSize(opts.fontSizeLyrics);
  text('Final score', width/2, height/2 - 0.2*min(width, height));
  text('of ' + totalNotes + ' (' + pctHit.toFixed(0) + '%)', width/2, height/2 + 0.2*min(width, height));
  textSize(0.25*min(width, height));
  text(nHit.toFixed(0), width/2, height/2);
}

function findBestScore(scoreHistory) {
  let maxNotesHit = 0;
  let bestScore;
  for (var i = 0; i < Object.values(scoreHistory).length; i++) {
    let curScore = Object.values(scoreHistory)[i];
    if ((curScore.totalNotes !== undefined) && (curScore.nHit > maxNotesHit)) {
      maxNotesHit = curScore.nHit;
      bestScore = curScore;
    }
  }
  return bestScore;
}

function showScoreMatrix(scoreHistory, x, y, w, h) {
  let rows = [];
  for (var i = 0; i < Object.values(scoreHistory).length; i++) {
    let curScore = Object.values(scoreHistory)[i];
    if (curScore.totalNotes !== undefined) {
      let row = [curScore.nHit, curScore.nNotes, curScore.totalNotes];
      if ((curScore.nNotes/curScore.totalNotes > 0.1) && (curScore.nHit > 0)) {
        rows.push(row);
      }
    }
  }
  
  // if (rows.length < 2) { return; }

  let xPad = 3;
  let maxShown = Math.floor(w/xPad);
  let nSkip = max(0, rows.length - maxShown);
  // console.log([w, maxShown, rows.length, nSkip]);
  for (var i = nSkip; i < rows.length; i++) {
    let nHit = rows[i][0];
    let nNotes = rows[i][1];
    let N = rows[i][2];
    let cx = x + (i-nSkip)*xPad;
    let cy = y;
    // strokeWeight(1); stroke(opts.noteColorDefault);
    // line(cx, cy + h, cx, cy + h - (nNotes/N)*h);
    strokeWeight(1); stroke(opts.colorHitNote);
    line(cx, cy + h, cx, cy + h - (nHit/N)*h);
  }
  strokeWeight(1);
}

function showMenu() {
  if (songList === undefined) {
    return;
  }

  let history = getScoreHistory();
  let noHistory = false;
  if (Object.keys(history).length === 0) { noHistory = true; }
  let rectHeight = (windowHeight-80)/songList.length;
  let xText = 10;
  if (!noHistory) {
    $('#score-title').html('Best score');
    $('#score-title').css('font-size', 0.2*rectHeight);
  }
  $('#instructions').html('Choose a song.');
  $('#instructions').css('font-size', 0.2*rectHeight);

  textSize(0.25*rectHeight);
  // doing this here like a dummy
  opts.fontSizeLyrics = 0.25*rectHeight;
  opts.fontSizeScore = 0.25*rectHeight;
  opts.fontSizeTitle = 0.25*rectHeight;

  for (var i = 0; i < songList.length; i++) {
    let curSong = songList[i];
    let curHeight = i*rectHeight;
    if ((mouseY >= curHeight) && (mouseY < curHeight+rectHeight)) {
      songSelectionIndex = i;
    }
    if (i === songSelectionIndex) {
      fill('white'); noStroke();
      rect(0, curHeight, windowWidth, rectHeight);
      fill(opts.backgroundColor); noStroke();
    } else {
      fill('white'); noStroke();
    }
    textAlign(LEFT);
    let yOffset = noHistory ? rectHeight/2 : rectHeight/2.5;
    text(curSong.label, xText, curHeight + yOffset);
    if (history[curSong.value] !== undefined) {
      let bestScore = findBestScore(history[curSong.value]);
      if (bestScore !== undefined) {
        let pctHit = (100*bestScore.nHit/bestScore.totalNotes).toFixed(0);
        if (i === songSelectionIndex) {
          fill('green');
        } else {
          fill(opts.colorHitNote);
        }
        textAlign(RIGHT);
        text(bestScore.nHit + '/' + bestScore.totalNotes + ' (' + pctHit + '%)', windowWidth-1.5*xText, curHeight + 2*rectHeight/2.5);
        if (width > 300) {
          showScoreMatrix(history[curSong.value], windowWidth/3, curHeight + 0.5*rectHeight, windowWidth/3, 0.5*rectHeight-5);
        }
      }
    }
  }
}

function showCountdown(curSongTime) {
  let firstNote = songNotes[0].startTime;
  let windowSecs = opts.timePerThousandPixels * (windowWidth/1000);
  if (curSongTime + windowSecs/2 > firstNote) {
    $('#instructions').hide();
    return;
  }
  $('#instructions').html('Press play, sing along, and score <span style="color: ' + opts.colorHitNote + '">points</span> by matching your pitch ⬤ to the current <span style="background-color: ' + opts.noteColorDefault + '">note</span>.');
  if (isPaused()) { return; }
  let wordHeight = freqToHeight(midiToFreq(opts.midiNoteStaffMax)) - opts.fontSizeLyrics/2;
  textSize(opts.fontSizeLyrics);
  fill('white'); noStroke();
  textAlign(CENTER);
  text('' + (firstNote-curSongTime).toFixed(0) + '...', windowWidth/2, wordHeight);
}

function draw() {
  if (songData === undefined) {
    clear();
    showMenu();
    return;
  }
  $('#score-title').hide();
  if (source.enabled === false) {
    background(opts.backgroundColor);
    textSize(0.6*opts.fontSizeScore);
    textWrap(WORD);
    text("Please allow mic input to play. Or try a different browser if you're still having issues.", 20, windowHeight/4, 0.9*windowWidth);
    return;
  }
  background(opts.backgroundColor);
  drawStaffs();
  if (!hasBeenPlayed && !isPaused()) {
    hasBeenPlayed = true;
  }
  let curSongTime = audioEl.time();
  if (!hasBeenPlayed && curSongTime > 0) {
    if (!hasBeenWarned) {
      alert('Sorry, changing the song time before pressing play sometimes causes errors. Try refreshing if you have any issues.');
      hasBeenWarned = true;
    }
  }
  // text(frameRate().toFixed(0), 25, windowHeight-100);

  // draw notes if on screen
  let timeUntilNextNote = 1000;
  for (let note of songNotes) {
    note.draw(curSongTime, freq);
    if ((note.startTime  > curSongTime) && ((note.startTime-curSongTime) < timeUntilNextNote)) {
      timeUntilNextNote = note.startTime-curSongTime;
    }
    if (note.isPassed(curSongTime) && note.hasBeenActive && !note.alerted) {
      if (note.score <= opts.errorCentsThresh) {
        pointMessages.add("+1", width/2 - 2*opts.fontSizeScore, note.height, width/2 - 2*opts.fontSizeScore, note.height - 20, opts.colorHitNote, 0.5*fps, opts.fontSizeScore);
      }
      note.alerted = true;
    }
  }

  // update and messages
  pointMessages.update();
  pointMessages.draw();

  let pastLastNote = curSongTime > songNotes[songNotes.length-1].startTime + songNotes[songNotes.length-1].duration;
  if (pastLastNote) {
    showScoreCard();
  } else {

    // draw line showing current time
    stroke('white');
    strokeWeight(1);
    let y1 = freqToHeight(midiToFreq(opts.midiNoteStaffMin));
    let y2 = freqToHeight(midiToFreq(opts.midiNoteStaffMax));
    line(width/2, y1, width/2, y2);
    
    // show pitch being sung
    if (doDetectPitch) {
      pitchHistory.draw(curSongTime);
      freq = detectPitch(fft);
      let freqHeight = freqToHeight(freq);
      noStroke(); fill(opts.pitchColor);
      ellipse(width/2, freqHeight, opts.pitchDiameter);
      if (!isPaused()) {
        pitchHistory.update(curSongTime, freq);
      }
    }
    showCountdown(curSongTime); // early in song
    showScore(curSongTime);
  }

  showTitle();

  // save on pause or during gap before next note
  if (pastLastNote || isPaused() || (timeUntilNextNote > 1)) {
    if (mostRecentScore !== undefined) {
      if (mostRecentScore.nNotes != lastNoteCount) {
        console.log('saving...');
        logScore(mostRecentScore);
        lastNoteCount = mostRecentScore.nNotes;
      }
    }
  }
}

class PitchHistory {
  constructor(duration, color, windowSecs) {
    this.length = duration;
    this.color = color;
    this.times = [];
    this.history = [];
    this.windowSecs = opts.timePerThousandPixels * (width/1000); // time on screen before or after
    for (var i = 0; i < this.length; i++) {
      this.times.push(-1);
      this.history.push(-1);
    }
  }

  update(curSongTime, freq) {
    let y = [freq];
    this.history = y.concat(this.history);
    this.history.pop();

    let t = [curSongTime];
    this.times = t.concat(this.times);
    this.times.pop();
  }

  timeToXPos(t, curSongTime) {
    return map(t, curSongTime - this.windowSecs, curSongTime + this.windowSecs, 0, width);
  }

  draw(curSongTime) {
    noFill(); stroke(this.color);
    beginShape();
    for (var i = 0; i < this.history.length; i++) {
      if (this.times[i] <= 0) { continue; }
      let freqHeight = freqToHeight(this.history[i]);
      let t = this.timeToXPos(this.times[i], curSongTime);
      if (freqHeight < 0 || freqHeight > height) {
        endShape(); beginShape();
      }
      vertex(t, freqHeight);
    }
    endShape();
  }
}

function updateSong(songName) {
  curSession = Date.now();
  curSongKey = songName;
  let key = songName;
  let mp3Url = dataUrl + 'mp3/' + key + '.mp3';
  let notesUrl = dataUrl + 'notes/' + key + '.json';
  console.log([songName, key, mp3Url, notesUrl]);

  // load mp3
  if (audioEl !== undefined) {
    audioEl.remove();
  }
  audioEl = createAudio(mp3Url);
  audioEl.parent("audio-controls");
  audioEl.showControls();

  // load notes
  $.ajax({
    url: notesUrl,
    dataType: "json",
    minLength: 0,
    success: function( newSongData ) {
      songData = newSongData;
      console.log(newSongData);
      loadSongNotesAndLyrics(audioEl, newSongData);
      $('#songs').val('"' + songData.title + '" by ' + songData.artist);
      $('#song-selector').hide();
    }
  });
}

function fetchSongData() {
  // $('#sketch-container').hide();
  $.ajax({
    url: dataUrl + "songs.json",
    dataType: "json",
    success: function( songNameData ) {
      songList = songNameData;
      console.log(songNameData);
      // $('#songs').autocomplete({
      //   source: songNameData,
      //   minLength: 0,
      //   select: function( event, ui ) {
      //     if (ui.item) {
      //       $('#sketch-container').show();
      //       console.log(ui.item.label);
      //       updateSong(ui.item.value);
      //     }
      //   }
      // });
      // $('#songs').autocomplete('search', '');
    }
  });
}
$(document).ready(fetchSongData);

function isPaused() {
  return audioEl.parent().children[0].paused || audioEl.parent().children[0].currentTime === 0;
}

function mousePressed() {
  if (source === undefined) {
    startAudio();
  }
  if ((songData === undefined) && (songList != undefined)) {
    let curMouseY = mouseY;
    let rectHeight = (windowHeight-80)/songList.length;
    for (var i = 0; i < songList.length; i++) {
      let curHeight = i*rectHeight;
      if ((curMouseY >= curHeight) && (curMouseY < (i+1)*rectHeight)) {
        songSelectionIndex = i;
        updateSong(songList[i].value);
      }
    }
  }
}

function keyPressed() {
  if (source === undefined) {
    startAudio();
  }
  if (keyCode === 27) { // Esc key
    doDetectPitch = !doDetectPitch;
  } else if ((songData === undefined) && (songList != undefined)) {
    if (keyCode === 38) { // up arrow
      songSelectionIndex = (songSelectionIndex-1) % songList.length;
    } else if (keyCode === 40) { // down arrow
      songSelectionIndex = (songSelectionIndex+1) % songList.length;
    } else if ((keyCode === 32) || (keyCode === 13)) { // spacebar or return
      updateSong(songList[songSelectionIndex].value);
    }
    if (songSelectionIndex < 0) {
      songSelectionIndex = songList.length + songSelectionIndex;
    }
  }
}
