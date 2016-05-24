var http = require("http");
var sanitize = require("sanitize-html");

module.exports = function (link, callback) {
    http.get(link, function (response) {
        var body = "";

        console.log("ParseServerList() got response: " + response.statusCode);

        if (response.statusCode !== 200) {
            callback("error");
        }

        response.on("data", function (chunk) {
            body += chunk;
        });

        response.on("end", function () {

            // If the link has no problem, but the password is wrong, the webpage will work
            // but only contain 'Unauthorized access'. So, check the length of the contents
            if (body.length < 200) {  ///// This is some hackey shit right here
                callback("error");
            }

            // Get rid of gross html tags
            body = sanitize(body, { allowedTags: [] });

            // Get rid of gross &nbsp; characters
            body = body.replace(/\s\s+/g, " ");

            // Use the long ----- lines to determine splits
            body = body.replace(/----------------------------------------------------------------------------------------------------------/g, "|");

            var arr = body.split("|");

            // Trim 'ozfortress server status' and 'number of servers booked'
            arr[0] = arr[0].substring(arr[0].indexOf("Server") - 1);

            var servers = [];

            // Extract the information of each server as array elements
            for (var i = 0; i < arr.length - 1; i++) {
                var segments = arr[i].split(" ");

                servers[i] = {};
                servers[i]["Server"] = segments[2];
                servers[i]["Status"] = segments[5];
                servers[i]["IP"] = segments[7];

                if (segments[5] === "Booked") {
                    //servers[i]["BookTime"] = segments[16] + " " + segments[17];   // The freaking time zone is totally wrong
                    servers[i]["Booker"] = segments[20];
                }
            }

            callback(servers);
        });
    });
};