var Discord = require("discord.js");
var ParseServerList = require("./parse-server-list.js");
var IRC = require("irc");
var http = require("http");
var columnify = require("columnify");

"use strict";

console.log('\nBOOKERBOT ENGAGED --- OBJECTIVE: DESTROY ALL HUMANS\n');

// ------------------------------------------------------------------------- //
// IRC BOT
// This bot sits in the #ozf-help IRC channel waiting for messages from the
// Discord bot.

// The discordID {} keeps a record of Discord usernames to IDs

// The bookings {} contains information about a user's current booking state
// bookings[user] = "waiting"       - User has recently made a booking and it is still in progress
// bookings[user] = "server <i>"    - User has an active booking with server <i>
// bookings[user] = ""              - There are no active bookings under that user

var discordID = {};
var bookings = {};
var demoRequests = {};

var serverList = "";

var serverStatusLink = "http://104.210.114.199:6003/?p=ecuador&m=servers";

var ircBot = new IRC.Client("irc.web.gamesurge.net", "BookerBot", 
                             {
    sasl: true,
    userName: 'smesbot',
    password: 'BEcwjtmpmde7***',
    realName: 'Booker Dewitt',
    autoConnect: false
});

// Connect to the #ozf-help server and authenticate
ircBot.connect(5, function () {
    
    console.log("IRC Bot connected to GameSurge.");
    
    ircBot.join("#ozf-help", function () {
        
        console.log("IRC Bot connected to #ozf-help.\n");
        
        // PM AuthServ login details
        ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "auth smesbot BEcwjtmpmde7***");
        //discordBot.sendMessage(discordBot.channels.get("name", "testing"), "getting here 1");
        UpdateServerList();
        //discordBot.sendMessage(discordBot.channels.get("name", "testing"), "getting here 2");
        //ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "cookie smesbot");
    });
});

// Listen for messages from iPGN-TF2 to update bookings[user] with server number
ircBot.addListener("message", function (from, to, text, message) {
    var arr = text.split(" ", 11);
    
    // Ignore messages from all other sources
    if (from !== "[iPGN-TF2]" || to !== "#ozf-help") {
        return;
    }
    
    // Check valid array?
    if (arr.length < 11) {
        console.log("Something bad happened in 'message' listener.");
        return;
    }
    
    discordBot.sendMessage(discordBot.channels.get("name", "testing"), "got a notice irc " + from + " to " + to + " text: " + text);
        
    
    // iPGN-TF2 returns correct NEW BOOKING string (ignore non-smesbot)
    if (arr[6] === "booked" && arr[7] === "by" && arr[8] === "BookerBot") {
        
        var serverNumber = arr[2];
        var username = arr[10].substring(0, arr[10].length - 1); // Remove trailing fullstop
        
        var user = discordID[username]; // Convert username to numeric Discord ID
        
        bookings[user] = "server " + serverNumber;
        
        console.log("(Success) " + username + " has booked Server " + serverNumber + ".");
    }
});

ircBot.addListener("pm", function (from, text, message) { 
    discordBot.sendMessage(discordBot.channels.get("name", "testing"), "pm: " + text);

});

// Listen for notices from iPGN-TF2 that will have Server number and connect string
ircBot.addListener("notice", function (from, to, text, message) {
    
    var arr = text.split(" ");
    
    if (from === "[iPGN-TF2]" && to === "BookerBot") {
        discordBot.sendMessage(discordBot.channels.get("name", "testing"), "got a notice irc " + from + " to " + to + " text: " + text);
        
        if (arr[1] === "Your" && arr[2] === "hostmask") {
            discordBot.sendMessage(discordBot.channels.get("name", "testing"), "your fucking shit ASS HEROKU FUCK");
        }

        // Received server booking information
        if (arr[1] === "Details" && arr[2] === "for") {
            var serverNumber = arr[4];
            var user = FindWhoBookedServer(serverNumber);
            var serverDetails = arr.slice(6, 12).join(" ");
            
            discordBot.sendMessage(user, "\nYour booking details for Server " + serverNumber + ":\n\n```" + serverDetails + "```\n");
        }
        
        // Received demo booking information
        if (arr[1] === "Demos" && arr[2] === "for") {
            var target = arr[3];
            var user = "";
            
            if (target in demoRequests) {
                user = demoRequests[target].shift();
            }
            
            var demoDetails = arr[7];
            
            console.log("Notice for demos " + target + " requested by " + user);
            discordBot.sendMessage(user, "Demos for " + target + " are available at:\n" + demoDetails);
        }
        
        // Received server status information
        if (arr[1] === "The" && arr[2] === "status") {
            serverStatusLink = arr[10];
            UpdateServerList();
        }
    }
});

ircBot.addListener("error", function (message) {
    console.log("[IRC ERROR] " + message.command);
});

// Find out who booked Server <number>, returns their Discord ID
function FindWhoBookedServer(number) {
    for (user in bookings) {
        if (bookings[user] === ("server " + number)) {
            return user;
        }
    }
    console.log("*** [PROBLEM] user was not found in bookings[] dictionary. ***");
}

// Get the data from serverStatusLink (i.e. webpage) and parse it
function UpdateServerList(callback) {
    // Ensure callback parameter is optional
    if (typeof callback !== 'function') {
        callback = function (data) { };
    }
    // Parse the server statuses link. If successful will return an array with each server
    ParseServerList(serverStatusLink, function (servers) {
        // There was something wrong with the link
        if (servers === "error") {
            ircBot.say("#ozf-help", "!servers");
            console.log("Error with server link. Querying IRC channel for latest link.");
            callback("Error getting server details. Please try again.");
        }
        else {
            var columnVars = {
                columnSplitter: ' | ',
                config: {
                    columns: ['Server', 'Status', 'IP'],
                    Server: { minWidth: 6, align: 'center' },
                    Status: { minWidth: 10 }
                }
            };
            
            serverList = columnify(servers, columnVars);
            
            serverList = "```" + serverList + "```";
            
            callback(serverList);
        }
        
    });

}

// ------------------------------------------------------------------------- //
// DISCORD BOT
// This bot sits in the ozfortress Discord channel waiting for messages from
// the user (!book, !unbook, !help).

var discordBot = new Discord.Client();

discordBot.on("message", function (message) {
    
    var content = message.content;
    var user = message.author.id;           // Discord numeric ID (e.g. 12020045930)
    var username = message.author.username; // Discord user name (e.g. smeso)
    
    var prefix = content[0];
    var command = content.substring(1, content.length).split(" ");
    
    if (prefix === "!" || prefix === "/") {
        
        // Check if the user has ever booked a server before
        if (!bookings.hasOwnProperty(user)) {
            console.log(user + " hasn't booked a server before. Adding to database.");
            bookings[user] = "";
        }
        
        // --------------- BOOK NEW SERVER --------------- //
        if (command[0] === "book") {
            
            console.log("\n[BOOK NEW SERVER] " + username + " | " + user);
            
            // Check is user has already booked OR has booking in progress
            if (user in bookings) {
                var userStatus = bookings[user].split(" ");
                
                if (userStatus[0] === "waiting") {
                    console.log("(Failed) " + username + " already has a booking in progress.");
                    discordBot.sendMessage(user, "Your booking is already in progress.");
                    return;
                }
                if (userStatus[0] === "server") {
                    console.log("(Failed) " + username + " has already booked Server " + userStatus[1] + ".");
                    discordBot.sendMessage(user, "You have already booked Server " + userStatus[1] + ".");
                    return;
                }
            }
            
            // The user doesn't have a previous booking
            bookings[user] = "waiting ";
            discordID[username] = user;
            
            // Send booking request to IRC
            ircBot.say("#ozf-help", "!book 3 " + username);
        }
        
        // --------------- UNBOOK SERVER --------------- //
        if (command[0] === "unbook" || command[0] === "return" || command[0] === "reset") {
            
            console.log("\n[UNBOOK SERVER] " + username + " | " + user);
            
            // Check if user in in database (i.e. has booked a server)
            if (user in bookings) {
                var userStatus = bookings[user].split(" ");
                
                if (userStatus[0] === "waiting") {
                    console.log("(Failed) " + username + " still has a pending booking.");
                    discordBot.sendMessage(user, "Please wait for booking to finish first.");
                }
                if (userStatus[0] === "server") {
                    console.log("(Success) " + username + " unbooked Server " + userStatus[1] + ".");
                    discordBot.sendMessage(user, "Your booking for Server " + userStatus[1] + " has been reset.");
                    ircBot.say("#ozf-help", "!reset " + userStatus[1]);
                    bookings[user] = "";
                }
                if (userStatus[0] === "") {
                    console.log("(Failed) " + username + " hasn't booked a server yet.");
                    discordBot.sendMessage(user, "You haven't booked a server!");
                }
            }
        }
        
        // --------------- USAGE HELP --------------- //
        if (command[0] === "help") {
            console.log("\n[HELP] " + username + " | " + user);
            
            discordBot.reply(message, "```       Discord Server Booker Usage\n" +
                                         "-----------------------------------------\n" + 
                                         "/book          -  Book a new server\n" +
                                         "/unbook        -  Return a server\n" + 
                                         "/demos <user>  -  Get STV demo link (user optional)\n" +
                                         "/servers       -  List the status of all servers\n" +
                                         "/help          -  You get this, ya dingus!\n\n" +
                                         "Whoever made this sure is a cool dude..!```");
        }
        
        // --------------- REQUEST DEMOS --------------- //
        if (command[0] === "demos" || command[0] === "demo") {
            var target = username;
            
            if (typeof command[1] !== "undefined") {
                target = command[1];
            }
            
            console.log("\n[DEMO REQUEST for " + target + "] " + username + " | " + user);
            
            ircBot.say("#ozf-help", "!demos " + target);
            
            if (typeof demoRequests[target] === "undefined")
                demoRequests[target] = [];
            
            demoRequests[target].push(user);
        }
        
        // --------------- REQUEST SERVER LIST--------------- //
        if (command[0] === "servers" || command[0] === "status") {
            console.log("\n[SERVER LIST] " + username + " | " + user);
            
            //ircBot.say("#ozf-help", "!servers");
            UpdateServerList(function (data) {
                console.log("Broadcasting server list to <testing> channel.");
                discordBot.sendMessage(discordBot.channels.get("name", "testing"), data);
            });
        }
        
        if (command[0] === "cookie") {
            ircBot.say("ozf-help", "cookie me you stupid fuck");
        }
        if (command[0] === "cookie2") {
            ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "cookie smesbot");
        }

        // --------------- WHATEVER MINGER --------------- //
        if (command[0] === "thanks") {
            discordBot.sendMessage(user, "<3");
            discordBot.setPlayingGame("catch with Elizabeth");
        }
    }
});

//discordBot.loginWithToken("MTgxNzUyMDgwODU4MzQ5NTY4.ChuTeA.NYXl89bZsRJZBlzK1dcmLzQfgqI");
discordBot.loginWithToken("MTg0NTkwMzU2MDA2OTYxMTUz.CiWoqg.sGy6j_7fUVgeIEETGVw9NHbPe-A");

discordBot.on("ready", function () {
    console.log("Discord Bot connected to server.");
    discordBot.setPlayingGame("catch with Elizabeth");
});

process.on("SIGINT", function () {
    discordBot.logout();
    ircBot.disconnect()
    process.exit();
});