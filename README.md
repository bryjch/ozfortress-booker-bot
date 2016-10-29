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
- Make ```verifyUserFor[]``` account for potential program resets.

- Clean up console logging to be log friendly. And clean up everything else I guess.

- Ensure proper CPU utilization.

- Let user choose booking duration/map selection (if possible).

- Try to make ```BookServer()``` check for user.id instead of user.username.

- Probably check contents of ```pendingRequests[]``` every x minutes/hours and remove empty values.

- Separate all the crap instead of having a huge ass app.js.

- ~~Decide on whether certain messages should be PMs or broadcasts.~~ Sensitive details = @PM. Server list/help = @Reply.

- ~~Listen for iPGN automatically resetting servers (then run UpdateServerList()).~~ Definitely not necessary anymore.

- ~~Figure out what happens when servers are full and how to deal with it.~~ Done.

- ~~Update ```bookings[]``` and ```demoRequests[]``` to utilize Server List instead.~~ Done.

- ~~See if Client caching could be of benefit. (Client.add(), Client.remove()).~~ Most likely not necessary.

## Etc
I'll be honest, I still suck ass at using Github.

Previous repo: [smesbot](https://github.com/bryjch/smesbot)

## Some problems

### You can ignore this, I just add this here to remember some core issues / solutions

verifyUserFor[] stores the Discord ID of who booked what number server. (e.g. verifyUserFor[1] = "123456" means ``Server 1 is booked by Discord User with ID 123456``)

This is helpful to handle if users have duplicate usernames, since IDs are unique.

The problem is that servers are booked under **usernames**. This is done for user simplicity and intuitivity.

For example, if bookings were made under IDs, requesting a demo would be a problem.

- ``/demos John`` is more intuitive than ``/demos 123456789``. 

- In fact, it's probably not possible to find out Discord IDs easily.

- Discord ID -> username is not a problem **but** username -> Discord ID is a problem.

Then it seems the main problem would be retrieving demos. It could be done such that  ``/demos John`` retrieves a list of all users named ``John``, then get demo links using their IDs.

The biggest benefit of booking under Discord IDs is that if the Booker Bot crashes, when it restarts to retrieve the server list, the bookings will be unique Discord IDs. Even if two users had **the same username**, it would look like this:

``` Server 1 - 123456789 ```

``` Server 2 - 696969696 ```

The program can rebuild verifyUserFor[]. If necessary, do a lookup on users and convert ID to username for readability.


Booking under usernames would look like this:

``` Server 1 - John ```

``` Server 2 - John ```

There is no way for the program to rebuild verifyUserFor[] if there are duplicate usernames.


Therefore, the sacrifice for reliability is /demos <user> functionality. Solution is TBD.