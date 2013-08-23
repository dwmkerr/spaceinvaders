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
		debugMode: true,
		invaderRanks: 5,
		invaderFiles: 10,
		shipSpeed: 20
	};

	//	All state is in the variables below.
	this.lives = 3;
	this.invaderCurrentVelocity =  10;
	this.invaderCurrentDropDistance =  0;
	this.invadersAreDropping =  false;
	this.width = 0;
	this.height = 0;
	this.gameBound = {left: 0, top: 0, right: 0, bottom: 0};
	this.intervalId = 0;
	this.paused = false;
	this.score = 0;
	this.level = 1;

	//	Game entities.
	this.ship = null;
	this.invaders = [];
	this.rockets = [];
	this.bombs = [];

	//	Game states.
	this.stateWelcome = new WelcomeState();
	this.stateGameOver = new GameOverState();
	this.statePlay = new PlayState();
	this.statePaused = {};
	this.currentState = null;

	//	Input/output
	this.pressedKeys = {};
	this.gameCanvas =  null;
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

	//	Move into the 'welcome' state.
	this.moveToState(this.stateWelcome);

	//	Start the game loop.
	var game = this;
	this.intervalId = setInterval(function () { GameLoop(game);}, 1000 / this.fps);

};

//	The main loop.
function GameLoop(game) {
	if(game.currentState) {
		//	Delta t is the time to update/draw.
		var dt = 1 / game.config.fps;

		//	Get the drawing context.
		var ctx = this.gameCanvas.getContext("2d");
		
		game.currentState.update(game, dt);
		game.currentState.draw(game, dt, ctx);
	}
};

Game.prototype.moveToState = function(state) {

	//	If we are in a state, leave it.
	if(this.currentState && this.currentState.leave) {
		this.currentState.leave(game);
	}
	
	//	If there's an enter function for the new state, call it.
	if(state.enter) {
		state.enter(game);
	}

	//	Set the current state.
	this.currentState = state;

};

//	The stop function stops the game.
Game.prototype.stop = function Stop() {
	clearInterval(this.intervalId);
};

//	Move the ship by (x,y) pixels.
Game.prototype.moveShip = function (x, y) {

	if(this.paused) {
		return;
	}

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
	
	if(this.paused) {
		return;
	}


	//	If we have no last rocket time, or the last rocket time 
	//	is older than the max rocket rate, we can fire.
	if(this.lastRocketTime == null || ((new Date()).valueOf() - this.lastRocketTime) > (1000 / this.config.rocketMaxFireRate))
	{	
		//	Add a rocket.
		this.rockets.push(new Rocket(this.ship.x, this.ship.y - 12, this.config.rocketVelocity));
		this.lastRocketTime = (new Date()).valueOf();
	}
};

Game.prototype.togglePause = function () {
	this.paused = !this.paused;
};

//	Inform the game a key is down.
Game.prototype.keyDown = function(keyCode) {
	this.pressedKeys[keyCode] = true;
	//	Delegate to the current state too.
	if(this.currentState && this.currentState.keyDown) {
		this.currentState.keyDown(this, keyCode);
	}
};

//	Inform the game a key is up.
Game.prototype.keyUp = function(keyCode) {
	delete this.pressedKeys[keyCode];
	//	Delegate to the current state too.
	if(this.currentState && this.currentState.keyUp) {
		this.currentState.keyUp(this, keyCode);
	}
};

function WelcomeState() {

}

WelcomeState.prototype.update = function (game, dt) {


};

WelcomeState.prototype.draw = function(game, dt, ctx) {

	//	Clear the background.
	ctx.clearRect(0, 0, game.width, game.height);

	ctx.font="30px Arial";
	ctx.fillStyle = '#ffffff';
	ctx.textBaseline="center"; 
	ctx.textAlign="center"; 
	ctx.fillText("Space Invaders", game.width / 2, game.height/2 - 40);	
	ctx.font="16px Arial";

	ctx.fillText("Press 'Space' to start.", game.width / 2, game.height/2);	
};

WelcomeState.prototype.keyDown = function(game, keyCode) {
	if(keyCode == 32) /*space*/ {
		//	Space starts the game.
		game.moveToState(game.statePlay);
	}
};

function GameOverState() {

}

GameOverState.prototype.update = function(game, dt) {

};

GameOverState.prototype.draw = function(game, dt, ctx) {

	//	Clear the background.
	ctx.clearRect(0, 0, game.width, game.height);

	ctx.font="30px Arial";
	ctx.fillStyle = '#ffffff';
	ctx.textBaseline="center"; 
	ctx.textAlign="center"; 
	ctx.fillText("Game Over!", game.width / 2, game.height/2 - 40);	
	ctx.font="16px Arial";
	ctx.fillText("You scored " + game.score, game.width / 2, game.height/2);
	ctx.font="16px Arial";
	ctx.fillText("Press 'Space' to play again.", game.width / 2, game.height/2 + 40);	
};

GameOverState.prototype.keyDown = function(game, keyCode) {
	if(keyCode == 32) /*space*/ {
		//	Space restarts the game.
		game.moveToState(game.statePlay);
	}
};

function PlayState() {

};

PlayState.prototype.enter = function(game) {

	//	Create the ship.
	game.ship = new Ship(game.width / 2, game.gameBounds.bottom);

	//	Empty rockets, bombs and invaders.
	game.rockets = [];
	game.bombs = [];
	game.invaders = [];

	//	Setup initial state.
	game.lives = 3;
	game.invaderCurrentVelocity =  10;
	game.invaderCurrentDropDistance =  0;
	game.invadersAreDropping =  false;
	game.paused = false;
	game.score = 0;
	game.level = 1;

	//	Create the invaders.
	var ranks = game.config.invaderRanks;
	var files = game.config.invaderFiles;
	var invaders = [];
	for(var rank = 0; rank < ranks; rank++){
		for(var file = 0; file < files; file++) {
			invaders.push(new Invader(
				(game.width / 2) + ((files/2 - file) * 200 / files),
				(game.gameBounds.top + rank * 20),
				rank, file, 'Invader'));
		}
	}
	game.invaders = invaders;
	game.invaderCurrentVelocity = game.config.invaderInitialVelocity;
	game.invaderVelocity = {x: -game.config.invaderInitialVelocity, y:0};
	game.invaderNextVelocity = null;

};

PlayState.prototype.update = function(game, dt) {

	if(game.paused) {
		return;
	}
	
	//	If the left or right arrow keys are pressed, move
	//	the ship. Check this on ticks rather than via a keydown
	//	event for smooth movement, otherwise the ship would move
	//	more like a text editor caret.
	if(game.pressedKeys[37]) {
		game.moveShip(-game.config.shipSpeed * dt);
	}
	if(game.pressedKeys[39]) {
		game.moveShip(game.config.shipSpeed * dt);
	}

	//	Move each bomb.
	for(var i=0; i<game.bombs.length; i++) {
		var bomb = game.bombs[i];
		bomb.y += dt * bomb.velocity;

		//	If the rocket has gone off the screen remove it.
		if(bomb.y > game.height) {
			game.bombs.splice(i--, 1);
		}
	}

	//	Move each rocket.
	for(var i=0; i<game.rockets.length; i++) {
		var rocket = game.rockets[i];
		rocket.y -= dt * rocket.velocity;

		//	If the rocket has gone off the screen remove it.
		if(rocket.y < 0) {
			game.rockets.splice(i--, 1);
		}
	}

	//	Move the invaders.
	var hitLeft = false, hitRight = false, hitBottom = false;
	for(var i=0; i<game.invaders.length; i++) {
		var invader = game.invaders[i];
		var newx = invader.x + game.invaderVelocity.x * dt;
		var newy = invader.y + game.invaderVelocity.y * dt;
		if(hitLeft == false && newx < game.gameBounds.left) {
			hitLeft = true;
		}
		else if(hitRight == false && newx > game.gameBounds.right) {
			hitRight = true;
		}
		else if(hitBottom == false && newy > game.gameBounds.bottom) {
			hitBottom = true;
		}

		if(!hitLeft && !hitRight && !hitBottom) {
			invader.x = newx;
			invader.y = newy;
		}
	}

	//	Update invader velocities.
	if(game.invadersAreDropping) {
		game.invaderCurrentDropDistance += game.invaderVelocity.y * dt;
		if(game.invaderCurrentDropDistance >= game.config.invaderDropDistance) {
			game.invadersAreDropping = false;
			game.invaderVelocity = game.invaderNextVelocity;
			game.invaderCurrentDropDistance = 0;
		}
	}
	//	If we've hit the left, move down then right.
	if(hitLeft) {
		game.invaderCurrentVelocity += game.config.invaderAcceleration;
		game.invaderVelocity = {x: 0, y:game.invaderCurrentVelocity };
		game.invadersAreDropping = true;
		game.invaderNextVelocity = {x: game.invaderCurrentVelocity , y:0};
	}
	//	If we've hit the right, move down then left.
	if(hitRight) {
		game.invaderCurrentVelocity += game.config.invaderAcceleration;
		game.invaderVelocity = {x: 0, y:game.invaderCurrentVelocity };
		game.invadersAreDropping = true;
		game.invaderNextVelocity = {x: -game.invaderCurrentVelocity , y:0};
	}
	//	If we've hit the bottom, it's game over.
	if(hitBottom) {
		game.lives = 0;
	}
	
	//	Check for rocket/invader collisions.
	for(var i=0; i<game.invaders.length; i++) {
		var invader = game.invaders[i];
		var bang = false;

		for(var j=0; j<game.rockets.length; j++){
			var rocket = game.rockets[j];

			if(rocket.x >= (invader.x - invader.width/2) && rocket.x <= (invader.x + invader.width/2) &&
				rocket.y >= (invader.y - invader.height/2) && rocket.y <= (invader.y + invader.height/2)) {
				
				game.rockets.splice(j--, 1);
				bang = true;
				game.score += 5;
				break;
			}
		}
		if(bang) {
			game.invaders.splice(i--, 1);
		}
	}

	//	Find all of the front rank invaders.
	var frontRankInvaders = {};
	for(var i=0; i<game.invaders.length; i++) {
		var invader = game.invaders[i];
		//	If we have no invader for game file, or the invader
		//	for game file is futher behind, set the front
		//	rank invader to game one.
		if(!frontRankInvaders[invader.file] || frontRankInvaders[invader.file].rank < invader.rank) {
			frontRankInvaders[invader.file] = invader;
		}
	}

	//	Give each front rank invader a chance to drop a bomb.
	for(var i=0; i<game.config.invaderFiles; i++) {
		var invader = frontRankInvaders[i];
		if(!invader) continue;
		var chance = game.config.bombRate * dt;
		if(chance > Math.random()) {
			//	Fire!
			game.bombs.push(new Bomb(invader.x, invader.y + invader.height / 2, 
				game.config.bombMinVelocity + Math.random()*(game.config.bombMaxVelocity - game.config.bombMinVelocity)));
		}
	}

	//	Check for bomb/ship collisions.
	for(var i=0; i<game.bombs.length; i++) {
		var bomb = game.bombs[i];
		if(bomb.x >= (game.ship.x - game.ship.width/2) && bomb.x <= (game.ship.x + game.ship.width/2) &&
				bomb.y >= (game.ship.y - game.ship.height/2) && bomb.y <= (game.ship.y + game.ship.height/2)) {
			game.bombs.splice(i--, 1);
			game.lives--;
		}
				
	}

	//	Check for invader/ship collisions.
	for(var i=0; i<game.invaders.length; i++) {
		var invader = game.invaders[i];
		if((invader.x + invader.width/2) > (game.ship.x - game.ship.width/2) && 
			(invader.x - invader.width/2) < (game.ship.x + game.ship.width/2) &&
			(invader.y + invader.height/2) > (game.ship.y - game.ship.height/2) &&
			(invader.y - invader.height/2) < (game.ship.y + game.ship.height/2)) {
			//	Dead by collision!
			game.lives = 0;
		}
	}

	//	Check for failure
	if(game.lives <= 0) {
		game.moveToState(game.stateGameOver);
	}

	//	Check for victory
	if(game.invaders.length == 0) {
		game.stop();
		if(game.onGameWon){
			game.score += 50;
			game.onGameWon(game);
		}
	}
};

PlayState.prototype.draw = function(game, dt, ctx) {

	if(game.paused) {
		ctx.font="14px Arial";
		ctx.fillStyle = '#ffffff';
		ctx.textBaseline="middle"; 
		ctx.textAlign="center"; 
		ctx.fillText("Paused", game.width / 2, game.height/2);		
		return;
	}

	//	Clear the background.
	ctx.clearRect(0, 0, game.width, game.height);
	
	//	Draw ship.
	ctx.fillStyle = '#999999';
	ctx.fillRect(game.ship.x - (game.ship.width / 2), game.ship.y - (game.ship.height / 2), game.ship.width, game.ship.height);

	//	Draw invaders.
	ctx.fillStyle = '#006600';
	for(var i=0; i<game.invaders.length; i++) {
		var invader = game.invaders[i];
		ctx.fillRect(invader.x - invader.width/2, invader.y - invader.height/2, invader.width, invader.height);
	}

	//	Draw bombs.
	ctx.fillStyle = '#ff5555';
	for(var i=0; i<game.bombs.length; i++) {
		var bomb = game.bombs[i];
		ctx.fillRect(bomb.x - 2, bomb.y - 2, 4, 4);
	}

	//	Draw rockets.
	ctx.fillStyle = '#ff0000';
	for(var i=0; i<game.rockets.length; i++) {
		var rocket = game.rockets[i];
		ctx.fillRect(rocket.x, rocket.y - 2, 1, 4);
	}

	//	Draw info.
	var textYpos = game.gameBounds.bottom + ((game.height - game.gameBounds.bottom) / 2) + 14/2;
	ctx.font="14px Arial";
	ctx.fillStyle = '#ffffff';
	var info = "Lives: " + game.lives;
	ctx.textAlign = "left";
	ctx.fillText(info, game.gameBounds.left, textYpos);
	info = "Score: " + game.score + ", Level: " + game.level;
	ctx.textAlign = "right";
	ctx.fillText(info, game.gameBounds.right, textYpos);

	//	If we're in debug mode, draw bounds.
	if(game.config.debugMode) {
		ctx.strokeStyle = '#ff0000';
		ctx.strokeRect(0,0,game.width, game.height);
		ctx.strokeRect(game.gameBounds.left, game.gameBounds.top, 
			game.gameBounds.right - game.gameBounds.left, 
			game.gameBounds.bottom - game.gameBounds.top);
	}

};

PlayState.prototype.keyDown = function(game, keyCode) {

	if(keyCode == 32) {
		//	Fire when space is pressed.
		game.shipFire();
	}
};

PlayState.prototype.keyUp = function(game, keyCode) {

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

/*
	Game State

	A Game State is simply an update and draw proc.
	When a game is in the state, the update and draw procs are
	called, with a dt value (dt is delta time, i.e. the number)
	of seconds to update or draw).

*/
function GameState(updateProc, drawProc, keyDown, keyUp, enter, leave) {
	this.updateProc = updateProc;
	this.drawProc = drawProc;
	this.keyDown = keyDown;
	this.keyUp = keyUp;
	this.enter = enter;
	this.leave = leave;
}