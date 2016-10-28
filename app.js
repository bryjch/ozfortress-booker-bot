var Discord = require("discord.js");
var ParseServerList = require("./parse-server-list.js");
var IRC = require("irc");
var http = require("http");
var columnify = require("columnify");

"use strict";

console.log('\nBOOKERBOT ENGAGED --- OBJECTIVE: DESTROY ALL HUMANS\n');

var pendingRequests = {};   // Keeps a record of booking or demo requests
var verifyUserFor = {};        // Keeps a record of who is currently booking each server

var serverList;             // Server data in JSON form
var serverStatusLink = "";  // Current HTTP address to get server information

// ------------------------------------------------------------------------- //
// IRC BOT
// This bot sits in the #ozf-help IRC channel waiting for messages from the
// Discord bot.

// Initialize IRC Bot
var ircBot = new IRC.Client("irc.web.gamesurge.net", "BookerBot", 
{
    sasl: true,
    userName: 'OzfortressBookerBot',
    realName: 'Booker Dewitt',
    autoConnect: false
});

// Connect to the #ozf-help IRC server and authenticate
ircBot.connect(5, function () {
    
    console.log("IRC Bot connected to GameSurge.");
    
    ircBot.join("#ozf-help", function () {
        
        console.log("IRC Bot connected to #ozf-help.\n");
        
        ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "auth " + process.env.IRC_USERNAME + " " + process.env.IRC_PASSWORD);
        
        // setTimeout error because it requires anonymous function as callback
        UpdateServerList(); //setTimeout(UpdateServerList(), 1000);
    });
});

// MESSAGE LISTENER (Only involves 'All servers full' message)
ircBot.addListener("message", function (from, to, text, message) {
    
    var msg = text.split(" ");
    
    // There are no free servers available. Clear pendingRequest and inform user.
    // [iPGN-TF2] : � All servers are currently in use. �
    
    if (msg[1] === "All" && msg[2] === "servers") {
        
        console.log("(Failed) Servers were full.");
        for (var id in pendingRequests) {
            
            if (pendingRequests[id] === "booking") {
                pendingRequests[id] = "";               // Reset user's pendingRequest status so he isn't stuck
                discordBot.sendMessage(id, "Sorry, all servers are currently in use. Type `/servers` to check server statuses.");
            }
        }
    }
});

// NOTICE LISTENER (Notices include public server wide messages and PMs)
ircBot.addListener("notice", function (from, to, text, message) {
    
    var msg = text.split(" ");
    
    // Ignore notices from all other sources
    if (from !== "[iPGN-TF2]" || to !== "BookerBot")
        return;
    
    // Received server booking information (/book) --- Send Discord user server details
    // [iPGN-TF2] : � Details for server <serverNumber> (ozfortress): <serverDetails> �
    
    if (msg[1] === "Details" && msg[2] === "for") {
        
        UpdateServerList(function () {
            
            try {
                var serverNumber = msg[4];
                var users = FindWhoBookedServer(serverNumber);  // This returns an array of in case of duplicate users
                var serverDetails = msg.slice(6, 12).join(" ");
                
                users.forEach(function (user) {
                    var msg = user.split(" ");
                    var userID = msg[0];
                    var username = msg[1];
                    var user = discordBot.users.find('id', userID);
                    
                    console.log("id: " + userID + " user: " + username);
                    
                    // This person has a duplicate username. Don't send him details.
                    if (pendingRequests[userID] !== "booking") {
                        user.sendMessage("Do you have a duplicate username?");
                        user.sendMessage("Your request has been cancelled.");
                    }
                    else {
                        user.sendMessage("\nYour booking details for **Server " + serverNumber + "**:\n\n```" + serverDetails + "```\n");
                        pendingRequests[userID] = "";
                        pendingRequests[username] = "";
                        verifyUserFor[serverNumber] = userID;
                    }
                });
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    
    // Received demo booking information (/demos) --- Send Discord user demo details
    // [iPGN-TF2] :  � Demos for <targetUser> are available at <downloadLink> �
    
    if (msg[1] === "Demos" && msg[2] === "for") {
        var targetUser = msg[3];    // The person who's demos will be shown
        var downloadLink = msg[7];
        
        //Check which users have a pending demo request for <targetUser>
        for (var userID in pendingRequests) {
            
            if (pendingRequests[userID] === targetUser) {
                user = discordBot.users.find('id', userID);
                user.sendMessage("Demos for **" + targetUser + "** are available at:\n" + downloadLink);
                pendingRequests[userID] = "";
            }
        }
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
    
    try {
        var server = serverList[number - 1];
        var users = discordBot.users.array();
        var IDs = [];
    
        for (var i = 0; i < users.length; i++) {
          
            var trimmedUsername = Alphanumeric(users[i]["username"]); // users[i]["username"].replace(" ", "");
            
            if (trimmedUsername === server["Booker"]) {
                IDs.push(users[i]["id"] + " " + trimmedUsername);
            }
        }
        console.log(IDs);
        
        return IDs;
    }
    catch (error) {
        console.log(error);
    }
}

// Get the data from serverStatusLink (i.e. webpage) and parse it
function UpdateServerList(callback) {
    
    // Ensure callback parameter is optional. Won't do anything with data if no callback
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
                    columns: ['Number', 'Status', 'IP', 'Booker'],
                    Server: { minWidth: 6, align: 'center' },
                    Status: { minWidth: 10 }
                }
            };
                
            serverList = servers;   // Update program cache of server data
                
            // In case user doesn't /unbook through Discord, and the server auto resets:
            // Reset the verifyUserFor[] value for their server to empty
            for (var i = 0; i < serverList.length; i++) {
                var server = serverList[i];
                    
                if (server["Booker"] === "" || server["Booker"] === undefined) {
                    verifyUserFor[server["Number"]] = "";
                }
            }
                
            var serverListFormatted = columnify(servers, columnVars);
            serverListFormatted = "```" + serverListFormatted + "```";
                
            // Return the data if there was a callback
            callback(serverListFormatted);
        }
    });
}

// ------------------------------------------------------------------------- //
// DISCORD BOT
// This bot sits in the ozfortress Discord channel waiting for messages from
// the user (!book, !unbook, !help).

var discordBot = new Discord.Client();

discordBot.login(process.env.BOT_TOKEN);

discordBot.on("message", msg => {

    var content = msg.content;
    var user = msg.author;              // Discord <User> object
    var userid = msg.author.id;           // Discord numeric ID (e.g. 12020045930)
    var username = msg.author.username; // Discord user name (e.g. smeso)
    
    var prefix = content[0];
    var command = content.substring(1, content.length).split(" ");
    
    // Ignore all messages that aren't DMs or aren't in #servers channel
    if (msg.channel.type !== "dm" && msg.channel.name !== "servers") {
        return;
    }

    if (prefix === "!" || prefix === "/") {
        
        // --------------- BOOK NEW SERVER --------------- //
        
        if (command[0] === "book") {
            
            console.log("[BOOK NEW SERVER] " + user.username + " | " + user);
            
            BookServer(user);
        }
        
        // --------------- UNBOOK SERVER --------------- //
        
        if (command[0] === "unbook" || command[0] === "return" || command[0] === "reset") {
            
            console.log("\n[UNBOOK SERVER] " + user.username + " | " + user);
            
            UnbookServer(user);
        }
        
        // --------------- REQUEST DEMOS --------------- //
        if (command[0] === "demos" || command[0] === "demo") {
            
            var target = (typeof command[1] !== "undefined") ? command[1] : user.username;
            
            console.log("\n[DEMO REQUEST for " + target + "] " + user.username + " | " + user);
            
            pendingRequests[user.id] = target;
            
            ircBot.say("#ozf-help", "!demos " + target);
        }
        
        // --------------- REQUEST SERVER LIST--------------- //
        if (command[0] === "servers" || command[0] === "status") {
            
            console.log("\n[SERVER LIST] " + user.username + " | " + user);
            
            UpdateServerList(function (data) {
                msg.channel.sendMessage(data);
            });
        }
        
        // --------------- USAGE HELP --------------- //
        if (command[0] === "help") {
            
            console.log("\n[HELP] " + user.username + " | " + user);
            
            msg.channel.sendMessage("```       Discord Server Booker Usage\n" +
                                    "-----------------------------------------\n" + 
                                    "/book          -  Book a new server\n" +
                                    "/unbook        -  Return a server\n" + 
                                    "/demos <user>  -  Get STV demo link (user optional)\n" +
                                    "/servers       -  List the status of all servers\n" +
                                    "/help          -  You get this, ya dingus!\n\n" +
                                    "Commands can be sent in the #server channel or via PM to the bot.\n" +
                                    "Big thanks to bladez's IRC booker!```");
        }
        
        
        // --------------- UTILITY COMMANDS --------------- //
        if (command[0] === "stuck") {
            UnstuckUser(user);
        }
    }
});


function BookServer(user) {
    
    // Get latest version of server list
    UpdateServerList(function () {
        
        var username = Alphanumeric(user.username); // user.username.replace(" ", "");
        
        // Make sure user hasn't already booked a server. This also prevents spoofers from booking again.
        for (var i = 0; i < serverList.length; i++) {
            var server = serverList[i];
            
            if (server["Booker"] === username) {
                console.log("(Failed) " + username + " has already booked a server.");
                user.sendMessage("You already have an ongoing server booking as " + username + ".");
                return;
            }
        }
        
        // Prevent double booking if user inputs command multiple times
        if (pendingRequests[user.id] === "booking") {
            console.log("(Failed) " + username + " already has a booking in progress.");
            user.sendMessage("Your booking is already in progress. Details will be PM'd to you.");
            return;
        }
        
        if (pendingRequests[username] === "booking") {
            console.log("(Failed) " + username + " attempting to book as a duplicate.");
            user.sendMessage("Are you a duplicate user? Booking denied.");
            return;
        }
        
        pendingRequests[user.id] = "booking";
        pendingRequests[username] = "booking";
        ircBot.say("#ozf-help", "!book 3 " + username);
 
    });
}

function UnbookServer(user) {
    
    UpdateServerList(function () {
        
        //var username = user.username.replace(" ", "");
        var username = Alphanumeric(user.username); //user.username.replace(" ", "");
        
        if (pendingRequests[user.id] === "booking") {
            console.log("(Failed) User needs to finish booking first.");
            user.sendMessage("Please wait until your booking has been processed.");
            return;
        }
        
        for (var i = 0; i < serverList.length; i++) {
            var server = serverList[i];
            
            // Found a server who was booked under <username>
            if (server["Booker"] === username) {
                // Check if the /unbook caller is the actual Discord user via ID (as opposed to username spoofer)
                //if (server["Number"] !== verifyUser[user.id]) {
                if (verifyUserFor[server["Number"]] !== user.id) {
                    console.log("[WARNING!] " + user + " attempted to unbook " + username + "'s server.");
                    user.sendMessage("Are you trying to do something bad?");
                }
                else {
                    ircBot.say("#ozf-help", "!reset " + server["Number"]);
                    user.sendMessage("You have successfully unbooked **Server " + server["Number"] + "**.");
                    verifyUserFor[server["Number"]] = "";

                }
                return;
            }
        }
        console.log("(Failed) Could not find a server booked under " + username + ".");
        user.sendMessage("Could not find a booking under your username **" + username + "**.");
    });
}

function UnstuckUser(user) {
    pendingRequests[user.id] = "";
    pendingRequests[user.username] = "";
}

function Alphanumeric(string) {
    return string.replace(/[^a-z0-9]/gi, "");
}


discordBot.on("ready", function () {
    console.log("Discord Bot connected to server.");
    discordBot.user.setStatus("online", "catch with Elizabeth!");
});

process.on("SIGINT", function () {
    discordBot.logout();
    ircBot.disconnect()
    //process.exit();
});

process.on("exit", function () {
    discordBot.logout();
    ircBot.disconnect()
    //process.exit();
});