class Note {  
  constructor(freq, pos, noteDiameter, name) {
    this.freq = freq;
    this.name = name;
    this.velocity = createVector(-1, 0);
    this.position = createVector(pos.x, pos.y);
    this.defaultDiameter = noteDiameter;
    this.diameter = noteDiameter;

    this.color = 'white';
    this.pBMove = 0;
    this.force = 0;
    this.isOn = false;
    this.isPassed = true;
    this.score = NaN;
  }
  isFocus(freq, centsThresh) {
    // when centsThresh = 100, bins are maximal size without overlapping bins of adjacent notes in 12-TET
    let binSize = min(1, centsThresh/100)*(1/24);
    let leftBin = this.freq * Math.pow(2, -binSize);
    let rightBin = this.freq * Math.pow(2, binSize);
    return (freq >= leftBin) && (freq < rightBin);
  }
  setScore(freq, centsThresh, showCurrentFreq) {
    this.isPassed = true;
    if (!showCurrentFreq) {
      console.log('pitch not scored.');
      this.color = "gray";
      this.score = NaN;
      return;
    }

    // todo: get error in cents, map to color
    let errorCents = 100*12*(Math.log(freq) - Math.log(this.freq));
    let errorFraction;
    if (Math.abs(errorCents) < centsThresh) {
      this.color = "#73f06e";
      // errorFraction = constrain(Math.abs(errorCents)/centsThresh, 0, 1);
      // this.diameter = Math.sqrt(1-errorFraction)*this.defaultDiameter;
    } else {
      this.color = "#cc2910";
      // errorFraction = constrain((Math.abs(errorCents)-centsThresh)/centsThresh, 0, 1);
      // this.diameter = Math.sqrt(errorFraction)*this.defaultDiameter;
    }
    this.score = errorCents;
  }
  setOn() {
    if (this.isPassed) { return; }
    this.isOn = true;
    this.color = "yellow";
    this.diameter = this.defaultDiameter;
    this.force = 20;
    this.pBMove = sin(frameCount) * this.force;
  }
  setOff() {
    if (this.isPassed) { return; }
    this.isOn = false;
    this.color = "white";
    this.diameter = this.defaultDiameter;
    if (this.force > 0) {
      this.force -= 1;
      this.pBMove = sin(frameCount) * this.force;
    }
  }
  update() {
    this.position.add(this.velocity);
  }
  draw() {
    noStroke();
    fill(this.color);
    ellipse(this.position.x, this.position.y, this.diameter, this.diameter);

    textAlign(CENTER);
    text(this.name, this.position.x, this.position.y - this.diameter);
    textAlign(LEFT);
  }
}
