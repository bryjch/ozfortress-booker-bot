# Booker Bot
Discord to IRC bridge for ozfortress server booking. Allows Discord users to type in IRC booking commands, and will be PM'd relevant information.

It just runs as a standalone nodejs console application I guess?

## Discord Commands
The Bot only listens to commands via PM or in #servers channel.

**/book** - Book a new server under user's Discord username

**/unbook** - Unbook server

**/demos <user>** - Get STV demo repository for specified user

**/servers** - List the status of all servers

**/help** - Displays commands

## Required Modules
[discord.js](https://github.com/hydrabolt/discord.js/)    ```bash npm install --no-optional discord.js```  

[node-irc](https://github.com/martynsmith/node-irc)     ```bash npm install irc```  

[sanitize-html](https://github.com/punkave/sanitize-html)     ```bash npm install sanitize-html```  

[columnify](https://github.com/timoxley/columnify)     ```bash npm install columnify@latest```  

## To Do List
- Update the To Do List.

- Let user choose booking duration/map selection (if possible).

- Make ```verifyUserFor[]``` account for potential program resets.

- Try to make ```BookServer()``` check for user.id instead of user.username.

- Probably check contents of ```pendingRequests[]``` every x minutes/hours and remove empty values.

- Ensure proper CPU utilization.

- Clean up console logging to be log friendly. And clean up everything else I guess.

- Separate all the crap instead of having a huge ass app.js.

- ~~Decide on whether certain messages should be PMs or broadcasts.~~ Sensitive details = @PM. Server list/help = @Reply.

- ~~Listen for iPGN automatically resetting servers (then run UpdateServerList()).~~ Definitely not necessary anymore.

- ~~Figure out what happens when servers are full and how to deal with it.~~ Done.

- ~~Update ```bookings[]``` and ```demoRequests[]``` to utilize Server List instead.~~ Done.

- ~~See if Client caching could be of benefit. (Client.add(), Client.remove()).~~ Most likely not necessary.

## Etc
I'll be honest, I still suck ass at using Github.

Previous repo: [smesbot](https://github.com/bryjch/smesbot)