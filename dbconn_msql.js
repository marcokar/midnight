
var mysql = require('mysql');

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'pi',
  password : 'raspberry',
  database : 'pidb'
});

connection.connect(function(err) {
  if(err == null){console.log('Connected to database');}
});

/*

var admin = require("firebase-admin");
var serviceAccount = require(__dirname + '/db/midnight-d1b07-firebase-adminsdk-8rccx-b37f58b060.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://midnight-d1b07.firebaseio.com"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
var db = admin.database();

////////////////////////////////////
// AUXILIARY FUNCTIONS /////////////
////////////////////////////////////

exports.push = function (path) {
  ref = db.ref(path);
  newRef = ref.push();
  return newRef.key;
}

exports.updateData = function (path, data) {
  ref = db.ref(path);
  ref.update(data);
}

exports.getSnapshot = function (path, callback) {
  ref = db.ref(path);
  ref.once("value", function (snapshot) {
    callback(snapshot);
  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });
}

exports.getSnapshotByChild = function (path, child, value, callback) {
  ref = db.ref(path);
  ref.orderByChild(child).equalTo(value).once("value", function (snapshot) {
    callback(snapshot);
  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });
}

exports.deleteData = function (path) {
  ref = db.ref(path);
  ref.set({});
}

// OLD FUNCTIONS

exports.postQuery = function (reqPars, query, post, cback) {
  connection.query(query, post,
    (function (reqPars, cback) {
      return function (err, result) {
        cback(reqPars, err, result);
      };
    })(reqPars, cback));
}

exports.selectQuery = function (reqPars, query, cback) {
  connection.query(query,
    (function (reqPars, cback) {
      return function (err, rows) {
        cback(reqPars, err, rows);
      };
    })(reqPars, cback));
}

*/