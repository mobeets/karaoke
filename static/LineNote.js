class LineNote {
  constructor(freq, name, posY) {
    this.freq = freq;   
    this.name = name;
    this.posY = posY;
    this.color = 'white';
    this.weight = 0.5;
    this.pBMove = 0; // position y du point de controle B qui va s'agitter au focus 
    this.force = 0;
    this.isOn = false;
  }
  isFocus(freq, freqThresh) {
    let leftBin = this.freq * Math.pow(2, -1/24);
    let rightBin = this.freq * Math.pow(2, 1/24);
    return (freq >= leftBin) && (freq < rightBin);
  }
  setOn() {
    // this.color = "#8d3030";
    // this.weight = 1;
    this.weight = 0.5;
    this.force = 20;
    this.pBMove = sin(frameCount) * this.force;
    this.isOn = true;
  }  
  setOff() {    
    // this.color = 255;
    this.weight = 0.5;
    this.isOn = false;
    if (this.force > 0) {
      this.force -= 1;
      this.pBMove = sin(frameCount) * this.force;
    }
  }
  draw() {
    fill(255);
    textSize(12);
    stroke(this.color);
    strokeWeight(this.weight);
    noFill();
    
    let pA = createVector(0, this.posY );
    let pB = createVector(width/2, this.posY);// + this.pBMove);
    let pC = createVector(width, this.posY);
    
    beginShape();
    vertex(pA.x, pA.y);
    quadraticVertex(pB.x, pB.y, pC.x, pC.y);
    endShape();
    
    if (this.isOn) {
      noStroke();
      fill('white');
      text(this.name, width/2, this.posY);
    }
  }
}
