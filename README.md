Space Invaders
==============

The classic Space Invaders game written in JavaScript as a learning exercise.

No jQuery or any other third party libraries, just raw js/html.

Demo: https://clsb-programming.github.io/spaceinvaders/

Original Project: https://github.com/dwmkerr/spaceinvaders

Sounds: http://www.classicgaming.cc/classics/spaceinvaders/sounds.php

Adding to your site
-------------------

To add Space Invaders to your site, just add this code.

````HTML
<link rel="stylesheet" type="text/css" href="https://clsb-programming.github.io/spaceinvaders/css/core.css">
<link rel="stylesheet" type="text/css" href="https://clsb-programming.github.io/spaceinvaders/css/typeography.css">
<link rel="stylesheet" type="text/css" href="https://clsb-programming.github.io/spaceinvaders/css/game.css">
<div id="starfield"></div>
<div id="gamecontainer">
<canvas id="gameCanvas"></canvas>
</div>
<div id="info">
    <p>The invaders get faster and drop more bombs as you complete each level! | Controls: WASD / Arrow Keys + Space</p>
    <p><a id="muteLink" href="#" onclick="toggleMute()">Mute</a> | 
        <a href="https://github.com/dwmkerr/spaceinvaders">Original Project</a> | 
        <a href="https://github.com/CLSB-Programming/spaceinvaders">GitHub Project</a> | 
        v1.1</p>
</div>
<script src="https://clsb-programming.github.io/spaceinvaders/js/starfield.js"></script>
<script src="https://clsb-programming.github.io/spaceinvaders/js/spaceinvaders.js"></script>
<script src="https://clsb-programming.github.io/spaceinvaders/js/setup.js"></script>
````
