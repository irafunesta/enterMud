const sqlite3 = require('sqlite3').verbose();

const CtrDb = {
	db: null,
	openCon: function openCon()
	{
		this.db = new sqlite3.Database('./db/chinook.db', sqlite3.OPEN_READWRITE, (err) => {
		  if (err) {
		    console.error(err.message);
		  }
		  console.log('Connected to the chinook database.');
		});
	},
	query: function query(query, rowCallback)
	{
		let db = new sqlite3.Database('./db/chinook.db', sqlite3.OPEN_READWRITE, (err) => {
		  if (err) {
		    console.error(err.message);
		  }
		  console.log('Connected to the chinook database.');
		});

		db.serialize(() => {
		  db.each(query, (err, row) => {
			if (err) {
			  console.error(err.message);
			}
			//console.log(row.id + "\t" + row.name);
			rowCallback(row);
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
