# Booker Bot
Discord to IRC bridge for ozfortress server booking. Allows Discord users to type in IRC booking commands, and will be PM'd relevant information.

It just runs as a standalone nodejs console application I guess?

## Discord Commands
**/book** - Book a new server under user's Discord username

**/unbook** - Unbook server

**/demos <user>** - Get STV demo repository for specified user

**/help** - Displays commands

## Required Modules
[discord.js](https://github.com/hydrabolt/discord.js/)    ```bash npm install --no-optional discord.js```  

[node-irc](https://github.com/martynsmith/node-irc)     ```bash npm install irc```  

[sanitize-html](https://github.com/punkave/sanitize-html)     ```bash npm install sanitize-html```  

[columnify](https://github.com/timoxley/columnify)     ```bash npm install columnify@latest```  

## To Do List
- Decide on whether certain messages should be PMs or broadcasts.

- Let user choose booking duration/map selection (if possible).

- Listen for iPGN automatically resetting servers (then run UpdateServerList()).

- Figure out what happens when servers are full and how to deal with it.

- Update ```bookings[]``` and ```demoRequests[]``` to utilize Server List instead.

- See if Client caching could be of benefit. (Client.add(), Client.remove()).

- Clean up console logging to be log friendly.

## Etc
I'll be honest, I still suck ass at using Github.

Previous repo: [smesbot](https://github.com/bryjch/smesbot)