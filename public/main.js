MG = {};

;(function () {
	MG.lastInput = "";
	MG.session = {id:"", name:""};
	MG.status = "NOT_LOGGED";
	//GSE.Init("myCanvas", 400, 400, false, InitGame, Update);
	// var cmd = document.getElementById("cmd");
	var mainScreen = document.getElementById("mainScreen");
	var input = document.getElementById("cmd");
	var stats = document.getElementById("stats");

	// var lastInput = ""
	let x = 100;

	input.addEventListener("keyup", function(event) {
	    event.preventDefault();
	    if (event.keyCode === 13 && input.value != "") {
	        SendEvent(input.value);
			input.value = "";
	    }
		if (event.keyCode === 38) {
			// console.log("lastInput ", lastInput);
			input.value = MG.lastInput;
	    }
	});

	MG.socket = socketCluster.connect({
		codecEngine: scCodecMinBin
	});

	MG.socket.on('error', function (err) {
	  throw 'Socket error - ' + err;
	  writeToConsole("Socket error - " + err);
	});

	MG.socket.on('connect', function (status) {
		console.log('CONNECTED');
		let token = MG.socket.getAuthToken();
		if(token && token.socId == MG.socket.id)
		{
			writeToConsole("User " + token.user_name + " already logged in.");
			MG.status = "IN_GAME";
		}
		else {
			writeToConsole("Enter your name");
			MG.status = "NOT_LOGGED";
		}
	});

	MG.socket.on('rand', function (data) {
	  console.log('RANDOM STREAM: ' + data);
	  writeToConsole(data);
	});

	MG.socket.on('item_found', function (data) {
	  console.log('item: ', data);
	  writeToConsole(data, true);
	});

	MG.socket.on('actor_found', function (data) {
	  console.log('RANDOM STREAM: ' + data);
	  writeToConsole(data);
	});

	MG.socket.on('player_found', function (data) {
	  console.log('RANDOM STREAM: ' + data);
	  writeToConsole(data);
	});

	MG.socket.on('user_update_status', function (stats) {
		updateStats(stats.hp, stats.energy);
	});

	MG.socket.on('noAuth', function (data) {
	  writeToConsole("The current user is not authenticated");
	});

	MG.socket.on('wrongCreds', function (data) {
	  writeToConsole("pswd or username not valid");
	});
	// var updateGameChannel = MG.socket.subscribe('updateGame');
	var disconnectChannel = MG.socket.subscribe('p_disconnect');
	// var chChat = MG.socket.subscribe('chat');
	//
	// chChat.on('subscribeFail', function (err) {
	//   console.log('Failed to subscribe to the updateGame channel due to error: ' + err);
	// });
	// chChat.watch(recivedMsg);

	disconnectChannel.on('subscribeFail', function (err) {
	  console.log('Failed to subscribe to the p_disconnect channel due to error: ' + err);
	});

	// updateGameChannel.watch(UpdateFromServer);
	disconnectChannel.watch(PlayerDisconnected);
	// MG.socket.on("playerUp", UpdateFromServer);
	// MG.socket.on("p_disconnect", PlayerDisconnected);
	MG.socket.on("deauth_client", () => {
		console.log("deauthenticate client");
		MG.socket.deauthenticate();
		//TODO do other stuff
	});

	MG.socket.on("room_subscribe", (channel_name) => {
		console.log("entered ", channel_name);
		enterRoomChannel(channel_name);
		//TODO do other stuff
	});

})();

// console.log(x);

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
		else if(msgParsed.length == 1)
		{
			command.cmd = msgParsed[0];
		}
	}
	return command;
}

function MovePlayer(direction)
{
	MG.socket.emit("move", direction, (err, response) => {
		if(err)
		{
			writeToConsole("An error occured " + err.toString());
		}
		else
		{
			writeToConsole(response);
		}
	});
}

function channelWatch(msg)
{
	var g = {
		"msg":"",
		"name" :msg.data,
		"type" : "player"
	}
	writeToConsole(g, true);
}

function enterRoomChannel(room_channel)
{
	// "channel_name":row.name,
	// "channel_id":row.id
	var ch = MG.socket.subscribe(room_channel);
	console.log("enterRoomChannel subscribe to ", room_channel);
	ch.on('subscribeFail', function (err) {
	  console.log(`Failed to subscribe to the ${room_channel} channel due to error: `, err);
	});

	ch.watch(channelWatch);

	MG.socket.emit("room_entered", room_channel);
}

function publishChannel(channel, socket, data) {
	socket.exchange.publish(channel, {"id":socket.id, "data": data});
}

function SendEvent(value)
{
	console.log("send ",value);
	var cmd = ParseCommand(value);
	MG.lastInput = value;

	if(MG.status == "NOT_LOGGED")
	{
		if(cmd.cmd == "reg" && cmd.args.length > 0)
		{

			MG.socket.emit("register_username", cmd.args[0], (err, response) => {
				if(err)
				{
					switch(err)
					{
						case "E001":
							//Username already taken
							writeToConsole(response.toString());
							MG.status = "SELECT_USERNAME";
							break;
						default:
							writeToConsole(err.toString());
							break;
					}
				}
				else
				{
					writeToConsole(response);
					MG.reg_user_name = cmd.args[0];
					writeToConsole("Enter new password");
				  MG.status = "REG_PASSWORD";
				}
			});
		}
		else
		{
			MG.socket.emit("send_username", value, (err, response) => {
				if(err) {
					writeToConsole(err.toString());
				}
				else {
					writeToConsole("Enter password");
			  	MG.status = "PASSWORD";
					//MG.session.name = ""
				}
			});
		}
	}
	else if (MG.status == "SELECT_USERNAME")
	{
		MG.socket.emit("register_username", value, (err, response) => {
			if(err)
			{
				switch(err)
				{
					case "E001":
						//Username already taken
						writeToConsole(response.toString());
						MG.status = "SELECT_USERNAME";
						break;
					default:
						writeToConsole(err.toString());
						break;
				}
			}
			else
			{
				MG.reg_user_name = cmd.args[0];
				writeToConsole("Enter new password");
				MG.status = "REG_PASSWORD";
			}
		});
	}
	else if (MG.status == "PASSWORD")
	{
		//TODO sha the password
		let cryPswd = value;
		MG.socket.emit("send_password", cryPswd, (err, response) => {
			if(err) {
				writeToConsole(err.toString());
			}
			else {
				writeToConsole("Welcome to EnterMUD " + response.user_name);
				updateStats(response.hp, response.energy);
		  	MG.status = "IN_GAME";
				MG.session.name = response.user_name;
				MG.session.id = response.user_name;

				var chChat = MG.socket.subscribe('chat');
				//
				chChat.on('subscribeFail', function (err) {
				   console.log('Failed to subscribe to the updateGame channel due to error: ' + err);
				});
				chChat.watch(recivedMsg);
			}
		});
	}
	else if(MG.status == "REG_PASSWORD")
	{
		//send the password for the user
		var user = {
			"user_name": MG.reg_user_name,
			"pswd": value
		}
		MG.socket.emit("register_pswd", user, (err, response) => {
			if(err)
			{
				writeToConsole(err.toString());
			}
			else
			{
				writeToConsole("Welcome to EnterMUD " + response.user_name);
				updateStats(response.hp, response.energy);
				MG.status = "IN_GAME";
				// MG.session.name = response.user_name;
				// MG.session.id = response.user_name;

				var chChat = MG.socket.subscribe('chat');
				//
				chChat.on('subscribeFail', function (err) {
				   console.log('Failed to subscribe to the updateGame channel due to error: ' + err);
				});
				chChat.watch(recivedMsg);
			}
		});
	}
	else if(MG.status == "IN_GAME")
	{
		if(cmd != undefined && cmd.cmd != undefined)
		{
			switch(cmd.cmd)
			{
				case "north":
				case "n":
					MovePlayer("north");
					break;
				case "south":
				case "s":
					MovePlayer("south");
					break;
				case "est":
				case "e":
					MovePlayer("est");
					break;
				case "west":
				case "w":
					MovePlayer("west");
					break;
				case "look":
					// MG.socket.emit("make_room");
					break;
				default:
					var token = MG.socket.getAuthToken();
					if(token)
					{
						MG.socket.emit("chatMessage", [token.user_name, value]);
						writeToConsole("you : " + value);
					}
					else
					{
						//User logged out
						MG.status = "NOT_LOGGED";
						// MG.socket.deauthenticate();
						writeToConsole("Enter your name");
					}
					break;
			}
		}
	}
}

function updateScroll(){
    var element = document.getElementById("winScroll");
    element.scrollTop = element.scrollHeight;
}

function recivedMsg(resp)
{
	console.log(resp);
	writeToConsole(resp.data);
}

function writeToConsole(msg, link = false)
{
	if(link == true)
	{
		var p = document.createElement("li");
		var a = document.createElement("a");

		//a.href = msg.id;
		var className = "";
		switch(msg.type)
		{
			case "item":
				className = "itemText";
				break;
			case "enemy_docile":
				className = "docileEnemy";
				break;
			case "player":
				className = "playerText";
				break;
			case "enemy_aggressive":
				className = "aggressiveEnemy";
				break;
		}

		a.className = className;

		a.appendChild(document.createTextNode(msg.name));

		p.appendChild(document.createTextNode(msg.msg));
		p.appendChild(a);
		//mainScreen.firstElementChild()
		mainScreen.appendChild(p);
	}
	else
	{
		var p = document.createElement("li");

		p.appendChild(document.createTextNode(msg));
		//mainScreen.firstElementChild()
		mainScreen.appendChild(p);
	}
	updateScroll();
}

function updateStats(hp, energy)
{
	var str = "Hp: " + hp.toString() + " - Energy: " + energy.toString();
	stats.replaceChild(document.createTextNode(str), stats.firstChild);
}

function clearConsole()
{

}

function PlayerDisconnected(id)
{
	console.log(id, " disconnected");
	writeToConsole(id + " disconnected");
}
