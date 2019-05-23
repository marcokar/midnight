
var aux = require('./auxiliary.js');
var http = require('http');
var matches = new Object();
var gameTick = 500;
var qnum = 0;

process.on('message', (m, socket) => {
  var procPars = aux.decJson(m); // Decode request POST data
  var mid = procPars.mid;
  switch (procPars.act) {

    case "MCREATE":
      
      // Initialize match structure
      matches[mid] = new Object();
      buildMatch(mid);
      
      // Add user
      addUser(mid, procPars, true);

      // Notify Core
      process.send(aux.encJson({
        act: 'MCREATE',
        mid: mid,
        usr: procPars.usr
      }));
      
      break;

    case "MJOIN":
      
      // No match with this id
      if (matches[mid] != undefined) { 
        
        // Add user
        addUser(mid, procPars, false);
        
        // Notify Core
        process.send(aux.encJson({
          act: 'MJOIN',
          mid: mid,
          usr: procPars.usr
        }));
        
      }else{
                
        // Notify Core
        process.send(aux.encJson({
          act: 'MREM',
          mid: procPars.mid,
          usr: procPars.usr
        }));
        
      }
      
     break;

    case "MREM":
      
      // Set away flag for user
      if (matches[procPars.mid] != undefined){
        matches[procPars.mid]['users'][procPars.usr]['away'] = true;
        matches[procPars.mid]['users'][procPars.usr]['awtim'] = Date.now();
      }
      
      // Notify Core
      process.send(aux.encJson({
        act: 'MREM',
        mid: procPars.mid,
        usr: procPars.usr
      }));
      
      break;

    case "MCLOSE":
      
      // Close match
      closeMatch(mid);
      
      // Notify Core
      process.send(aux.encJson({
        act: 'MCLOSE',
        mid: mid
      }));
      
      break;

    case "MIMG":
      imgLoad(procPars);
      break;

    case "MACT":
      makeMove(procPars);
      break;

  }

});

////////////////////////////////////
// MAIN FUNCTIONS //////////////////
////////////////////////////////////

function imgLoad(procPars){
  
  if (matches[procPars.mid] != undefined){
    var match = matches[procPars.mid];
    if (match['users'][procPars.usr] != undefined) {
      if(match['status'] == 3){
        
        switch (procPars.sub) {
        
          case 'OK':
            matches[procPars.mid]['qimgok']++;
            break;
          
          case 'ERR':
            matches[procPars.mid]['qimgerr']++;
            break;
        
        }
        
      }
    }
  }
  
}

function makeMove(procPars){
  
  if (matches[procPars.mid] != undefined){
    var match = matches[procPars.mid];
    if (match['users'][procPars.usr] != undefined){
      
      switch (procPars.sub) {
        
        case 'ENT':
          if (match['users'][procPars.usr]['host']){
            if (match['status'] == 2 && match['cnt'] <= 0) {
              matches[procPars.mid]['status'] = 3;
            }
            if (match['status'] == 7 && match['cnt'] <= 0) {
              matches[procPars.mid]['status'] = 3;
            }
            if (match['status'] == 8 && match['cnt'] <= 0) {
              console.log('Match restarted');
              matches[procPars.mid]['status'] = 1;
            }
          }
          break;
          
        case 'ANS':
          var ans = matches[procPars.mid]['users'][procPars.usr]['ans'];
          var atim = matches[procPars.mid]['cnt'];
          if (match['status'] == 4 && ans == 0){
            matches[procPars.mid]['users'][procPars.usr]['ans'] = procPars.val; 
            matches[procPars.mid]['users'][procPars.usr]['atim'] = atim; 
            matches[procPars.mid]['anss']++;
          }
          break;
        
      }
      
    }
  }

}

function game(mid) {

  // Match not valid
  if (matches[mid] == undefined) { return; }
  
  // Get data
  var errorTxt = "";
  var actUsr = 0;
  var awayDel = 0;
  var mbusy = matches[mid]['busy'];
  var mcnt = matches[mid]['cnt'];
  var msts = matches[mid]['status'];
  
  // Get active users
  for (var usr in matches[mid]['users']){
    awayDel = Date.now() - matches[mid]['users'][usr]['awtim'];
    if (!matches[mid]['users'][usr]['away'] || awayDel < 8000){
      actUsr++;
    }
  }
  
  // Decrease time
  if (mcnt > 0){
    mcnt -= gameTick;
  }

  switch (msts){
    
    case 1: 
      // Clear match variables and create roster
      if (!mbusy){
        clearMatch(mid);
        getQuestionsNum(mid);
      }
      break;
      
    case 2: 
      // Show match info, wait for start signal
      break;
      
    case 3: 
      // Retrieve question
      if (matches[mid]['pendquest'].hasOwnProperty('qtxt')){
        // Check if question has image
        if (matches[mid]['pendquest']['qimg'] != ""){
          // Send image url to clients
          if (matches[mid]['question']['qimg'] == undefined){
            mcnt = 8000;
            matches[mid]['question']['qimg'] = matches[mid]['pendquest']['qimg'];
          } 
          // Wait until all clients have downloaded it
          if (matches[mid]['qimgok'] >= actUsr){
            matches[mid]['status'] = 4;
          } else if (mcnt <= 0 || matches[mid]['qimgerr'] > 0 ){
            errorTxt = 'Error loading ' + matches[mid]['question']['qimg'];
            matches[mid]['status'] = 6;
          }
        }else{
          matches[mid]['status'] = 4;
        }
      }else{
        if (!mbusy){ 
          mcnt = 4000;
          getQuestion(mid); 
        } else if (mcnt <= 0) {
          errorTxt = 'Error retrieving question';
          matches[mid]['status'] = 6;
        }
      }
      break;
      
    case 4: 
      // On entry scan
      if (msts != matches[mid]['lstat']){
        // Set delay
        mcnt = matches[mid]['pendquest']['qtim'];
        // Show question without correct answer key
        matches[mid]['question'] = JSON.parse(JSON.stringify(matches[mid]['pendquest']));
        matches[mid]['question']['qkey'] = "";
      }
      // Wait for answers
      if (mcnt <= 0 || matches[mid]['anss'] >= actUsr){
        matches[mid]['status'] = 5;
      }
      break;
      
    case 5: 
      // On entry scan
      if (msts != matches[mid]['lstat']){
        // Set delay
        mcnt = 1500;
        // Calculate scores
        calcScores(mid);
        // Show question with correct answer key
        matches[mid]['question']['qkey'] = matches[mid]['pendquest']['qkey'];
      }
      // Wait delay
      if (mcnt <= 0){
        matches[mid]['status'] = 6;
      }
      break;
      
    case 6: 
      // Check match
      mcnt = 0;
      clearQuestion(mid);
      if (matches[mid]['roster'].length > 0){
        matches[mid]['status'] = 7;
      } else {
        matches[mid]['status'] = 8;
      }   
      break;
      
    case 7: 
      // Show scoreboard
      break;
      
    case 8: 
      // Match winner
      break;
      
  }

  if (msts != matches[mid]['lstat'] || actUsr != matches[mid]['actusr'] || errorTxt != ""){
    // Match log
    console.log('Match ' + mid + ': Stage ' + msts + ', users ' + actUsr + '. ' + errorTxt);
  }

  // Save data
  matches[mid]['cnt'] = mcnt;
  matches[mid]['actusr'] = actUsr;
  matches[mid]['lstat'] = msts;

  // Match alive
  if (actUsr > 0){
    
    // Preset death timeout
    matches[mid]['tout'] = 60000; 
    
    // Game data to client
    process.send(aux.encJson({ 
      ctx: 'MATCH', 
      act: 'STREAM', 
      mid: mid, 
      msts: msts, 
      mtim: (msts == 4) ? mcnt : 0, 
      qnum: matches[mid]['roster'].length, 
      ausr: matches[mid]['actusr'], 
      mus: matches[mid]['users'], 
      qst: matches[mid]['question']
    }));
    
  }else{
    
    // Death timeout
    matches[mid]['tout'] -= gameTick;
    if (matches[mid]['tout'] <= 0){
      endMatch(mid);
    }
    
  }
  
}

////////////////////////////////////
// AUX FUNCTIONS //////////////////
////////////////////////////////////

function calcScores(mid){
  
  var users = matches[mid]['users'];
  var qtim = matches[mid]['question']['qtim'];
  var qkey = matches[mid]['pendquest']['qkey'];
  var qsco = parseInt(matches[mid]['question']['qsco'], 10); 
  var usco = 0;
  var corr = 0;
  
  // Check for correct answers
  for (var usr in users){
    if (users[usr]['ans'] == qkey){
      usco = Math.round(Math.pow(users[usr]['atim']/qtim, 2) * qsco);
      matches[mid]['users'][usr]['qsco'] = usco; 
      corr++;
    }else{
      matches[mid]['users'][usr]['qsco'] = 0; 
    }
  }
  
  // Apply single correct answer bonus
  if (corr == 1 && matches[mid]['actusr'] > 2){
    for (var usr in users){
      if (users[usr]['qsco'] == 0){
        matches[mid]['users'][usr]['qsco'] = -usco;
      }else{
        matches[mid]['users'][usr]['qsco'] = 2 * usco;
      }       
    }
  }

  // Update scores
  for (var usr in users){
    matches[mid]['users'][usr]['score'] += users[usr]['qsco'];
    if (matches[mid]['users'][usr]['score'] < 0){
      matches[mid]['users'][usr]['score']  = 0;
    }
  }
  
}

function getQuestion(mid){
  
  // Set the busy flag
  matches[mid]['busy'] = true;

  // Retrieve question options
  var qid = matches[mid]['roster'].pop();
  var options = {
    host: 'quizmachine.altervista.org',
    port: 80,
    path: '/qma/engine.php?qid=' + qid
  };
  
  // Retrieve question
  http.get(options, function(res) {
    var body = "";
    res.on('data', function (chunk) {
      body = body + chunk;
    });
    res.on('end', function() {
      matches[mid]['pendquest'] = parseQuestion(mid, body);
      matches[mid]['busy'] = false;
    });
    res.on('error', function(e) {
      console.log("Got error: " + e.message);
    });
  });
  
}

function parseQuestion(mid, qdata){
  
  var arr = qdata.split("|~|");
  var question = new Object();
  
  question['qtxt'] = arr[0];
  question['qsco'] = arr[14];
  question['qimg'] = arr[11];
  question['qkey'] = arr[12];
  question['qtim'] = 60000;
 
  question['ans1'] = new Object();
    question['ans1']['atxt'] = arr[1];
    question['ans1']['akey'] = arr[2];
  question['ans2'] = new Object();
    question['ans2']['atxt'] = arr[3];
    question['ans2']['akey'] = arr[4];
  question['ans3'] = new Object();
    question['ans3']['atxt'] = arr[5];
    question['ans3']['akey'] = arr[6];
  question['ans4'] = new Object();
    question['ans4']['atxt'] = arr[7];
    question['ans4']['akey'] = arr[8];
  question['ans5'] = new Object();
    question['ans5']['atxt'] = arr[9];
    question['ans5']['akey'] =  arr[10];
    
  return question;
  
}

function clearQuestion(mid){
  
  matches[mid]['qimgok'] = 0;
  matches[mid]['qimgerr'] = 0;
  matches[mid]['anss'] = 0;
  matches[mid]['pendquest'] = new Object();
  matches[mid]['question'] = new Object();
  
  // Reset answered flags
  for (var usr in matches[mid]['users']){
    matches[mid]['users'][usr]['ans'] = 0; 
    matches[mid]['users'][usr]['atim'] = 0;
  }
  
}

function addUser(mid, procPars, host){
  
  if (matches[mid] == undefined) { return; }
  
  if (matches[mid]['users'][procPars.usr] == undefined){
    matches[mid]['users'][procPars.usr] = new Object();
      matches[mid]['users'][procPars.usr]['una'] = procPars.una;
      matches[mid]['users'][procPars.usr]['score'] = 0;
      matches[mid]['users'][procPars.usr]['qsco'] = 0;
      matches[mid]['users'][procPars.usr]['ans'] = 0;
      matches[mid]['users'][procPars.usr]['atim'] = 0;
      matches[mid]['users'][procPars.usr]['host'] = host;
      matches[mid]['users'][procPars.usr]['away'] = false;
      matches[mid]['users'][procPars.usr]['awtim'] = 0;
  }else{
    matches[mid]['users'][procPars.usr]['away'] = false;
  }

}

function buildMatch(mid){

  matches[mid]['busy'] = false;
  matches[mid]['status'] = 1;
  matches[mid]['lstat'] = 1;
  matches[mid]['cnt'] = 0;
  matches[mid]['tout'] = 0;
  matches[mid]['anss'] = 0;
  matches[mid]['actusr'] = 0;
  matches[mid]['qimgok'] = 0;
  matches[mid]['qimgerr'] = 0;
  matches[mid]['roster'] = new Array();
  matches[mid]['users'] = new Object();
  matches[mid]['pendquest'] = new Object();
  matches[mid]['question'] = new Object();
  matches[mid]['itvl'] = setInterval( function() { game(mid); }, gameTick);
  
}

function clearMatch(mid){

    matches[mid]['busy'] = false;
    matches[mid]['status'] = 1;
    matches[mid]['lstat'] = 1;
    matches[mid]['cnt'] = 0;
    matches[mid]['anss'] = 0;
    matches[mid]['actusr'] = 0;
    matches[mid]['qimgok'] = 0;
    matches[mid]['qimgerr'] = 0;
    matches[mid]['roster'] = new Array();
    matches[mid]['pendquest'] = new Object();
    matches[mid]['question'] = new Object();
      
    for (var usr in matches[mid]['users']){
      matches[mid]['users'][usr]['score'] = 0;
      matches[mid]['users'][usr]['qsco'] = 0;
      matches[mid]['users'][usr]['ans'] = 0;
      matches[mid]['users'][usr]['atim'] = 0;
    }
  
}

function getQuestionsNum(mid){
  
  // Set the busy flag
  matches[mid]['busy'] = true;
  
  var options = {
    host: 'quizmachine.altervista.org',
    port: 80,
    path: '/qma/engine.php'
  };
  
  http.get(options, function(res) {
    var body = "";
    res.on('data', function (chunk) {
      body = body + chunk;
    });
    res.on('end', function() {
      qnum = parseInt(body, 10);
      matches[mid]['roster'] = createRoster(qnum);
      matches[mid]['busy'] = false;
      matches[mid]['status'] = 2;
    });
    res.on('error', function(e) {
      console.log("Got error: " + e.message);
    });
  });
  
}

function createRoster(qnum){
  
  var roster = new Array();
  var n;
  var c;
  
  while (roster.length < 30){
    n = Math.floor(Math.random() * qnum);
    c = false;
    roster.forEach(function(item, index, array) {
      if (item == n) { c = true; }
    });
    if (!c){
      roster.push(n);
    }
  }

  return roster;
  
}

function endMatch(mid) {
  clearInterval(matches[mid].itvl);
  var procPars = {
    act: 'MEND',
    mid: mid,
    mus: matches[mid]['users']
  };
  process.send(aux.encJson(procPars));
}

function closeMatch(mid) {
  clearInterval(matches[mid]['itvl']);
  delete matches[mid];
}
