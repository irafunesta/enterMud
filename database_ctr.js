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
	}
}

module.exports = CtrDb;
