
var db = require('./dbconn.js'); // Connect to database
var aux = require('./auxiliary.js');

var running = false;

////////////////////////////////////
// MAIN FUNCTIONS //////////////////
////////////////////////////////////

process.on('message', (m) => {

  var procPars = aux.decJson(m);

  switch (procPars.act) {

    case "HANDSHAKE":
      handShake(procPars);
      break;

    case "MCREATE":
      createMatch(procPars);
      break;

    case "MJOIN":
      joinMatch(procPars);
      break;

    case "MREM":
      removeFromMatch(procPars.usr, procPars.mid);
      break;

    case "MDROP":
      dropMatch(procPars.mid);
      break;

    case "UDROP":
      dropUser(procPars.usr);
      break;

    default:
      console.log('ReqManager: no action');
      break;

  }

});

function handShake(procPars){
  
  db.updateData('Users/' + procPars.usr, {
    usr: procPars.usr,
    sid: procPars.sid,
    time: Date.now()
  });
  
  process.send(aux.encJson(procPars));
  
}

function createMatch(procPars) {

  // Create match id
  var mid = db.push('Matches');
  mid = mid.substr(mid.length - 6);
  mid = mid.toUpperCase();
  db.updateData('Matches/' + mid + '/users/' + procPars.usr, {
     uid: procPars.usr,
     away: false,
     host: true
  });
  
  // Bind match id to user 
  db.updateData('Users/' + procPars.usr, {
     mid: mid
  });
  
  // Send match create request to core
  process.send(aux.encJson({
    act: "MCREATE",
    sts: 0,
    usr: procPars.usr,
    una: procPars.una,
    mid: mid
  }));

}

function joinMatch(procPars) {
 
  db.getSnapshot('Matches/' + procPars.mid, function (snapshot) {

    if (snapshot.exists()){
      
      // Add user to match
      db.updateData('Matches/' + procPars.mid + '/users/' + procPars.usr, {
        uid: procPars.usr,
        away: false
      });

      // Bind match id to user 
      db.updateData('Users/' + procPars.usr, {
        mid: procPars.mid
      });

      // Send match join request to core
      process.send(aux.encJson({
        act: "MJOIN",
        usr: procPars.usr,
        una: procPars.una,
        mid: procPars.mid
      }));
      
    }else{
      
      removeFromMatch(procPars.usr, procPars.mid);
      
    }

  });

}

function removeFromMatch(usr, mid) {

    db.getSnapshot('Matches/' + mid, function (snapshot) {

      if (snapshot.exists()){
        
        // Remove user from match
        db.updateData('Matches/' + mid + '/users/' + usr, {
          away: true
        });
  
        // Delete match id from user
        db.deleteData('Users/' + usr + '/mid');
        
      }

  });

  // Notify core
  process.send(aux.encJson({
    act: "MREM",
    usr: usr,
    mid: mid
  }));
  
}

function dropUser(usr) {
  
  // Delete user in DB
  db.deleteData('Users/' + usr);
  
}

function dropMatch(mid) {
  db.deleteData('Matches/' + mid);
  console.log('Core: match ' + mid + ' closed');
}
