/**
* Note
* S'affichant de droite à gauche
*
*/
class Note {  
   constructor(name, pos) {
    this.name = name;
    this.velocity = createVector(-1, 0);
    this.position = createVector(pos.x, pos.y);   
   }

  update() {
    this.position.add(this.velocity);
  }
  draw() {
    noStroke();
    fill(255);
    ellipse(this.position.x, this.position.y, 25, 25);    
  }
}
