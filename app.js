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

var pendingRequests = {};

var serverData;
var serverList = "";
var serverStatusLink = "http://104.210.114.199:6003/?p=ecuador&m=servers";

var ircBot = new IRC.Client("irc.web.gamesurge.net", "BookerBot", 
{
    sasl: true,
    userName: 'smesbot',
    realName: 'Booker Dewitt',
    autoConnect: false
});

// Connect to the #ozf-help server and authenticate
ircBot.connect(5, function () {
    
    console.log("IRC Bot connected to GameSurge.");
    
    ircBot.join("#ozf-help", function () {
        
        console.log("IRC Bot connected to #ozf-help.\n");
        ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "auth smesbot ihopeidontforgetthispasswordinthefuture777");
        UpdateServerList();
    });
});

// NOTICE LISTENER
ircBot.addListener("notice", function (from, to, text, message) {
    
    var msg = text.split(" ");
    
    // Ignore notices from all other sources
    if (from !== "[iPGN-TF2]" || to !== "BookerBot")
        return;
    

    // Received server booking information (/book) --- Send Discord user server details
    // [iPGN-TF2] : � Details for server <serverNumber> (ozfortress): <serverDetails> �

    if (msg[1] === "Details" && msg[2] === "for") {
            
        UpdateServerList(function () { 
            var serverNumber = msg[4];
            var user = FindWhoBookedServer(serverNumber);
            var serverDetails = msg.slice(6, 12).join(" ");
            
            discordBot.sendMessage(user, "\nYour booking details for Server " + serverNumber + ":\n\n```" + serverDetails + "```\n");
            pendingRequests[user] = "";
        });
    }
    

    // Received demo booking information (/demos) --- Send Discord user demo details
    // [iPGN-TF2] :  � Demos for <target> are available at <downloadLink> �

    if (msg[1] === "Demos" && msg[2] === "for") {
        var target = msg[3];
        var downloadLink = msg[7];
        var user = "";
        
        //Check which users have a pending demo request for <target>
        for (var key in pendingRequests) {
            if (pendingRequests[key] === target) {
                user = key;
            }
        }
        
        discordBot.sendMessage(user, "Demos for " + target + " are available at:\n" + downloadLink);
        pendingRequests[user] = "";
    }
    
    // Received server status information (/servers) --- Update server link and try again
    // [iPGN-TF2] :  � The status of all servers can be viewed at <latestLink> �

    if (msg[1] === "The" && msg[2] === "status") {
        var latestLink = msg[10];

        serverStatusLink = latestLink;
        UpdateServerList();
    }
    
});

ircBot.addListener("error", function (message) {
    console.log("[IRC ERROR] " + message.command);
});


// Find out who booked Server <number>, returns their Discord ID
function FindWhoBookedServer(number) {
   
    var server = serverData[number - 1];
    var user = discordID(server["Booker"]);

    return user;
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
            return;
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
            
            serverData = servers;

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
        
        // --------------- BOOK NEW SERVER --------------- //
                
        if (command[0] === "book") {

            console.log("[BOOK NEW SERVER] " + username + " | " + user);

            BookServer(username);
        }
        
        // --------------- UNBOOK SERVER --------------- //
        
        if (command[0] === "unbook" || command[0] === "return" || command[0] === "reset") {
            
            console.log("\n[UNBOOK SERVER] " + username + " | " + user);
            
            UnbookServer(username);
        }

        // --------------- REQUEST DEMOS --------------- //
        if (command[0] === "demos" || command[0] === "demo") {
            
            var target = (typeof command[1] !== "undefined") ? command[1] : username;
            
            console.log("\n[DEMO REQUEST for " + target + "] " + username + " | " + user);
            
            pendingRequests[user] = target;

            ircBot.say("#ozf-help", "!demos " + target);
        }
        
        // --------------- REQUEST SERVER LIST--------------- //
        if (command[0] === "servers" || command[0] === "status") {

            console.log("\n[SERVER LIST] " + username + " | " + user);
            
            UpdateServerList(function (data) {
                
                discordBot.reply(message, data);
            });
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
       
        
        // --------------- LOGIN MANAGEMENT --------------- //
        if (command[0] === "emailnewcookie") {
            ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "authcookie smesbot");
        }
        
        if (command[0] === "loginirc") {
            ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "auth " + command[1] + " " + command[2]);
            setTimeout(UpdateServerList(), 2000);
        }
    }
});

//discordBot.loginWithToken("MTgxNzUyMDgwODU4MzQ5NTY4.ChuTeA.NYXl89bZsRJZBlzK1dcmLzQfgqI");
discordBot.loginWithToken("MTg0NTkwMzU2MDA2OTYxMTUz.CiWoqg.sGy6j_7fUVgeIEETGVw9NHbPe-A");


function discordID(username) {
    var user = discordBot.users.get("username", username);
    
    return user.id;
}

function BookServer(username) {
    var user = discordID(username);
    
    // Get latest version of server list
    UpdateServerList(function () {
        
        // Make sure user hasn't already booked a server
        for (var i = 0; i < serverData.length; i++) {
            var server = serverData[i];
            
            if (server["Booker"] === username) {
                console.log("(Failed) " + username + " has already booked a server.");
                discordBot.sendMessage(user, "You already have an ongoing server booking.");
                return;
            }
        }
        
        // Prevent double booking if user inputs command multiple times
        if (pendingRequests[user] === "booking") {
            console.log("(Failed) " + username + " already has a booking in progress.");
            discordBot.sendMessage(user, "Your booking is already in progress. Details will be PM'd to you.");
            return;
        }

        pendingRequests[user] = "booking";
        ircBot.say("#ozf-help", "!book 3 " + username);
 
    });
}

function UnbookServer(username) {
    var user = discordID(username);
    
    UpdateServerList(function () { 

        for (var i = 0; i < serverData.length; i++) {
            var server = serverData[i];
        
            if (server["Booker"] === username) {
                ircBot.say("#ozf-help", "!reset " + server["Server"]);
                discordBot.sendMessage(user, "You have successfully unbooked Server " + server["Server"] + ".");
                return;
            }
        }
        console.log("(Failed) Could not find a server booked under " + username + ".");
        discordBot.sendMessage(user, "Could not find a booking under your username (" + username + ").");
    });
}




discordBot.on("ready", function () {
    console.log("Discord Bot connected to server.");
    discordBot.setPlayingGame("catch with Elizabeth!");
});

process.on("SIGINT", function () {
    discordBot.logout();
    ircBot.disconnect()
    process.exit();
});

process.on("exit", function () {
    discordBot.logout();
    ircBot.disconnect()
    process.exit();
});