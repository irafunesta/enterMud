MG = {};

;(function () {
	MG.lastInput = "";
	MG.session = {id:"", name:""};
	MG.status = "NOT_LOGGED";
	//GSE.Init("myCanvas", 400, 400, false, InitGame, Update);
	// var cmd = document.getElementById("cmd");
	var mainScreen = document.getElementById("mainScreen");
	var input = document.getElementById("cmd");

	// var lastInput = ""

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
		if(token && MG.session.id == token.id && MG.session.name == token.name)
		{
			writeToConsole("Connected Auth");
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
	MG.socket.on("p_disconnect", PlayerDisconnected);
})();

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

function SendEvent(value)
{
	console.log("send ",value);

	MG.lastInput = value;

	if(MG.status == "NOT_LOGGED")
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
	else if(MG.status == "IN_GAME")
	{
		var cmd = ParseCommand(value);
		// console.log(lastInput);
		if(value == "getPlaylist")
		{
			MG.socket.emit("getPlaylist");
		}
		else if(cmd != undefined && cmd.cmd == "login")
		{
			MG.socket.emit('login', cmd.args, function (err) {
			  // This callback handles the response from the server.
			  // If we wanted, we could have listened to a separate 'loginResponse'
			  // event, but this pattern of passing a callback like this
			  // is slightly more efficient.

				if (err) {
					// showLoginError(err);
					writeToConsole(err);
				} else {
					// goToMainScreen();
					writeToConsole("User " +cmd.args[0].toString() + " logged in.");
				}
			});
		}
		else if(value)
		{
			MG.socket.emit("chatMessage", [MG.session.name, value]);
		}
	}
}

function updateScroll(){
    var element = document.getElementById("winScroll");
    element.scrollTop = element.scrollHeight;
}

function recivedMsg(data)
{
	console.log(data);
	writeToConsole(data);
}

function writeToConsole(msg)
{
	var p = document.createElement("li");

	p.appendChild(document.createTextNode(msg));
	//mainScreen.firstElementChild()
	mainScreen.appendChild(p);
	updateScroll();
}

function SendPlayerPos(pos)
{
	if(MG.socket)
	{
		MG.socket.emit("move", {"x":pos.x,"y":pos.y});
	}
}

function UpdateStatus(pos)
{
	console.log("AskUpdate");
	if(MG.socket)
	{
		MG.socket.emit("askUpdate", pos);
	}
}

function handleUpdate(self)
{
	if(GSE.Input.IsKeyDown('d'))
	{
		self.x += 4
		SendPlayerPos({"x":self.x,"y":self.y});
	}
	if(GSE.Input.IsKeyDown('a'))
	{
		self.x -= 4
		SendPlayerPos({"x":self.x,"y":self.y});
	}
	if(GSE.Input.IsKeyDown('w'))
	{
		self.y -= 4
		SendPlayerPos({"x":self.x,"y":self.y});
	}
	if(GSE.Input.IsKeyDown('s'))
	{
		self.y += 4
		SendPlayerPos({"x":self.x,"y":self.y});
	}
}

function PlayerDisconnected(id)
{
	console.log(id, " disconnected");
	writeToConsole(id + " disconnected");
	MG.socket.deauthenticate();
	// var p = GSE.Scene.GetEntity(id);
	// if(p.tag != null | p.tag != undefined)
	// {
	// 	GSE.Scene.UI.RemoveEntity(p.id);
	// }
	// GSE.Scene.RemoveEntity(id);
}

function UpdateFromServer(data)
{
	data.players.forEach(function(player)
	{
		if(player.id == MG.socket.id) {
			//This is my player
			MG.playerEnt.x = player.pos.x;
			MG.playerEnt.y = player.pos.y;
			MG.playerTag.x = player.pos.x;
			MG.playerTag.y = player.pos.y;
			MG.playerTag.text = player.id;
		}
		else {
			var otherPg = GSE.Scene.GetEntity(player.id);
			if(otherPg != null)
			{
				//Update the entity
				otherPg.x = player.pos.x;
				otherPg.y = player.pos.y;
				otherPg.tag.x = player.pos.x;
				otherPg.tag.y = player.pos.y;
				otherPg.tag.text = player.id;
			}
			else {
				var spr = GSE.Scene.CreateSprite("", 'yellow', 20, GSE.Window.screenHeight/2, 32, 32);

				var pg = GSE.Scene.CreateEntity(player.id, spr, null);
				pg.x = player.pos.x;
				pg.y = player.pos.y;
				pg.tag = GSE.Scene.UI.DrawText(player.id, player.pos.x, player.pos.y, "white", "12");
			}
		}
	});

	// MG.playerEnt.tag = data.tag;
	//console.log("Server status ", JSON.stringify(data));

}

function InitGame(ctx)
{
	// MG.context = ctx;
	var image = "";

	//A way to create the Scene, and add object to it for drawing on the window
	var id = "Player";


	// var enemySpr = GSE.Scene.CreateSprite('./sprites/goblin.png', 'red', 235,98,128,128);
	var playerSpr2 = GSE.Scene.CreateSprite("/img/alien1.png", 'yellow', 20, GSE.Window.screenHeight/2, 32, 32);

	MG.playerEnt = GSE.Scene.CreateEntity('player', playerSpr2, handleUpdate);
	MG.playerEnt.tag = "guest";
	MG.playerTag = GSE.Scene.UI.DrawText(MG.playerEnt.tag, MG.playerEnt.x, MG.playerEnt.y, "white", "12");
	// var handleUpdatePlayer =

	//MG.cellSpr =  GSE.Scene.CreateSprite("", 'blue', 0, 0, 2, 2);
	// MG.cellGrid = [GSE.Window.screenWidth / 2, GSE.Window.screenHeight / 2];

	// for(i = 0; i < GSE.Window.screenWidth / 2; i++) //y
	// {
	// 	for(j = 0; j < GSE.Window.screenHeight / 2; j++) //x
	// 	{
	// 		var id = i.toString() + j.toString();
	// 		MG.cellSpr.x = j * 2;
	// 		MG.cellSpr.y = i * 2;
	// 		var cell = GSE.Scene.CreateEntity(id, MG.cellSpr, cellUpdate);
	// 		cell.food = GSE.randomRange(100, 1000);
	// 		// MG.cellGrid[i, j] = cell;
	// 	}
	// }

	// var enemy = GSE.Scene.CreateEntity('Enemy', enemySpr, updateEnemy, false, false);

	// GSE.Scene.setTileImage("./tilesets/tileSetTest.png");
	//
	// GSE.Scene.map = [
	// 	1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,
	// 	0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,0,1,0,0,0,0,0,1,9,0,0,0,0,0,0,0,0,0,
	// 	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	// 	1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1
	// ];

	// player.speed = 4;
	// player.stepThreshold = 10;
	// player.steps = 0
	// player.canMove = true;
	// player.hp = 1;
	// player.maxHp = 10;
	//
	// enemy.hp = 3;
	// enemy.maxHp = 3;
	// enemy.canAttack = true;

	// player.checkSteps = function(self) {
	// 	if(self.steps < self.stepThreshold)
	// 	{
	// 		self.steps++;
	// 	}
	// 	else {
	// 		self.steps = 0;
	// 		MG.EnterCombat();
	// 	}
	// }
	// if(MG.socket)
	// {
	// 	MG.socket.on("playerUp", UpdateFromServer);
	// }

	var combatOptions = ["Attack", "Item", "Flee", "Pass"];
	var currentOption = 0;
	MG.combatTurn = -1; //0 player, 1 Enemy
	MG.start = false;
	MG.halfCount = 0;
}

function updateEnemy(self) {
	if(self.hp <= 0)
	{
		MG.ExitCombat();
	}
	if(MG.combatTurn == 1)
	{
		//TODO Enemy AI
		var player = GSE.Scene.GetEntity("Player");
		if(self.canAttack == true)
		{
			player.hp--;
			self.canAttack = false;
		}
		// MG.combatTurn = 0;
		// MG.ChangeCombatTurn(-1, 10);
		MG.ChangeCombatTurn(0, 500);
	}
}

function Update(lastTick, timeSinceTick)
{
	if(MG.halfCount % 3 == 0)
	{
		// SendPlayerPos({"x":MG.playerEnt.x,"y":MG.playerEnt.y});
		MG.socket.emit("askUpdate");
	}
	MG.halfCount += 1;
	MG.halfCount %= 2;
	// if(MG.inGame == true)
	// {
	// 	MG.scoreText.text = MG.score;
	// 	MG.score += 1;
	// }
	// var player = GSE.Scene.GetEntity('Player');
	// MG.nextPos.x = player.x + 4;
	// MG.nextPos.y = player.y + 4;

	if(GSE.Input.IsKeyPressed('r'))
	{
		console.log("r");
		// GSE.StateManager.nextState("Map");

			GSE.Scene.entities[160001].food = 0;
	}
	if(GSE.Input.IsKeyPressed('q'))
	{
		MG.start = !MG.start;
	}
}
