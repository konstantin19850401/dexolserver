"use strict"
let Express = require ("express");
let Core = require('./application/Core');
let port = 3021;

let core = new Core({port: port, express: new Express()});
core.Start();

