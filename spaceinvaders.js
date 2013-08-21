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
function Game() {

	//	Set the initial config.
	this.config = {
		bombRate: 0.01,
		bombMinVelocity: 10,
		bombMaxVelocity: 10,
		invaderInitialVelocity: 5,
		invaderAcceleration: 0,
		invaderDropDistance: 20,
		rocketVelocity: 60,
		rocketMaxFireRate: 3,
		gameWidth: 400,
		gameHeight: 300,
		fps: 50,
		debugMode: true
	};

	//	All state is in the variables below.
	this.lives = 3;
	this.invaderCurrentVelocity =  10;
	this.invaderCurrentDropDistance =  0;
	this.invadersAreDropping =  false;
	this.gameCanvas =  null;
	this.width = 0;
	this.height = 0;
	this.gameBound = {left: 0, top: 0, right: 0, bottom: 0};
	this.intervalId = 0;

	//	Game entities.
	this.ship = null;
	this.invaders = [];
	this.rockets = [];
	this.bombs = [];
}

//	Initialis the Game with a canvas.
Game.prototype.initialise = function(gameCanvas) {

	//	Set the game canvas.
	this.gameCanvas = gameCanvas;

	//	Set the game width and height.
	this.width = gameCanvas.width;
	this.height = gameCanvas.height;

	//	Set the state game bounds.
	this.gameBounds = {
		left: gameCanvas.width / 2 - this.config.gameWidth / 2,
		right: gameCanvas.width / 2 + this.config.gameWidth / 2,
		top: gameCanvas.height / 2 - this.config.gameHeight / 2,
		bottom: gameCanvas.height / 2 + this.config.gameHeight / 2,
	};
};

//	Start the Game.
Game.prototype.start = function() {

	//	Create the ship.
	this.ship = new Ship(this.width / 2, this.gameBounds.bottom);

	//	We have no rockets and bombs by default.
	this.rockets = [];
	this.bombs = [];

	//	TODO: make the 'block' configurable.

	//	Create the invaders.
	var ranks = 5;
	var files = 10;
	var invaders = [];
	for(var rank = 0; rank < ranks; rank++){
		for(var file = 0; file < files; file++) {
			invaders.push(new Invader(
				(this.width / 2) + ((files/2 - file) * 200 / files),
				(this.gameBounds.top + rank * 20),
				rank, file, 'Invader'));
		}
	}
	this.invaders = invaders;
	this.invaderCurrentVelocity = this.config.invaderInitialVelocity;
	this.invaderVelocity = {x: -this.config.invaderInitialVelocity, y:0};
	this.invaderNextVelocity = null;

	//	Start the game loop.
	var game = this;
	this.intervalId = setInterval(function () { GameLoop(game);}, 1000 / this.fps);

};

//	The main loop.
function GameLoop(game) {
	game.update();
	game.draw();
};

//	The stop function stops the game.
Game.prototype.stop = function Stop() {
	clearInterval(this.intervalId);
};

//	The update function handles the updating of the state.
Game.prototype.update = function Update() {

	//	The seconds that have passed.
	var secs = 1 / this.config.fps;

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
		if(hitLeft == false && newx < this.gameBounds.left) {
			hitLeft = true;
		}
		else if(hitRight == false && newx > this.gameBounds.right) {
			hitRight = true;
		}
		else if(hitBottom == false && newy > this.gameBounds.bottom) {
			hitBottom = true;
		}

		if(!hitLeft && !hitRight && !hitBottom) {
			invader.x = newx;
			invader.y = newy;
		}
	}

	//	Update invader velocities.
	if(this.invadersAreDropping) {
		this.invaderCurrentDropDistance += this.invaderVelocity.y * secs;
		if(this.invaderCurrentDropDistance >= this.config.invaderDropDistance) {
			this.invadersAreDropping = false;
			this.invaderVelocity = this.invaderNextVelocity;
			this.invaderCurrentDropDistance = 0;
		}
	}
	//	If we've hit the left, move down then right.
	if(hitLeft) {
		this.invaderCurrentVelocity += this.config.invaderAcceleration;
		this.invaderVelocity = {x: 0, y:this.invaderCurrentVelocity };
		this.invadersAreDropping = true;
		this.invaderNextVelocity = {x: this.invaderCurrentVelocity , y:0};
	}
	//	If we've hit the right, move down then left.
	if(hitRight) {
		this.invaderCurrentVelocity += this.config.invaderAcceleration;
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
		var chance = this.config.bombRate * secs;
		if(chance > Math.random()) {
			//	Fire!
			this.bombs.push(new Bomb(invader.x, invader.y + invader.height / 2, 
				this.config.bombMinVelocity + Math.random()*(this.config.bombMaxVelocity - this.config.bombMinVelocity)));
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
Game.prototype.draw = function () {

	//	Get the drawing context.
	var ctx = this.gameCanvas.getContext("2d");

	//	Clear the background.
	ctx.clearRect(0, 0, this.width, this.height);
	
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
	ctx.fillText(info, this.gameBounds.left, this.gameBounds.bottom + ((this.height - this.gameBounds.bottom) / 2) + 14/2);

	//	If we're in debug mode, draw bounds.
	if(this.config.debugMode) {
		ctx.strokeStyle = '#ff0000';
		ctx.strokeRect(0,0,this.width, this.height);
		ctx.strokeRect(this.gameBounds.left, this.gameBounds.top, 
			this.gameBounds.right - this.gameBounds.left, 
			this.gameBounds.bottom - this.gameBounds.top);
	}
};

//	Move the ship by (x,y) pixels.
Game.prototype.moveShip = function (x, y) {
	this.ship.x += x;
	if(this.ship.x < this.gameBounds.left) {
		this.ship.x = this.gameBounds.left;
	}
	if(this.ship.x > this.gameBounds.right) {
		this.ship.x = this.gameBounds.right;
	}
};

//	Fires a rocket from the ship.
Game.prototype.shipFire = function () {

	//	If we have no last rocket time, or the last rocket time 
	//	is older than the max rocket rate, we can fire.
	if(this.lastRocketTime == null || ((new Date()).valueOf() - this.lastRocketTime) > (1000 / this.config.rocketMaxFireRate))
	{	
		//	Add a rocket.
		this.rockets.push(new Rocket(this.ship.x, this.ship.y - 12, this.config.rocketVelocity));
		this.lastRocketTime = (new Date()).valueOf();
	}
};

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