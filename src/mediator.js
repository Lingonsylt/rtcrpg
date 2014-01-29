var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');

var respond404 = function (res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('404 Not Found\n');
    res.end();
};

var serveStatic = function (uri, res) {
    var mimeTypes = {
        "html": "text/html",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png",
        "js": "text/javascript",
        "css": "text/css"};

    var filename = path.join(process.cwd(), uri);
    fs.exists(filename, function(exists) {
        if(!exists) {
            respond404(res);
        } else {
            var mimeType = mimeTypes[path.extname(filename).split(".")[1]];
            res.writeHead(200, {'Content-Type':mimeType});
            var fileStream = fs.createReadStream(filename);
            fileStream.pipe(res);
        }
    });
};


var dir = {};
http.createServer(function (req, res) {
    var uri = url.parse(req.url).pathname;
    if (uri.indexOf("/public/") === 0) {
        serveStatic(uri, res);
    } else if (uri == "/desc" || uri == "/desc/") {
        var data = "";
        req.on('data', function(chunk) {
            data += chunk;
        });

        req.on('end', function () {
            var request = JSON.parse(data);
            var response = {};
            if (dir[request["id"]] === undefined) { dir[request["id"]]  = {}; }
            if (request["action"] === "getoffer") {
                if (dir[request["id"]] !== undefined && dir[request["id"]]["offer"] !== undefined) {
                    response["desc"] = dir[request["id"]]["offer"];
                } else {
                    response["desc"] = null;
                }
                console.log(request["id"], "Request for offer: ", response["desc"]);
            } else if (request["action"] === "publishoffer") {
                dir[request["id"]]["offer"] = request["desc"];
                console.log(request["id"], "Offer published: ", request["desc"]);
            } else if (request["action"] === "publishanswer") {
                dir[request["id"]]["answer"] = request["desc"];
                console.log(request["id"], "Answer published: ", request["desc"]);
            } else if (request["action"] === "getanswer") {
                if (dir[request["id"]] !== undefined && dir[request["id"]]["answer"] !== undefined) {
                    response["desc"] = dir[request["id"]]["answer"];
                } else {
                    response["desc"] = null;
                }
                console.log(request["id"], "Request for answer: ", response["desc"]);
            }
            //console.log("Dir state: ", dir);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(response));
        });
    } else {
        respond404(res);
    }
}).listen(1337, '127.0.0.1');