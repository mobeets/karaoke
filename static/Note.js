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
    this.diameter = 5;
   }

  update() {
    this.position.add(this.velocity);
  }
  draw() {
    noStroke();
    fill('white');
    ellipse(this.position.x, this.position.y, this.diameter, this.diameter);    
  }
}
