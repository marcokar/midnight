
var aux = require('./auxiliary.js');
var som = require('./sockmanager.js');

var sockets = new Object();
var users = new Object();
var match = new Object();

var minit = false;

process.on('message', (m, socket) => {
  var procPars = aux.decJson(m); // Decode request POST data
  switch (procPars.act) {

    case "INIT":
      console.log("Initializing match");
      match['usr1'] = procPars.usr1;
      match['usr2'] = procPars.usr2;
      match['sts'] = 0;
      match['cnt'] = 0;
      minit = true;
      break;

    case "MCONNECT":

      // Check if socket is valid
      if (socket == undefined) { return; }

      // Check if user is allowed
      if (procPars.usr != match.usr1 && procPars.usr != match.usr2) {
        som.sendTCP({
          socket: socket,
          out: { ctx: 'MATCH', act: 'MCONNECT', sts: 0 }
        });
        return;
      }

      // Create socket
      sid = som.createSocket(socket, sockets, users, processTCP);
      res = som.bindSocket(sockets[sid], procPars.usr, users);

      // Notify client of succesful connection
      if (sid != undefined && res == true) {
        console.log('Match: client connected: ' + sid);
        som.sendTCP({
          socket: socket,
          out: { ctx: 'MATCH', act: 'MCONNECT', sts: 1 }
        });
      }

      break;

  }

});

function disconnectFromMatch(usr) {
  socket = som.resolveSocket(usr, users, sockets);
  process.send(aux.encJson({ act: "MDISCONNECT", usr: usr }), socket);
}

function endMatch() {
  delete itvl;
  disconnectFromMatch(match.usr1);
  disconnectFromMatch(match.usr2);
  process.send(aux.encJson({ act: "KILLME" }));
}

////////////////////////////////////
// MAIN FUNCTIONS //////////////////
////////////////////////////////////

function processTCP(reqPars) {

  // Get call parameters
  callPars = reqPars.in;

  if (callPars.ctx != "MATCH") {
    console.log("context error");
  }

  switch (callPars.act) {

    case "MDISCONNECT":
      disconnectFromMatch(reqPars.usr);
      break;

    default:
      match['cnt']++;
      break;

  }

}

// Match scan cycle
function game() {
  if (minit == true) {

    console.log('ingame: ' + match['cnt']);

    // End match
    if (match['cnt'] == 3) {
      endMatch();
      return;
    }

    // Stream to user 1
    if (users[match.usr1] != undefined) {
      som.sendTCP({
        socket: som.resolveSocket(match.usr1, users, sockets),
        out: { ctx: 'MATCH', act: 'STREAM', data: { data1: 'ghfjh', data2: 'hfd' } }
      });
    }

    // Stream to user 2
    if (users[match.usr2] != undefined) {
      som.sendTCP({
        socket: som.resolveSocket(match.usr2, users, sockets),
        out: { ctx: 'MATCH', act: 'STREAM', data: { data1: 'ghfrrrr', data2: 'hfjjjd' } }
      });
    }

  }
}

itvl = setInterval(game, 1000);