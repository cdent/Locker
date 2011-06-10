/*
*
* Copyright (C) 2011, The Locker Project
* All rights reserved.
*
* Please see the LICENSE file for more information.
*
*/

/*
* 
* This module wraps all authentication functionality with the Google Contacts API
*/

var fs = require("fs");
var scope = 'https://www.google.com/m8/feeds/'; //contacts

var uri, completedCallback = null;

exports.auth = {};

// Check if exports.auth contains the required properties (clientID, clientSecret, and token)
// if not, read it from disk and try again
function isAuthed() {
    try {
        if(!exports.hasOwnProperty("auth"))
            exports.auth = {};
        
        // Already have the stuff read
        if(exports.auth.hasOwnProperty("clientID") && 
           exports.auth.hasOwnProperty("clientSecret") && 
           exports.auth.hasOwnProperty("redirectURI") &&
           exports.auth.hasOwnProperty("token")) {
            return true;
        }
        // Try and read it in
        var authData = JSON.parse(fs.readFileSync("auth.json"));
        console.error('authData:', authData);
        if(authData.hasOwnProperty("clientID") && 
           authData.hasOwnProperty("clientSecret") && 
           authData.hasOwnProperty("redirectURI") &&
           authData.hasOwnProperty("token")) {
            exports.auth = authData;
            console.error('ret true');
            return true;
        }
    } catch (E) {
        // TODO:  Could actually check the error type here
    }
    return false;
}

exports.isAuthed = isAuthed;

// The required exported function
// Checks if there is a valid auth, callback immediately (and synchronously) if there is
// If there isn't, adds /auth and /saveAuth endpoint to the app
exports.authAndRun = function(app, onCompletedCallback) {
    if (isAuthed()) {
        onCompletedCallback();
        return;
    }
    
    // not auth'd yet, save the app's uri and the function to call back to later
    uri = app.meData.uri;
    completedCallback = onCompletedCallback;
    app.get("/auth", handleAuth);
    app.get("/saveAuth", saveAuth);
}

// Handles requests to the /auth endpoint
// This will be called 3 times:
// 1. To captue the consumerKey and consumerSecret via a form (which posts to /saveAuth)
// 2. Uses the consumerKey and consumerSecret to contruct the twitter url to redirect to
// 3. Capture the access token when the person returns from twitter
function handleAuth(req, res) {
    if(!exports.auth)
        exports.auth = {};
    
    if(!(exports.auth.hasOwnProperty("clientID") && 
         exports.auth.hasOwnProperty("clientSecret") &&
         exports.auth.hasOwnProperty("redirectURI"))) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end("<html>Enter your personal Google app info that will be used to sync your data" + 
                " (create a new one <a href='https://code.google.com/apis/console/' target='_blank'>here</a> " +
                "using the callback url of http://"+uri+"auth. It's a bit finicky, but just type in a callback url, and " +
                "let it change it, then hit \"Edit Settings...\" and fix it.) " +
                "<form method='get' action='saveAuth'>" +
                    "Client ID: <input name='clientID'><br>" +
                    "Client Secret: <input name='clientSecret'><br>" +
                    "<input type='submit' value='Save'>" +
                "</form></html>");
    } else if(!exports.auth.token) {
        require('gdata-js')(exports.auth.clientID, exports.auth.clientSecret, exports.auth.redirectURI)
            .getAccessToken(scope, req, res, function(err, tkn) {
                if(err) {
                    console.error('oh noes!', err);
                    res.writeHead(500);
                    res.end('error: ' + JSON.stringify(err));
                } else {
                    exports.auth.token = tkn;
                    fs.writeFileSync('auth.json', JSON.stringify(exports.auth));
                    completedCallback();
                    res.redirect(uri);
                }
            });    
    } else { 
        completedCallback();
    }
}

// Save the consumerKey and consumerSecret
function saveAuth(req, res) {
    if(!req.param('clientID') || !req.param('clientSecret')) {
        res.writeHead(400);
        res.end("missing field(s)?");
    } else {
        // res.writeHead(200, {'Content-Type': 'text/html'});
        exports.auth.clientID = req.param('clientID');
        exports.auth.clientSecret = req.param('clientSecret');
        exports.auth.redirectURI = uri + 'auth'
        res.redirect(uri + 'auth');
        // res.end("<html>thanks, now we need to <a href='./auth'>auth that app to your account</a>.</html>");
    }
}

