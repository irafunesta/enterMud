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

	this.scServer.addMiddleware(scServer.MIDDLEWARE_PUBLISH_OUT,
	  function (req, next) {
	    // ...
		// console.log(req);

		let token = req.socket.getAuthToken().socId;
		let socketId = req.socket.id;

		console.log("token", token);
		console.log("socketId", socketId);

	    if (token && socketId && token.socId != socketId) {
	      next(); // Allow
	    } else {
	      var err = MyCustomPublishOutFailedError('Blocked publishing message out to ' + req.socket.id);
	      next(err); // Block with notice
	      // next(true); // Passing true to next() blocks quietly (without raising a warning on the server-side)
	    }
	  }
	);

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
	var logged_users = [];
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
			if(socket.authToken != null && socket.authToken.user_name == data[0])
			{
				// console.log("auth true");
				socket.exchange.publish('chat', data[0] +": " + data[1]);
			}
			else
			{
				socket.emit('noAuth');
			}
		});

		// socket.on("login", function(args, respond)
		// {
		// 	//chek user login
		// 	if(args[0] == "ira" && args[1] == "pswd")
		// 	{
		// 		respond();
		// 		// This will give the client a token so that they won't
      	// 		// have to login again if they lose their connection
      	// 		// or revisit the app at a later time.
      	// 		socket.setAuthToken({username: args[0]});
		// 		socket.exchange.publish('chat', args [0] + " logged in");
		// 	}
		// 	else {
		// 		 // Passing string as first argument indicates error
		// 		respond('Login username or password incorrect');
		// 	}
		// });

		socket.on("send_username", (username, respond) => {
			//Check if username is present in the db
			var query = "SELECT user_id, user_name FROM users WHERE user_name = '" + username +"'";
			databaseCtrl.queryGet(query, (err, row) => {
				if(err)
				{
					console.log(err);
					//socket.emit("rand", err);
					respond(err);
				}
				else
				{
					if(row) {
						if(logged_users.indexOf(row.user_name) == -1) {
							respond(null, row.user_name);
						}
						else {
							respond("User already logged in.");
						}
					}
					else {
						respond("Username not found.");
					}
				}
			});
		});

		socket.on("send_password", (cryPswd, respond) => {
			//Check if username is present in the db
			var query = "SELECT user_id, user_name FROM users WHERE password = '" + cryPswd +"'";
			databaseCtrl.queryGet(query, (err, row) => {
				if(err)
				{
					console.log(err);
					//socket.emit("rand", err);
					respond(err);
				}
				else
				{
					if(row) {
						let username = row.user_name;
						respond(null, {"user_name":username, "id":username});
						socket.setAuthToken({"user_name":username, "socId":socket.id});
						logged_users.push(username);
						socket.exchange.publish('chat', username + " logged in.");
					}
					else {
						respond("Wrong Password.");
						//socket.emit("rand", "Wrong Password");
					}
				}
			});
		});
		//
		// var interval = setInterval(function () {
		// 	socket.emit('rand', "random message");
		// }, 1000);

		socket.on('disconnect', function () {
			// clearInterval(interval);
			console.log("player disconnect", socket.id);
			let sid = socket.getAuthToken();
			if(sid && sid.user_name) {
				var pid = -1
				var currentPlayer = logged_users.find(function(p,i)
				{
					pid = i;
					return p == socket.getAuthToken().user_name;
				});

				if(pid != -1) {
					players.splice(pid, 1);
				}
				socket.exchange.publish('p_disconnect', socket.getAuthToken().user_name);
			}
		});
    });
  }
}

new Worker();
