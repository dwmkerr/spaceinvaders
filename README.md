Space Invaders
==============

The classic Space Invaders game written in JavaScript as a learning exercise.
No jQuery or any other third party libraries, just raw js/html.

See it Live: http://www.dwmkerr.com/experiments/spaceinvaders

![Space Invaders Screenshot](http://www.dwmkerr.com/experiments/spaceinvaders/screenshot.jpg "Space Invaders Screenshot")

Intro
-----

What's there to say? It's Space Invaders in JavaScript! Create the game, give it a 
div to draw to, tell it when the keyboard is mashed and that's all you need to 
add Space Invaders to a wesite.

The Space Invaders Javascript code is all in one file - why is this? Well this is actually
part of a series of experiments that are used as tutorials, and at this stage we're keeping
things simple with single files.

Adding Space Invaders to a Web Page
-----------------------------------

First, drop the spaceinvaders.js file into the website.

Now add a canvas to the page.

````HTML
<canvas id="gameCanvas"></canvas>
````

Finally, add the Space Invaders game code. You create the game, 
intialise it with the canvas, start it and make sure you tell
it when a key is pressed or released. That's it!

````HTML
<script>
//	Setup the canvas.
var canvas = document.getElementById("gameCanvas");
canvas.width = 800;
canvas.height = 600;

//	Create the game.
var game = new Game();

//	Initialise it with the game canvas.
game.initialise(canvas);

//	Start the game.
game.start();

//	Listen for keyboard events.
var pressedKeys = [];
window.addEventListener("keydown", function keydown(e) {
	var keycode = window.event.keycode || e.which;
    if(!pressedKeys[keycode])
    	pressedKeys[keycode] = true;
    //	Supress further processing of left/right/space (37/29/32)
    if(keycode == 37 || keycode == 39 || keycode == 32) {
    	e.preventDefault();
    }
    game.keyDown(keycode);
});
window.addEventListener("keyup", function keydown(e) {
	var keycode = window.event.keycode || e.which;
    if(pressedKeys[keycode])
    	delete pressedKeys[keycode];
    game.keyUp(keycode);
});
</script>
````

References
----------

Other bits and peices that are uesful can be dropped here.

 * The sounds came from http://www.classicgaming.cc/classics/spaceinvaders/sounds.php
