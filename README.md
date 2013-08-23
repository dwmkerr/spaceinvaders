spaceinvaders
=============

Classic Space Invaders game written in JavaScript as a learning exercise.

TODO
----

* should be able to push/pop state, for example
  the paused state could be a pushed state.
* Add configuration options to main page.
* show instructions nicely
* show 'won' nicely
* Scrollbars are goofy
* sounds
* explosions
* sprites?
* handle 'block' of invaders configuration
* handle levels
* remove unneeded key handling code in index.

TEST
----

* initial space on welcome screen fires a rocket
* show 'start game'
* show 'lost' nicely
* Allow pause.
* game states (start, countdown, finish, dead, level etc)
  can be controlled entirely by having the main loop call 
  the state's update/draw proc.
  demo this with a 'start' screen.
* score for hitting invaders
* Only the front rank of invaders should drop bombs
* Handle loss by invaders reaching bottom (not ship collision!)
* Make rocket speeds configurable.
* Limit to rocket rate.
* refactor settings and state.
* separate the starfield so that it can fill the screen
  and draw on its own canvas at a much lower framerate (stars
  will move more slowly).
* Make the main page instantiate/start the game
* Support move and fire at the same time.
* support full size
* Bombs aren't dropping
* Make bomb speeds configurable
* Allow dev mode (show extra info)