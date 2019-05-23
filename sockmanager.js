
var aux = require('./auxiliary.js');

exports.createSocket = function (socket, sockets, callback1, callback2) {
    try {

        // Socket identifier
        var sid = socket.id;

        // Initialize socket data
        var sockData = new Object();
        sockData['buffer'] = '';
        sockData['socket'] = socket;
        sockData['sid'] = sid;
        sockets[sid] = sockData;

        // Attach listeners
        socket.on('message', socketOn(sockets[sid], callback1));
        socket.on('disconnect', socketOff(sockets[sid], callback2));

        return sid;

    } catch (err) {
        console.log(err);
        return undefined;
    }
};

exports.bindUser = function (sockData, usrPars, users) {
    
    var userData = new Object();

    try {
        
        // Check for user existence
        if (users[usrPars.usr] != undefined) { 
            userData = users[usrPars.usr];
        }  
        
        // Bind socket to user
        userData['sid'] = sockData.sid;
        userData['una'] = usrPars.una;
        users[usrPars.usr] = userData;

        // Bind user to socket
        sockData['usr'] = usrPars.usr;

        // Socket bound to user succesfully
        return true;
 
    } catch (e) {
        
        console.log(e);
        return false;
        
    }
    
};

exports.unbindUser = function (usr, users) {
    var sid = users[usr].sid;
    delete users[usr];
    return sid;
};

exports.sendTCP = function (sockData) {

    // Check if socket is valid
    if (sockData.socket == undefined) { return; }

    // Send data
    try {
        sockData['outTime'] = new Date().getTime();
        sockData.socket.write(JSON.stringify(sockData.out) + '\n');
    } catch (err) {
        console.log(err);
    }

};

exports.resolveSocket = function (usr, users, sockets) {
    try {
        return sockets[users[usr].sid].socket;
    } catch (err) {
        console.log('Core: error resolving socket for user ' + usr);
        return undefined;
    }
};

function receiveTCP(sockData, data) {
    sockData['buffer'] += data.toString('utf8');
    var idx = sockData['buffer'].indexOf('\n');
    while (idx > -1) {  // While loop to keep going until no delimiter can be found        
        sockData['inTime'] = new Date().getTime();
        sockData['out'] = new Object();
        sockData['in'] = aux.decJson(sockData['buffer'].substring(0, idx)); // Parse the current string
        sockData['buffer'] = sockData['buffer'].substring(idx + 1); // Cuts off the processed chunk
        idx = sockData['buffer'].indexOf('\n'); // Find the new delimiter
    }
}

function socketOff(sockData, callback) {
    return function () {
        callback(sockData);
    };
}

function socketOn(sockData, callback) {
    return function (data) {
        receiveTCP(sockData, data);
        callback(sockData);
    };
}
