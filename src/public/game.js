define(["render", "peerclient"], function(render, peerclient) {
function Tile(x, y) {
    this.sprite = "G000M800.BMP";
    this.x = x;
    this.y = y;
    this.img = null;
}

function Player(x, y) {
    this.sprite = "player.png";
    this.x = x;
    this.y = y;
    this.img = null;
}

var start = function () {
    var keys = {
        "left" : false,
        "right" : false,
        "up": false,
        "down": false
    };

    var width = 600;
    var height = 600;
    var player = new Player(width / 2, height / 2);

    var tiles = [];
    for (var i = 0; i < 10; i++) {
        for (var j = 0; j < 10; j++) {
            tiles.push(new Tile(i * 128, j * 128));
        }
    }
    document.onkeydown  = function (evt) {
        switch (evt.keyCode) {
            case 37:
                keys.left = true;
                break;
            case 38:
                keys.down = true;
                break;
            case 39:
                keys.right = true;
                break;
            case 40:
                keys.up = true;
                break;
        }
    };

    document.onkeyup  = function (evt) {
        switch (evt.keyCode) {
            case 37:
                keys.left = false;
                break;
            case 38:
                keys.down = false;
                break;
            case 39:
                keys.right = false;
                break;
            case 40:
                keys.up = false;
                break;
        }
    };

    var remote_players = {};
    var players = [];
    var broadcast = peerclient.start(function(id, pkg) {
        var remote_player = remote_players[id];
        if (remote_player) {
            remote_player.x = pkg.x;
            remote_player.y = pkg.y;
        } else {
            var new_player = new Player(pkg.x, pkg.y);
            remote_players[id] = new_player;
            render.addSpritedObject(new_player, function() {
                players.push(new_player);
            });
        }
    });

    tick(keys, player, broadcast);
    render.start(width, height, tiles, player, players);
};

var tick = function(keys, player, broadcast) {
    var _tick = function() {
        if (keys.left) {
            player.x -= 10;
        }

        if (keys.right) {
            player.x += 10;
        }

        if (keys.up) {
            player.y += 10;
        }

        if (keys.down) {
            player.y -= 10;
        }

        broadcast({"update": true, "pkg": {"x": player.x, "y": player.y}});
        setTimeout(_tick, 20);
    };
    _tick();
};

start();
return  {
    start: start
}
});