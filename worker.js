var SCWorker = require('socketcluster/scworker');
var express = require('express');
var serveStatic = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var healthChecker = require('sc-framework-health-check');
var scCodecMinBin = require('sc-codec-min-bin');
// const sqlite3 = require('sqlite3').verbose();
var databaseCtrl = require('./database_ctr');
var sha256 = require('js-sha256');

function publishChat(socket, data) {
	socket.exchange.publish('chat', {"id":socket.id, "data": data});
}

function saltPswd(salt, pswd) {
	let split = salt.split("5");
	let first_salt = split[0];
	let second_salt = split[1];
	return sha256(first_salt + pswd + second_salt);
}

class Worker extends SCWorker {
  run() {
    console.log('   >> Worker PID:', process.pid);
    var environment = this.options.environment;

    var app = express();

    var httpServer = this.httpServer;
    var scServer = this.scServer;
		const salt = "688787d8ff144c502c7f5cffaafe2cc588d86079f9de88304c26b0cb99ce91c6"

		this.scServer.setCodecEngine(scCodecMinBin);

		this.scServer.addMiddleware(scServer.MIDDLEWARE_PUBLISH_OUT, function (req, next) {
	  	let socketId = req.socket.id;
			let pubblishingId = req.data.id;

			console.log("socketId", socketId);
			console.log("pubblishingId", pubblishingId);

	    if (socketId != pubblishingId) {
	      next(); // Allow
	    } else {
	      var err = "Blocked publishing message out to same socket";
	      // next(err); // Block with notice
	      next(true); // Passing true to next() blocks quietly (without raising a warning on the server-side)
	    }
	  });

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
		//All the rooms have 4 exit, 1 may be Blocked
		//They have a floor and a ceiling
		//
		var rooms_desc = [
			""
		];
		var logged_users = [];
		var tmp_user_name = "";
    /*
      In here we handle our incoming realtime connections and listen for events.
	  // Some sample logic to show how to handle client events,
	  // replace this with your own logic
    */
    scServer.on('connection', function (socket) {

			function EnterRoom(actor, room_id)
			{
				let query = `SELECT * FROM rooms WHERE room_id = ${room_id}`;

				databaseCtrl.queryGet(query, (err, row) => {
					if(err)
					{
						console.log(err);
						//socket.emit("rand", err);
						respond(err);
					}
					else
					{
						console.log("Retreived rooms: ", row);
						if(row) {
							//Get the logged user
							let user = logged_users.find((user) => {
								return user.socId == socket.id;
							});
							//Update the in memory user room
							user.room = row.room_id;

							databaseCtrl.updateUserRoom(user.user_name, row.room_id, (err, d) => {
								if(err) console.log("err: ", err);
							});
							//Write room description
							socket.emit("rand", row.desc);
						}
					}
				});
				//room.actors.push(actor);
			}

			function CreateAndEnterRoom(user, current_room, direction)
			{
				//Create a new room, with a random descriptio + stuff
				//choose a random exit
				let exits = [-1,-1,-1,-1]; //n,s,e,w

				// for (let i in exits)
				// {
				// 		exits[i] = -1;
				// }

				// let x = 0;
				let new_y = current_room.y;
				let new_x = current_room.x;

				console.log("---------------------------------------------");
				console.log("exits: ", exits );
				console.log("---------------------------------------------");
				//last room exit direction
				switch(direction)
				{
					case "north": //y +
						//The room has no adiacents rooms
						//TODO add random desc
						exits[1] = current_room.room_id;
						new_y = current_room.y + 1;
						break;
					case "south":
						//Check rooms est west for their south exit_s
						exits[0] = current_room.room_id;
						new_y = current_room.y - 1;
						break;
					case "est":
						exits[3] = current_room.room_id;
						new_x = current_room.x + 1;
						break;
					case "west":
						exits[4] = current_room.room_id;
						new_x = current_room.x - 1;
						break;
				}

				console.log("----------------- check where to move ---------------");

				//Check where i want to move
				databaseCtrl.getRoomByPos(new_x, new_y, (err, room) => {
					if(err)
					{
						console.log("getRoomByPos: ", err);
					}
					else
					{
						if(room)
						{
							console.log("----------------- room already exist ---------------");
							console.log("move room: ", room);
							console.log("current_room id: ", current_room.room_id);
							console.log("room id: ", room.room_id);
							console.log("----------------- room already exist ---------------");

							databaseCtrl.connectRooms(current_room.room_id, room.room_id, direction, (err, last_id)=>{
								if(err){
									console.log("err ", err);
								}
								else {
									//Room already explored
									EnterRoom(user, room.room_id);
								}
							});
						}
						else
						{
							//make new room
							//connect the two
							databaseCtrl.createRoom("new room", "rand desc " + direction, exits[0], exits[1], exits[2],  exits[3], new_x, new_y, (err, last_id) => {
								if(err)
								{
									console.log("error creating room: ", err);
								}
								else
								{
									databaseCtrl.connectRooms(current_room.room_id, last_id, direction, (err, id)=>{
										if(err){
											console.log("err ", err);
										}
										else {
											//Room already explored
											EnterRoom(user, last_id);
										}
									});
								}
							});
						}
					}
				});
			}

			console.log("a socket connected ", socket.id);
			//Check if user is authenticated
			// let auth_token = socket.getAuthToken();
			// if(auth_token && auth_token.socId == socket.id)
			// {
			// 	let find_user = logged_users.find((user) => {
			// 		return auth_token.user_name == user.user_name && auth_token.socId == user.socId;
			// 	});
			//
			// 	if(find_user)
			// 	{
			// 		//User already loggeg in & authenticated update the socketId
			// 		// auth_token.socId = socket.id;
			// 		socket.deauthenticate();
			// 		console.log("Update user: ", auth_token.user_name);
			// 		console.log("new token: ", socket.id);
			// 		socket.setAuthToken({"user_name":auth_token.user_name, "socId":socket.id});
			// 	}
			// 	else
			// 	{
			// 		//user auth but not logged in ?
			// 		console.log("wierd case");
			// 		logged_users.push({"user_name":auth_token.user_name, "socId":socket.id});
			// 	}
			// }

			socket.on("askUpdate", function () {
				// socket.emit("playerUp", {"players":players,"current":socket.id});
				socket.exchange.publish('updateGame', {"players":players,"current":socket.id});
			}) ;

			socket.on("move", function (direction, respond) {
				// socket.emit("playerUp", {"players":players,"current":socket.id});
				//TODO move to the north exit
				let user = logged_users.find((user) => {
					return user.socId == socket.id;
				});
				let query = "SELECT * FROM rooms WHERE room_id = " + user.room;

				databaseCtrl.queryGet(query, (err, row) => {
					if(err)
					{
						console.log(err);
						//socket.emit("rand", err);
						respond(err);
					}
					else
					{
						console.log("Retreived rooms: ", row);
						if(row) {
							//The next room exist
							user.room = row.room_id;
							let next_room_id = 0;
							switch(direction)
							{
								case "north":
									next_room_id = row.exit_n;
									break;
								case "south":
									next_room_id = row.exit_s;
									break;
								case "est":
									next_room_id = row.exit_e;
									break;
								case "west":
									next_room_id = row.exit_w;
									break;
							}

							if(next_room_id == -1)
							{
								CreateAndEnterRoom(user, row, direction);
								respond(null, "You take the " + direction + "path.");
							}
							else if (next_room_id == 0)
							{
								respond(null, "The path " + direction + " is blocked.");
							}
							else
							{
								EnterRoom(user, next_room_id);
								respond(null, "You take the " + direction + "path.");
							}
						}
						else {
							respond("Room doesn't exist");
						}
					}
				});
			}) ;

			// socket.on("make_room", (err, data) => {
			// 	databaseCtrl.createRoom("test", "desc_test", 0, 0, 0, 0, 0, 0, (err, data) => {
			// 		if(err){
			// 			console.log(err);
			// 		}
			// 	});
			// });

			// socket.on("move", function(pos) {
			//   //console.log("move: " + pos, socket.id);
			//   var currentPlayer = players.find(function(p)
			//   {
			// 	  return p.id == socket.id
			//   });
			//
			//   var data = {};
			//   if(pos.x > 0 && pos.x < roomW - 32 && pos.y > 0 && pos.y < roomH - 32)
			//   {
			// 	currentPlayer.pos = pos;
			//   }
			//
			//   // currentPlayer.id;
			//
			//   //socket.emit("playerUp", {"players":players,"current":socket.id});
			// });

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
					publishChat(socket, data[0] +": " + data[1]);
				}
				else
				{
					socket.emit('noAuth');
				}
			});

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
							//Username is in the database
							//If the selected user is already logged in
							let lu = logged_users.find((user,i) => {
								return row.user_name == user.user_name;
							});
							// let auth_token = socket.getAuthToken();
							// let token_username = "";
							// if(auth_token != undefined) {
							// 	token_username = socket.getAuthToken().user_name;
							// }

							if(lu != undefined)
							{
								respond("User already logged in.");
							}
							else
							{
								respond(null, row.user_name);
								tmp_user_name = row.user_name;
							}
						}
						else {
							respond("Username not found. Type reg <name> to register");
						}
					}
				});
			});
			//register new user
			socket.on("register_username", (username, respond) => {
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
						if(row)
						{
							//Username is in the database
							respond("E001", "Username already taken. Enter another Username");
						}
						else
						{
							respond(null, "Username avaible.");
						}
					}
				});
			});

			socket.on("register_pswd", (user, respond) => {
				//Add the username to the db
				let new_user_name = user.user_name;
				let pswd = user.pswd;

				let crypt_pswd = saltPswd(salt, pswd);
				//var query = "SELECT user_id, user_name FROM users WHERE user_name = '" + username +"'";
				let query = 'INSERT INTO users(user_name, password) VALUES ';

				databaseCtrl.createUser(new_user_name, crypt_pswd, 1, (err, lastID) => {
					if(err)
					{
						console.log(err);
						//socket.emit("rand", err);
						respond(err);
					}
					else
					{
						if(lastID)
						{
							let new_char_e = 0;
							let new_char_hp = 100;
							//user registered
							databaseCtrl.createCharacter(lastID, new_char_e, new_char_hp, (err, data) => {
								if(err) {
									console.log("character creation err: ", err);
									respond(err);
								}
								else {
									let username = new_user_name;
									respond(null, {
										"user_name":username,
										"id":username,
										"energy": new_char_e,
										"hp" : new_char_hp
									});

									let user = {
										"user_name" : username,
										"socId":socket.id,
										"room": 1,
										"energy": new_char_e,
										"hp" : new_char_hp
									}

									socket.setAuthToken(user);
									logged_users.push(user);

									EnterRoom(logged_users[logged_users.length-1], 1);

									console.log("user ", username, " logged in");
									publishChat(socket, username + " logged in.");
								}
							});
						}
					}
				});
			});

			socket.on("send_password", (pswd, respond) => {
				//let cryPswd =
				let cryPswd = saltPswd(salt, pswd);
				console.log("tmp user_name: ", tmp_user_name);
				//Check if username is present in the db
				var query = `SELECT *
					FROM users
					INNER JOIN characters on characters.user_id = users.user_id
					WHERE password = '${cryPswd}'AND user_name = '${tmp_user_name}'`;
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
							respond(null, {
								"user_name":username,
								"id":username,
								"room": row.room,
								"energy": row.energy,
								"hp" : row.hp
							});

							console.log("user ", username, " logged in");
							publishChat(socket, username + " logged in.");
							tmp_user_name = "";

							let user = {
								"user_name" : username,
								"socId":socket.id,
								"room": row.room,
								"energy": row.energy,
								"hp" : row.hp
							}

							socket.setAuthToken(user);
							logged_users.push(user);

							EnterRoom(logged_users[logged_users.length-1], row.room);
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

				if(sid && sid.socId) {

					var pid = -1
					var currentPlayer = logged_users.find((p,i) => {
						pid = i;
						// let res = p.socId == socket.id
						return p.socId == sid.socId && p.user_name == sid.user_name;
					});

					if(pid != -1) {
						console.log("remove logged player");
						let log_user = logged_users[pid];
						//TODO save last room and stuff
						// databaseCtrl.update("UPDATE users SET room = ? WHERE user_name = " + log_user.user_name, [log_user.room], (err, last_id) => {
						// 	if(err)
						// 	{
						// 		console.log("Error updating user ",log_user.user_name,"last room ", err);
						// 	}
						// });
						logged_users.splice(pid, 1);
						console.log("logged in players: ", logged_users);
					}
					else {
						//User not found
					}
					// socketAuth = false;
					socket.deauthenticate(); //for Server
					socket.exchange.publish('p_disconnect', sid.user_name);
					socket.emit("deauth_client"); //disconnect the socket on the client
				}
			});

			// socket.on("deauthenticate", (old_auth_token) => {
			// 	console.log("socket ", socket.id, " deauthenticate");
			// 	var pid = -1
			// 	var currentPlayer = logged_users.find((p,i) => {
			// 		pid = i;
			// 		// let res = p.socId == socket.id
			// 		return p.socId == old_auth_token.socId;
			// 	});
			//
			// 	if(pid != -1) {
			// 		console.log("remove logged player ", logged_users[pid]);
			// 		logged_users.splice(pid, 1);
			// 		console.log("logged in players: ", logged_users);
			// 	}
			// 	else {
			// 		//User not found
			// 	}
			// 	// socketAuth = false;
			// 	//socket.exchange.publish('p_disconnect', socket.getAuthToken().user_name);
			// });

    });
  }
}

new Worker();
