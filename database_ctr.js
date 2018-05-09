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
	createRoom(name, description, exit_n, exit_s, exit_e, exit_w, call_back)
	{
		let query = `INSERT INTO rooms(name, desc, exit_n, exit_s, exit_e, exit_w)
		VALUES (?, ?, ?, ?, ?, ?)`;
		let values = [name, description, exit_n, exit_s, exit_e, exit_w];

		this.insert(query, values, call_back);
	},
	createUser(user_name, password, room, call_back)
	{
		let query = `INSERT INTO users(user_name, password, room)
		VALUES (?, ?, ?)`;
		let values = [user_name, password, room];

		this.insert(query, values, call_back);
	}
}

module.exports = CtrDb;
