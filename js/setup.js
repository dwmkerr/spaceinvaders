//  Create the starfield.
var container = document.getElementById('starfield');
var starfield = new Starfield();
starfield.initialise(container);
starfield.start();

//  Setup the canvas.
var canvas = document.getElementById("gameCanvas");
canvas.width = 800;
canvas.height = 600;

//  Create the game.
var game = new Game();
var keycodes = new Keycodes();

//  Initialise it with the game canvas.
game.initialise(canvas);

//  Start the game.
game.start();

//  Listen for keyboard events.
window.addEventListener("keydown", function keydown(e) {
    var keycode = e.which || window.event.keycode;
    //  Supress further processing of left/right/space/a/d/w/up (37/29/32/65/68/87/38)
    if(keycode == keycodes.arrows.left || keycode == keycodes.arrows.right || keycode == keycodes.space || keycode == 65 || keycode == 68 || keycode == 87 || keycode == 38) {
        e.preventDefault();
    }
    game.keyDown(keycode);
});

window.addEventListener("keyup", function keydown(e) {
    var keycode = e.which || window.event.keycode;
    game.keyUp(keycode);
});

// Touch Input

window.addEventListener("touchstart", function (e) {
    game.touchstart(e);
}, false);

window.addEventListener('touchend', function(e){
    game.touchend(e);
}, false);

window.addEventListener('touchmove', function(e){
    game.touchmove(e);
}, false);

function toggleMute() {
    game.mute();
    document.getElementById("muteLink").innerText = game.sounds.mute ? "Unmute" : "Mute";
}