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

        UpdateServerList();
    });
});

// MESSAGE LISTENER (Only involves 'All servers full' message)
ircBot.addListener("message", function (from, to, text, message) {

    var msg = text.split(" ");

    // There are no free servers available. Clear pendingRequest and inform user.
    // [iPGN-TF2] : � All servers are currently in use. �

    if (msg[1] === "All" && msg[2] === "servers") {

        console.log("(Failed) Servers were full.");
        for (var userID in pendingRequests) {

            if (pendingRequests[userID] === "booking") {
                var user = discordBot.users.find('id', userID);
                pendingRequests[userID] = "";               // Reset user's pendingRequest status so he isn't stuck
                user.sendMessage("Sorry, all servers are currently in use. Type `/servers` to check server statuses.");
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
                var serverDetails = msg.slice(6, 12).join(" ");
                
                var user = FindWhoBookedServer(serverNumber);

                console.log("Details for function ---");
                console.log(user);

                var userID = user.id;
                
                user.sendMessage("\nYour booking for **Server " + serverNumber + "** under **" + user.name + user.discriminator + "** lasts 3 hour(s):\n```" + serverDetails + "```\n");
                pendingRequests[userID] = serverDetails;
                verifyUserFor[serverNumber] = userID;
            }
            catch (error) { console.log(error); }
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

var discordBot = new Discord.Client( { fetchAllMembers: true } );

discordBot.login(process.env.BOT_TOKEN);

discordBot.on("message", msg => {

    var content = msg.content;
    var user = msg.author;              // Discord <User> object
    var userID = msg.author.id;           // Discord numeric ID (e.g. 12020045930)
    var username = msg.author.username; // Discord user name (e.g. smeso)

    var prefix = content[0];
    var command = content.substring(1, content.length).split(" ");

    // Ignore all messages that aren't DMs or aren't in #servers channel
    if (msg.channel.type !== "dm" && msg.channel.name !== "bookings") {
        return;
    }

    if (prefix === "!" || prefix === "/") {

        // --------------- BOOK NEW SERVER --------------- //

        if (command[0] === "book") {

            console.log("[BOOK NEW SERVER] " + username + " | " + userID);

            BookServer(user);
        }

        // --------------- UNBOOK SERVER --------------- //

        if (command[0] === "unbook" || command[0] === "return" || command[0] === "reset") {

            console.log("\n[UNBOOK SERVER] " + username + " | " + userID);

            UnbookServer(user);
        }

        // --------------- REQUEST DEMOS --------------- //
        if (command[0] === "demos" || command[0] === "demo") {

            var target = (typeof command[1] !== "undefined") ? command[1] : username;

            console.log("\n[DEMO REQUEST for " + target + "] " + username + " | " + userID);

            RequestDemos(user, target);

            pendingRequests[userID] = target;

            ircBot.say("#ozf-help", "!demos " + target);
        }

        // --------------- REQUEST SERVER LIST--------------- //
        if (command[0] === "servers" || command[0] === "status") {

            console.log("\n[SERVER LIST] " + username + " | " + userID);

            UpdateServerList(function (data) {
                msg.channel.sendMessage(data);
            });
        }

        // --------------- USAGE HELP --------------- //
        if (command[0] === "help") {

            console.log("\n[HELP] " + username + " | " + userID);

            msg.channel.sendMessage("```       Discord Server Booker Usage\n" +
                                    "-----------------------------------------\n" +
                                    "/book          -  Book a new server\n" +
                                    "/unbook        -  Return a server\n" +
                                    "/demos <user>  -  Get STV demo link (user optional)\n" +
                                    "/servers       -  List the status of all servers\n" +
                                    "/help          -  You get this, ya dingus!\n\n" +
                                    "Commands can be sent in the #bookings channel or via PM to the bot.\n" +
                                    "Big thanks to bladez's IRC booker!```");
        }


        // --------------- UTILITY COMMANDS --------------- //
        if (command[0] === "stuck") {
            UnstuckUser(user);
        }

        // Fix needed if IRC login is from different hostmask
        if (command[0] === "authcookie" && command[1] !== null) {
            if (command[1] === "request") {
                ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "authcookie " + process.env.IRC_USERNAME);
                console.log("Authcookie request sent to email address of " + process.env.IRC_USERNAME + ".");
            }
            else {
                ircBot.send("PRIVMSG", "AuthServ@Services.GameSurge.net", "cookie " + process.env.IRC_USERNAME + " " + command[1]);
                console.log("Attempted to authenticate with cookie: " + command[1]);
            }
        }

        if (command[0] === "forcebook" && command[1] !== null) {
            pendingRequests[userID] = "booking";
            ircBot.say("#ozf-help", "!book 3 " + command[1]);
            console.log('force book: ' + command[1]);
        }

        if (command[0] === "forceunbook" && command[1] !== null) {
            ircBot.say("#ozf-help", "!reset " + command[1]);
            console.log('force unbook: ' + command[1]);
        }

        if (command[0] === "whobooked" && command[1] !== null) {
            FindWhoBookedServer(command[1]);
        }

        if (command[0] === "allusers" && command[1] !== null) {
            FindDiscordUsers(command[1]);
        }
    }
});

// ----- BOOKING / UNBOOKING FUNCTIONS ----- //

function BookServer(user) {
    try {
        UpdateServerList(function () {

            var username = Alphanumeric(user.username);
            var userID = user.id;
            var discriminator = user.discriminator;

            // Make sure user hasn't already booked a server. If so, resend details.
            for (var i = 0; i < serverList.length; i++) {
                var server = serverList[i];

                console.log(server["Booker"] + ' vs ' + username + discriminator);
                if (server["Booker"] === (username + discriminator)) {
                    console.log("(Failed) " + username + " | " + username + discriminator + " has already booked a server.");
                    user.sendMessage("You have already booked **Server " + (i + 1) + "** under **" + username + discriminator + "**.");

                    // Resend details
                    user.sendMessage('```' + pendingRequests[userID] + '```');

                    return;
                }
            }

            // Prevent double booking if user inputs command multiple times
            // <user.id> refers to Discord ID number (123456789)
            if (pendingRequests[userID] === "booking") {
                console.log("(Failed) " + username + " already has a booking in progress.");
                user.sendMessage("Your booking is already in progress. Details will be PM'd to you.");
                return;
            }

            console.log("No server booking found under " + username + discriminator + ". Get him a server!");
            pendingRequests[userID] = "booking";
            ircBot.say("#ozf-help", "!book 3 " + username + discriminator); //e.g. smeso4522

        });
    }
    catch (error) {
        console.log(error);
    }
}

function UnbookServer(user) {
    try {
        UpdateServerList(function () {

            var username = Alphanumeric(user.username);
            var userID = user.id;
            var discriminator = user.discriminator;

            // Prevent conflicting or multiple user command inputs
            if (pendingRequests[userID] === "booking") {
                console.log("(Failed) User needs to finish booking first.");
                user.sendMessage("Please wait until your booking has been processed.");
                return;
            }

            // Check all servers if user has booked one of them or not
            for (var i = 0; i < serverList.length; i++) {
                var server = serverList[i];

                // Found a server who was booked under <username>
                if (server["Booker"] === (username + discriminator)) {
                    // Check if the /unbook caller is the actual Discord user via ID (as opposed to username spoofer)
                    if (verifyUserFor[server["Number"]] === userID) {   // This can probably be removed
                        
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
    catch (error) {
        console.log(error);
    }
}

function RequestDemos(user, target) {

}

function FindDiscordUsers(username) {
    try {
        var guilds = discordBot.guilds;
        var guildIDs = guilds.keys();
        
        var foundUsers = [];
        
        console.log("Searching for " + username);
        
        guilds.forEach(function (guild) {
            var members = guild.members;
            
            members.forEach(function (member) {
                var user = member.user;
                
                if (Alphanumeric(user.username) === username) {
                    foundUsers.push(user.username + user.discriminator);
                }
            });
        });
        
        console.log('Found ' + foundUsers.length + ' ' + username + '(s):');
        console.log(foundUsers);

        return foundUsers;
    }
    catch (error) { console.log(error); }
}

// ----- HELPFUL FUNCTIONS ----- //

function FindWhoBookedServer(number) {

    try {
        var server = serverList[number - 1];
        console.log('[FindWhoBookeddServer] Attempt to find ' + server["Booker"]);
        //var user = discordBot.users.find('id', server["Booker"]);

        var user = server["Booker"];    // smeso4522
        var username = user.substring(0, user.length - 4); // smeso
        var discriminator = user.substring(user.length - 4);   // 4522

        var users = discordBot.users.findAll('username', username);

        for (var i = 0; i < users.length; i++) {
            var user = users[i];

            if (user["discriminator"] === discriminator) {
               return user;
            }

        }

        /*
        for (var user in users) {
            console.log(user);
            console.log(user + " - " + user["discriminator"] + " vs" +discriminator);
            if (user["discriminator"] === discriminator) {
                console.log("user (" + username + " with disc (" + discriminator + ") found.");
                return user;
            }
        }
        */
    }
    catch (error) { console.log(error); }
}

function UnstuckUser(user) {
    var username = Alphanumeric(user.username);
    var userID = user.id;

    pendingRequests[userID] = "";
}

function Alphanumeric(string) {
    string = string.replace(" ", "");
    string = string.replace(/[^a-z0-9]/gi, "");
    return string;
}

// ----- MISC PROGRAM LISTENERS ----- //

discordBot.on("ready", function () {
    console.log("Discord Bot connected to server.");
    discordBot.user.setStatus("online");
    discordBot.user.setGame("catch with Elizabeth!");
});

process.on("SIGINT", function () {
    discordBot.destroy();
    ircBot.disconnect()
    process.exit();
});

process.on("exit", function () {
    discordBot.destroy();
    ircBot.disconnect()
    process.exit();
});
