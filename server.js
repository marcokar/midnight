
// Modules
const aux = require('./auxiliary.js');
const som = require('./sockmanager.js');
const server = require('http').createServer(serverHandler);
const io = require("socket.io").listen(server);

// Child processes
console.log( process.env.PATH );
const reqManager = require('child_process').fork('./reqmanager.js', [], {cwd: root});  //, [], {execArgv: ['--debug=5859']}
const matchManager = require('child_process').fork('./matchmanager.js', [], {execArgv: ['--debug=5890']});

// Global data
const version = "0.32";
var sockets = new Object();
var users = new Object();

////////////////////////////////////
// KILL CHILDREN ON EXIT ///////////
////////////////////////////////////

process.on('exit', function () {
  console.log('killing child processes');
  reqManager.kill();
  matchManager.kill();
});

var cleanExit = function () { process.exit() };
process.on('SIGINT', cleanExit); // catch ctrl-c
process.on('SIGTERM', cleanExit); // catch kill

////////////////////////////////////
// SERVER WEBSOCKET RECEIVER ///////
////////////////////////////////////

// Connect to server
server.listen(process.env.PORT || 8080 , process.env.IP); 

// Handle HTTP connection
function serverHandler(request, response){
  	var headers = {'Content-Type': 'text/html'};
		response.writeHead(200, headers);
    response.end('Running');
}

// Handle socket connection
io.sockets.on('connection', function(socket){

  // Check if socket is valid
  if (socket == undefined) { return; }

  // Create socket
  var sid = som.createSocket(socket, sockets, processTCP, onSocketClosed);

  // Notify client of succesful connection
  if (sid != undefined) {
    console.log('Core: socket ' + sid + ' connected');
    som.sendTCP({
      socket: socket,
      out: { ctx: 'LOBBY', act: 'CONNECTION', sts: 1, sid: sid }
    });
  }

});

////////////////////////////////////
// TCP RECEIVER /////////////////
////////////////////////////////////

function processTCP(sockData) {

  // Check call parameters
  var callPars = sockData.in;
  if (callPars == undefined) { return; }
  if (sockData.sid != undefined) { callPars.sid = sockData.sid; }     
  if (sockData.usr != undefined) { callPars.usr = sockData.usr; }   
  
  // Select action
  switch (callPars.act) {

    case "HANDSHAKE":
      
      // Check request consistency
      if (callPars.ver == version && callPars.una != "" && callPars.usr != "") { 
        
        // Bind socket to user
        if (som.bindUser(sockData, callPars, users) == true) {
          
          console.log('Core: user ' + callPars.usr + ' bound to socket ' + sockData.sid);
          
          // Unbind any previous mid from user
          if (users[callPars.usr] != undefined) {
            delete users[callPars.usr]['mid'];
          } 
          
          // Send request to reqManager
          reqManager.send(aux.encJson(callPars));
          
        }        
        
      }
      
      break;

    case "MCREATE":
      
      if (users[callPars.usr] != undefined) { 
        callPars.una = users[callPars.usr].una;
        reqManager.send(aux.encJson(callPars));
      }
      
      break;
      
    case "MJOIN":
      
      if (users[callPars.usr] != undefined) { 
        if (callPars.mid != "") { 
          callPars.una = users[callPars.usr]['una'];
          reqManager.send(aux.encJson(callPars));
        }
      }
      
      break;
      
    case "MREM":
      
      if (users[callPars.usr] != undefined) { 
        callPars.mid = users[callPars.usr].mid;
        if (callPars.mid != undefined){
          reqManager.send(aux.encJson(callPars));  
        }
      }
      
      break;
      
    case "MACT":
      
      if (users[callPars.usr] != undefined) { 
        matchManager.send(aux.encJson(callPars));
      }
      
      break;
      
    case "MIMG":
      
      if (users[callPars.usr] != undefined) { 
        matchManager.send(aux.encJson(callPars));        
      }

      break;

    default:
    
      sockData = { out: { ctx: 'LOBBY', act: 'UNKNOWN', sts: 0 } };
      som.sendTCP(sockData);
      
      break;

  }

}

////////////////////////////////////
// REQUEST MANAGER /////////////////
////////////////////////////////////

// Listen for reqManager messages
reqManager.on('message', (m) => {

  var procPars = aux.decJson(m); // Decode request POST data
  var sts = getUserStatus(procPars.usr);
    
  switch (procPars.act) {

    case "HANDSHAKE":
      // Notify user
      som.sendTCP({
        socket: som.resolveSocket(procPars.usr, users, sockets),
        out: { ctx: 'LOBBY', act: 'HANDSHAKE', usr: procPars.usr, sts: sts }
      });
      break;

    case "MCREATE":
      // Create match
      createMatch(procPars);
      break;

    case "MJOIN":
      // Join match
      joinMatch(procPars);
      break;

    case "MREM":
      // Remove from match
      removeFromMatch(procPars);
      break;

    default:
      console.log('Core: no action');
      break;

  }

});

////////////////////////////////////
// MATCH MANAGER ///////////////////
////////////////////////////////////

matchManager.on('message', (m, socket) => {

    var procPars = aux.decJson(m);
    
    switch (procPars.act) {

      case "STREAM":
        // Notify users
        for (var usr in procPars.mus) {
          if (!procPars.mus[usr]['away']){
            som.sendTCP({
              socket: som.resolveSocket(usr, users, sockets),
              out: procPars
            });
          }
        }
        break;
        
      case "MCREATE":
        console.log('Core: user ' + procPars.usr + ' created match ' + procPars.mid);   
        som.sendTCP({
          socket: som.resolveSocket(procPars.usr, users, sockets),
          out: { ctx: 'LOBBY', act: 'MCREATE', sts: getUserStatus(procPars.usr), msts: 1, mid: procPars.mid }
        });
        break;
        
      case "MJOIN":
        console.log('Core: user ' + procPars.usr + ' joined match ' + procPars.mid);
        som.sendTCP({
          socket: som.resolveSocket(procPars.usr, users, sockets),
          out: { ctx: 'LOBBY', act: 'MJOIN', sts: getUserStatus(procPars.usr), msts: 1, mid: procPars.mid }
        });
        break;
        
      case "MREM":
        
        // Unbind mid from user
        if (users[procPars.usr] != undefined) {
          delete users[procPars.usr]['mid'];
        } 
        
        console.log('Core: user ' + procPars.usr + ' removed from match ' + procPars.mid);
        
        som.sendTCP({
          socket: som.resolveSocket(procPars.usr, users, sockets),
          out: { ctx: 'LOBBY', act: 'MREM', sts: getUserStatus(procPars.usr), msts: 0, mid: procPars.mid }
        });
        
        break;

      case "MEND":
        
        // Notify users
        for (var usr in procPars.mus) {
          if (!procPars.mus[usr]['away']){
            som.sendTCP({
              socket: som.resolveSocket(usr, users, sockets),
              out:  { ctx: 'MATCH', mid: procPars.mid, act: 'MEND' }
            });
          }
        }
        
        // Close match
        closeMatch(procPars.mid);
        
        break;

      case "MCLOSE":
        reqManager.send(aux.encJson({ act: "MDROP", mid: procPars.mid }));
        break;

    }

  });

////////////////////////////////////
// MAIN FUNCTIONS //////////////////
////////////////////////////////////

function createMatch(procPars) {

  if (users[procPars.usr] != undefined) {
    if (users[procPars.usr]['mid'] == undefined) {
        
      // Bind mid to user
      users[procPars.usr]['mid'] = procPars.mid;
      
      // Create match
      matchManager.send(aux.encJson({ 
        act: "MCREATE", 
        mid: procPars.mid,
        usr: procPars.usr,
        una: procPars.una
      }));
      
    } 
  }
  
}

function joinMatch(procPars){
  
  if (users[procPars.usr] != undefined) {
    if (users[procPars.usr]['mid'] == undefined) {
      
      // Bind mid to user
      users[procPars.usr]['mid'] = procPars.mid;
    
      // Join match
      matchManager.send(aux.encJson({ 
        act: "MJOIN", 
        mid: procPars.mid,
        usr: procPars.usr,
        una: procPars.una
      }));
      
    }else{
      removeFromMatch(procPars);
    }
  }

}

function removeFromMatch(procPars){
        
  // Leave match
  matchManager.send(aux.encJson({ 
    act: "MREM", 
    mid: procPars.mid,
    usr: procPars.usr
  }));
  
}  

function closeMatch(mid){
  
  // Close match in match manager
  matchManager.send(aux.encJson({ act: "MCLOSE", mid: mid }));
  
}



function onSocketClosed(sockData){
  if (sockData != undefined) {
    console.log('Core: socket closed ' + sockData.sid);
    if (users[sockData.usr] != undefined) {
      if (users[sockData.usr].sid == sockData.sid){
        dropUser(sockData.usr); 
      }
    }
    delete sockets[sockData.sid];
  }
}

function dropUser(usr){
  
  // Remove user from match
  var mid = users[usr].mid;
  if (mid != undefined){
    reqManager.send(aux.encJson({act: "MREM", usr: usr, mid: mid }));
  }
  
  // Drop user from DB
  reqManager.send(aux.encJson({ act: "UDROP", usr: usr }));
  
  // Unbind socket
  var sid = som.unbindUser(usr, users);
  console.log('Core: user ' + usr + ' unbound from socket ' + sid);
  
}  

function getUserStatus(usr){
  if (users[usr] == undefined){
    return 1;
  } else if (users[usr]['mid'] == undefined){
    return 2;
  }else{
    return 3;
  }
}
