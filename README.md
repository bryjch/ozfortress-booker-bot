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
[discord.js](https://github.com/hydrabolt/discord.js/)    ```bash npm install discord.js```  

[node-irc](https://github.com/martynsmith/node-irc)     ```bash npm install irc```  

[sanitize-html](https://github.com/punkave/sanitize-html)     ```bash npm install sanitize-html```  

[columnify](https://github.com/timoxley/columnify)     ```bash npm install columnify@latest```  

## To Do List
- Update ```verifyUserFor``` if the program crashes. Otherwise requesting details with /book or trying to /unbook won't work.

- Actually maybe ```verifyUserFor``` can be totally removed, since all bookers are unique now?

- Clean up console logging to be log friendly. And clean up everything else I guess.

- Ensure proper CPU utilization.

- Let user choose booking duration/map selection (if possible).

- Probably check contents of ```pendingRequests[]``` every x minutes/hours and remove empty values.

- Separate all the crap instead of having a huge ass app.js.

## Etc
I'll be honest, I still suck ass at using Github.

Previous repo: [smesbot](https://github.com/bryjch/smesbot)