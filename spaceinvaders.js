/*
  spaceinvaders.js

  the core logic for the space invaders game.

 */

/*  
	Game Class

	The Game class represents a Space Invaders game.
	Create an instance of it, change any of the default values
	in the settings, and call 'start' to run the game.

	Call 'initialise' before 'start' to set the canvas the game
	will draw to.

	Call 'moveShip' or 'shipFire' to control the ship.

	Listen for 'gameWon' or 'gameLost' events to handle the game
	ending.
*/

//	Creates an instance of the Game class.
function Game {

	//	Set the initial config.
	this.config = {
		rocketRate: 0.01,
		bombTopVelocity: 25,
		invaderInitialVelocity: 10,
		invaderAcceleration: 4,
		invaderDropDistance: 20,
		rocketVelocity: 60,
		rocketMaxFireRate: 3
	};

	this.state = {
		lives: 3
		invaderCurrentVelocity: 10,
		invaderCurrentDropDistance: 0,
		invadersAreDropping: false,
		gameCanvas: null
	};
}

Game.prototype.initialise = function(gameCanvas) {

	//	Set the game canvas.
	this.state.gameCanvas = gameCanvas;
};

//	The main game object, holds the core data.
var game = {
	fps: 50,
	width: 400,
	height: 400,
	playZoneMargin: {left:20, top: 20, right: 20, bottom: 60},
	intervalId: null,
	mainCanvas: document.getElementById("mainCanvas"),
	lives: 3,						//	state
	rocketRate: 0.01,				//	setting
	bombTopVelocity: 25,			//	setting
	invaderInitialVelocity: 10,		//	setting
	invaderCurrentVelocity: 10,		//	state
	invaderAcceleration: 4,			//	setting
	invaderDropDistance: 20,		//	setting
	invaderCurrentDropDistance: 0,	//	state
	invadersAreDropping: false,		//	state
	rocketVelocity: 60,				//	setting
	rocketMaxFireRate: 3, 			//	setting
	lastRocketTime: null
};

//	The main loop.
game.gameLoop = function GameLoop() {
	game.update();
	game.draw();
};

//	Create the start function.
game.start = function Start() {

	//	Setup the canvas.
	this.mainCanvas.width = this.width;
	this.mainCanvas.height = this.height;

	//	Create the stars.
	var stars = [];
	for(var i=0; i<100; i++) {
		stars[i] = new Star(Math.random()*this.width, Math.random()*this.height, Math.random()*3+1, (Math.random()*5)+1);
	}
	this.stars = stars;

	//	Create the ship.
	this.ship = new Ship(this.width / 2, this.height - this.playZoneMargin.bottom);

	//	We have no rockets and bombs by default.
	this.rockets = [];
	this.bombs = [];

	//	Create the invaders.
	var ranks = 5;
	var files = 10;
	var invaders = [];
	for(var rank = 0; rank < ranks; rank++){
		for(var file = 0; file < files; file++) {
			invaders.push(new Invader(
				(this.width / 2) + ((files/2 - file) * 200 / files),
				(100 - rank * 20),
				rank, file, 'Invader'));
		}
	}
	this.invaders = invaders;
	this.invaderVelocity = {x: -this.invaderInitialVelocity, y:0};
	this.invaderNextVelocity = null;

	//	Start the game loop.
	this.intervalId = setInterval(this.gameLoop, 1000 / this.fps);
};

//	The stop function stops the game.
game.stop = function Stop() {
	clearInterval(this.intervalId);
};

//	The update function handles the updating of the state.
game.update = function Update() {

	//	The seconds that have passed.
	var secs = this.fps / 1000;

	//	Move each star.
	for(var i=0; i<this.stars.length; i++) {
		var star = this.stars[i];
		star.y += secs * star.velocity;
		//	If the star has moved from the bottom of the screen, spawn it at the top.
		if(star.y > this.height) {
			this.stars[i] = new Star(Math.random()*this.width, 0, Math.random()*3+1, Math.random()*5 + 1);
		}
	}

	//	Move each bomb.
	for(var i=0; i<this.bombs.length; i++) {
		var bomb = this.bombs[i];
		bomb.y += secs * bomb.velocity;

		//	If the rocket has gone off the screen remove it.
		if(bomb.y > this.height) {
			this.bombs.splice(i--, 1);
		}
	}

	//	Move each rocket.
	for(var i=0; i<this.rockets.length; i++) {
		var rocket = this.rockets[i];
		rocket.y -= secs * rocket.velocity;

		//	If the rocket has gone off the screen remove it.
		if(rocket.y < 0) {
			this.rockets.splice(i--, 1);
		}
	}

	//	Move the invaders.
	var hitLeft = false, hitRight = false, hitBottom = false;
	for(var i=0; i<this.invaders.length; i++) {
		var invader = this.invaders[i];
		var newx = invader.x + this.invaderVelocity.x * secs;
		var newy = invader.y + this.invaderVelocity.y * secs;
		if(hitLeft == false && newx < this.playZoneMargin.left) {
			hitLeft = true;
		}
		else if(hitRight == false && newx > this.width - this.playZoneMargin.right) {
			hitRight = true;
		}
		else if(hitBottom == false && newy > this.height - this.playZoneMargin.bottom) {
			hitBotom = true;
		}

		if(!hitLeft && !hitRight && !hitBottom) {
			invader.x = newx;
			invader.y = newy;
		}
	}

	//	Update invader velocities.
	if(this.invadersAreDropping) {
		this.invaderCurrentDropDistance += this.invaderVelocity.y * secs;
		if(this.invaderCurrentDropDistance >= this.invaderDropDistance) {
			this.invadersAreDropping = false;
			this.invaderVelocity = this.invaderNextVelocity;
			this.invaderCurrentDropDistance = 0;
		}
	}
	//	If we've hit the left, move down then right.
	if(hitLeft) {
		this.invaderCurrentVelocity += this.invaderAcceleration;
		this.invaderVelocity = {x: 0, y:this.invaderCurrentVelocity };
		this.invadersAreDropping = true;
		this.invaderNextVelocity = {x: this.invaderCurrentVelocity , y:0};
	}
	//	If we've hit the right, move down then left.
	if(hitRight) {
		this.invaderCurrentVelocity += this.invaderAcceleration;
		this.invaderVelocity = {x: 0, y:this.invaderCurrentVelocity };
		this.invadersAreDropping = true;
		this.invaderNextVelocity = {x: -this.invaderCurrentVelocity , y:0};
	}
	//	If we've hit the bottom, it's game over.
	if(hitBottom) {
		this.lives = 0;
	}
	
	//	Check for rocket/invader collisions.
	for(var i=0; i<this.invaders.length; i++) {
		var invader = this.invaders[i];
		var bang = false;

		for(var j=0; j<this.rockets.length; j++){
			var rocket = this.rockets[j];

			if(rocket.x >= (invader.x - invader.width/2) && rocket.x <= (invader.x + invader.width/2) &&
				rocket.y >= (invader.y - invader.height/2) && rocket.y <= (invader.y + invader.height/2)) {
				
				this.rockets.splice(j--, 1);
				bang = true;
				break;
			}
		}
		if(bang) {
			this.invaders.splice(i--, 1);
		}
	}

	//	Give each invader a chance to drop a bomb.
	for(var i=0; i<this.invaders.length; i++) {
		var invader = this.invaders[i];
		var chance = this.rocketRate * secs;
		if(chance > Math.random()) {
			//	Fire!
			this.bombs.push(new Bomb(invader.x, invader.y + invader.height / 2, Math.random()*this.bombTopVelocity + 10));
		}
	}

	//	Check for bomb/ship collisions.
	for(var i=0; i<this.bombs.length; i++) {
		var bomb = this.bombs[i];
		if(bomb.x >= (this.ship.x - this.ship.width/2) && bomb.x <= (this.ship.x + this.ship.width/2) &&
				bomb.y >= (this.ship.y - this.ship.height/2) && bomb.y <= (this.ship.y + this.ship.height/2)) {
			this.bombs.splice(i--, 1);
			this.lives--;
		}
				
	}

	//	Check for invader/ship collisions.
	for(var i=0; i<this.invaders.length; i++) {
		var invader = this.invaders[i];
		if((invader.x + invader.width/2) > (this.ship.x - this.ship.width/2) && 
			(invader.x - invader.width/2) < (this.ship.x + this.ship.width/2) &&
			(invader.y + invader.height/2) > (this.ship.y - this.ship.height/2) &&
			(invader.y - invader.height/2) < (this.ship.y + this.ship.height/2)) {
			//	Dead by collision!
			this.lives = 0;
		}
	}

	//	Check for failure
	if(this.lives <= 0) {
		this.stop();
		if(this.onGameLost){
			this.onGameLost(this);
		}
	}

	//	Check for victory
	if(this.invaders.length == 0) {
		this.stop();
		if(this.onGameWon){
			this.onGameWon(this);
		}
	}
};

//	The draw function handles the drawing of the state.
game.draw = function Draw() {

	//	Get the drawing context.
	var ctx = this.mainCanvas.getContext("2d");

	//	Draw the background.
 	ctx.fillStyle = '#000000';
 	ctx.beginPath();
	ctx.rect(0, 0, this.width, this.height);
	ctx.closePath();
	ctx.fill();

	//	Draw stars.
	for(var i=0; i<this.stars.length;i++) {
		var star = this.stars[i];
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(star.x, star.y, star.size, star.size);
	}

	//	Draw ship.
	ctx.fillStyle = '#999999';
	ctx.fillRect(this.ship.x - (this.ship.width / 2), this.ship.y - (this.ship.height / 2), this.ship.width, this.ship.height);

	//	Draw invaders.
	ctx.fillStyle = '#006600';
	for(var i=0; i<this.invaders.length; i++) {
		var invader = this.invaders[i];
		ctx.fillRect(invader.x - invader.width/2, invader.y - invader.height/2, invader.width, invader.height);
	}

	//	Draw bombs.
	ctx.fillStyle = '#ff5555';
	for(var i=0; i<this.bombs.length; i++) {
		var bomb = this.bombs[i];
		ctx.fillRect(bomb.x - 2, bomb.y - 2, 4, 4);
	}

	//	Draw rockets.
	ctx.fillStyle = '#ff0000';
	for(var i=0; i<this.rockets.length; i++) {
		var rocket = this.rockets[i];
		ctx.fillRect(rocket.x, rocket.y - 2, 1, 4);
	}

	//	Draw info.
	ctx.font="14px Arial";
	ctx.fillStyle = '#ffffff';
	var info = "Lives: " + this.lives;
	ctx.fillText(info, this.playZoneMargin.left, this.height - this.playZoneMargin.bottom / 2 + 14/2);
};

//	Move the ship by (x,y) pixels.
game.moveShip = function MoveShip(x, y) {
	this.ship.x += x;
	if(this.ship.x < this.playZoneMargin.left) {
		this.ship.x = this.playZoneMargin.left;
	}
	if(this.ship.x > this.width - this.playZoneMargin.right) {
		this.ship.x = this.width - this.playZoneMargin.right;
	}
};

game.shipFire = function ShipFire() {

	//	If we have no last rocket time, or the last rocket time 
	//	is older than the max rocket rate, we can fire.
	if(this.lastRocketTime == null || ((new Date()).valueOf() - this.lastRocketTime) > (1000 / this.rocketMaxFireRate))
	{	
		//	Add a rocket.
		this.rockets.push(new Rocket(this.ship.x, this.ship.y - 12, this.rocketVelocity));
		this.lastRocketTime = (new Date()).valueOf();
	}
};

//	Start the game.
game.start();

/*
	Stars

	Stars are a set of X points, with variable size. They slowly descend.

*/
function Star(x, y, size, velocity) {
	this.x = x;
	this.y = y; 
	this.size = size;
	this.velocity = velocity;
}

/*
 
  Ship

  The ship has a position and that's about it.

*/
function Ship(x, y) {
	this.x = x;
	this.y = y;
	this.width = 20;
	this.height = 16;
}

/*
	Rocket

	Fired by the ship, they've got a position, velocity and state.

	*/
function Rocket(x, y, velocity) {
	this.x = x;
	this.y = y;
	this.velocity = velocity;
}

/*
 	Bomb

 	Dropped by invaders, they've got position, velocity.

*/
function Bomb(x, y, velocity) {
	this.x = x;
	this.y = y;
	this.velocity = velocity;
}

/*
	Invader 

	Invader's have position, type, rank/file and that's about it. 
*/

function Invader(x, y, rank, file, type) {
	this.x = x;
	this.y = y;
	this.rank = rank;
	this.file = file;
	this.type = type;
	this.width = 18;
	this.height = 14;
}