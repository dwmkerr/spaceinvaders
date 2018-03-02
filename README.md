Space Invaders
==============

The classic Space Invaders game written in JavaScript as a learning exercise.

No jQuery or any other third party libraries, just raw js/html.

Demo: https://prouser123.github.io/spaceinvaders/

Original Project: https://github.com/dwmkerr/spaceinvaders

Sounds: http://www.classicgaming.cc/classics/spaceinvaders/sounds.php

Adding to your site
-------------------

To add Space Invaders to your site, just add this code.

````HTML
<link rel="stylesheet" type="text/css" href="css/core.css">
<link rel="stylesheet" type="text/css" href="css/typeography.css">
<link rel="stylesheet" type="text/css" href="css/game.css">
<div id="starfield"></div>
<div id="gamecontainer">
<canvas id="gameCanvas"></canvas>
</div>
<div id="info">
    <p>The invaders get faster and drop more bombs as you complete each level! | Controls: WASD / Arrow Keys + Space</p>
    <p><a id="muteLink" href="#" onclick="toggleMute()">Mute</a> | 
        <a href="https://github.com/dwmkerr/spaceinvaders">Original Project</a> | 
        <a href="https://github.com/Prouser123/spaceinvaders">GitHub Project</a> | 
        v1.1</p>
</div>
<script src="js/starfield.js"></script>
<script src="js/spaceinvaders.js"></script>
<script src="js/setup.js"></script>
````
