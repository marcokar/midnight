
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
  var ref = db.ref(path);
  var newRef = ref.push();
  return newRef.key;
}

exports.updateData = function (path, data) {
  var ref = db.ref(path);
  ref.update(data);
}

exports.getSnapshot = function (path, callback) {
  var ref = db.ref(path);
  ref.once("value", function (snapshot) {
    callback(snapshot);
  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });
}

exports.getSnapshotByChild = function (path, child, value, callback) {
  var ref = db.ref(path);
  ref.orderByChild(child).equalTo(value).once("value", function (snapshot) {
    callback(snapshot);
  }, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
  });
}

exports.deleteData = function (path) {
  var ref = db.ref(path);
  ref.set({});
}
