const sqlite3 = require('sqlite3').verbose();
const dabaseName = "./db/mud.db";

const CtrDb = {
	db: null,
	openCon: function openCon()
	{
		return new sqlite3.Database(dabaseName, sqlite3.OPEN_READWRITE, (err) => {
		  if (err) {
		    console.error(err.message);
		  }
		  console.log('Connected to the mud database.');
		});
	},
	queryAll: function query(query, rowCallback)
	{
		db = this.openCon();

		db.serialize(() => {
		  db.all(query, [], (err, row) => {
			if (err) {
			  console.error(err.message);
			  rowCallback(err, row);
			}
			else {
				rowCallback(null, row);
			}
		  });
		});

		db.close((err) => {
		  if (err) {
			console.error(err.message);
		  }
		  console.log('Close the database connection.');
		});
	},
	queryGet: function query(query, rowCallback)
	{
		console.log("queryGet: ", query);
		db = this.openCon();

		db.serialize(() => {
		  db.get(query, [], (err, row) => {
			if (err) {
			  console.error(err.message);
			  rowCallback(err, row);
			}
			else {
				rowCallback(null, row);
			}
		  });
		});

		db.close((err) => {
		  if (err) {
			console.error(err.message);
		  }
		  console.log('Close the database connection.');
		});
	},
	queryEach: function query(query, rowCallback)
	{
		db = this.openCon();

		db.serialize(() => {
		  db.each(query, [], (err, row) => {
			if (err) {
			  console.error(err.message);
			  rowCallback(err, row);
			}
			else {
				rowCallback(null, row);
			}
		  });
		});

		db.close((err) => {
		  if (err) {
			console.error(err.message);
		  }
		  console.log('Close the database connection.');
		});
	},
	closeCon: function closeCon()
	{
		this.db.close()
	},
	insert: function insert(query, values, rowCallback)
	{
		let placeholders = values.map((value) => '(?)').join(',');
		let sql = query;
		//let sql = query + placeholders;
		console.log("insert q: ", sql);
		console.log("values: ", values);
		db = this.openCon();

		db.run(sql, values, function(err) {
	    if (err) {
	      console.log(err.message);
				rowCallback(err, this.lastID);
	    }
			else
			{
				// get the last insert id
		    console.log(`A row has been inserted with rowid ${this.lastID}`);
				rowCallback(null, this.lastID);
			}
	  });

		db.close((err) => {
		  if (err) {
			console.error(err.message);
		  }
		  console.log('Close the database connection.');
		});
	},
	update: function insert(query, values, rowCallback)
	{
		//let placeholders = values.map((value) => '(?)').join(',');
		let sql = query;
		//let sql = query + placeholders;
		console.log("insert q: ", sql);
		console.log("values: ", values);
		db = this.openCon();

		db.run(sql, values, function(err) {
	    if (err) {
	      console.log(err.message);
				rowCallback(err, this.lastID);
	    }
			else
			{
				// get the last insert id
		    console.log(`A row updated ${this.changes}`);
				rowCallback(null, this.lastID);
			}
	  });

		db.close((err) => {
		  if (err) {
			console.error(err.message);
		  }
		  console.log('Close the database connection.');
		});
	},
	createRoom(name, description, exit_n, exit_s, exit_e, exit_w, x, y, call_back)
	{
		let query = `INSERT INTO rooms(name, desc, exit_n, exit_s, exit_e, exit_w, x, y)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
		let values = [name, description, exit_n, exit_s, exit_e, exit_w, x, y];

		this.insert(query, values, call_back);
	},
	createUser(user_name, password, room, call_back)
	{
		let query = `INSERT INTO users(user_name, password, room)
		VALUES (?, ?, ?)`;
		let values = [user_name, password, room];

		this.insert(query, values, call_back);
	},
	getRoomByPos(x, y, call_back)
	{
		let q = `SELECT * FROM rooms WHERE x = ${x} AND y = ${y}`;
		this.queryGet(q, call_back);
	},
	updateRoomId(room_id, new_id, direction, call_back)
	{
		let dir = direction;
		switch(direction)
		{
			case "north":
				dir = "exit_n";
				break;
			case "south":
				dir = "exit_s";
				break;
			case "est":
				dir = "exit_e";
				break;
			case "west":
				dir = "exit_w";
				break;
		}

		let q = `UPDATE rooms SET ${dir}=? WHERE room_id = ${room_id}`;
		this.update(q, new_id, call_back);
	},
	connectRooms(room_id_a, room_id_b, direction_a_b, call_back)
	{
		let dir = direction_a_b;
		let reverse_dir = ""
		switch(direction_a_b)
		{
			case "north":
				dir = "exit_n";
				reverse_dir = "exit_s";
				break;
			case "south":
				dir = "exit_s";
				reverse_dir = "exit_n";
				break;
			case "est":
				dir = "exit_e";
				reverse_dir = "exit_w";
				break;
			case "west":
				dir = "exit_w";
				reverse_dir = "exit_e";
				break;
		}

		let q = `UPDATE rooms SET ${dir}=${room_id_b} WHERE room_id = ${room_id_a}`;
		let q2 = `UPDATE rooms SET ${reverse_dir}=${room_id_a} WHERE room_id = ${room_id_b}`;

		this.update(q, [], (err, lastId)=>{
			if(err)
			{
				console.log(err);
				return
			}
			else{

				this.update(q2, [], call_back);
			}
		});
	},
	updateUserRoom(user_name, new_room_id, call_back)
	{
		let q = `UPDATE users SET room=${new_room_id} WHERE user_name='${user_name}'`;
		console.log("query: ", q);
		this.update(q, [], call_back);
	}

}

module.exports = CtrDb;
