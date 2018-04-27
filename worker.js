var SCWorker = require('socketcluster/scworker');
var express = require('express');
var serveStatic = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var healthChecker = require('sc-framework-health-check');
var scCodecMinBin = require('sc-codec-min-bin');
// const sqlite3 = require('sqlite3').verbose();
var databaseCtrl = require('./database_ctr');

class Worker extends SCWorker {
  run() {
    console.log('   >> Worker PID:', process.pid);
    var environment = this.options.environment;

    var app = express();

    var httpServer = this.httpServer;
    var scServer = this.scServer;

	this.scServer.setCodecEngine(scCodecMinBin);

    if (environment === 'dev') {
      // Log every HTTP request. See https://github.com/expressjs/morgan for other
      // available formats.
      app.use(morgan('dev'));
    }
    app.use(serveStatic(path.resolve(__dirname, 'public')));

    // Add GET /health-check express route
    healthChecker.attach(this, app);

    httpServer.on('request', app);

	function ParseCommand(msg)
	{
		var command = {}
		if(msg != "")
		{
			console.log("msg ", msg);
			var msgParsed = msg.split(" ");
			if(msgParsed.length > 1)
			{
				command.cmd = msgParsed[0];
				command.args = msgParsed.slice(1);
			}
		}
		return command;
	}

    var count = 0;
	var players = [];
	var roomW = 400;
	var roomH = 400;
	var socketAuth = false;

    /*
      In here we handle our incoming realtime connections and listen for events.
	  // Some sample logic to show how to handle client events,
	  // replace this with your own logic
    */
    scServer.on('connection', function (socket) {
		players.push ({
			"id":socket.id,
			"pos": {
				x: 200,
				y: 200
			}
		});

		console.log("a user connected ", socket.id);
		socketAuth = false;

		socket.on("askUpdate", function () {
			// socket.emit("playerUp", {"players":players,"current":socket.id});
			socket.exchange.publish('updateGame', {"players":players,"current":socket.id});
		}) ;

		socket.on("move", function(pos) {
		  //console.log("move: " + pos, socket.id);
		  var currentPlayer = players.find(function(p)
		  {
			  return p.id == socket.id
		  });

		  var data = {};
		  if(pos.x > 0 && pos.x < roomW - 32 && pos.y > 0 && pos.y < roomH - 32)
		  {
			currentPlayer.pos = pos;
		  }

		  // currentPlayer.id;

		  //socket.emit("playerUp", {"players":players,"current":socket.id});
		});

		socket.on("getPlaylist", (data) => {
			var query = "SELECT PlaylistId as id, Name as name FROM playlists";
			databaseCtrl.query(query, (row) => {
				socket.emit("rand", row.id + "\t" + row.name);
			});
		});

		socket.on('chatMessage', function (data) {
			var c = ParseCommand(data[1]);
			console.log("command ", c);
			if(socketAuth == true)
			{
				console.log("auth true");
				socket.exchange.publish('chat', socket.id +": " + data[1]);
			}
			else
			{
				if(c.cmd && c.cmd == "login")
				{
					/*
						Get the username and password and find a match
					*/
					if(c.args[0] == "ira" && c.args[1] == "pswd")
					{
						socketAuth = true;
						socket.emit("rand",'login successful');
					}
					else {
						socket.emit("rand", "pswd or username not valid");
					}
				}
				else
				{
					socket.emit('noAuth');
				}
			}
		});
		//
		// var interval = setInterval(function () {
		// 	socket.emit('rand', "random message");
		// }, 1000);

		socket.on('disconnect', function () {
			// clearInterval(interval);
			console.log("player disconnect", socket.id);
			var pid = 0
			var currentPlayer = players.find(function(p,i)
			{
				pid = i;
				return p.id == socket.id
			});
			players.splice(pid, 1);
			//io.emit("playerUp", {"players":players,"current":socket.id});
			socket.exchange.publish('p_disconnect', socket.id);
		});
    });
  }
}

new Worker();
