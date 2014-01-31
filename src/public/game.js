define(["render", "peerclient", "map", "commands"], function(render, peerclient, map, commands) {

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
    var game_map = null;

    var createNewPlayer = function(player_id, x, y) {
        var new_player = new Player(x, y);
        render.addSpritedObject(new_player, function() {
            console.log("New player: ", player_id);
            remote_players[player_id] = new_player;
            players.push(new_player);
        });
    };
    peerclient.start(function(id, pkg) {
        var remote_player = remote_players[id];
        if (remote_player) {
            remote_player.x = pkg.x;
            remote_player.y = pkg.y;
        } else {
            createNewPlayer(id, pkg.x, pkg.y);
        }
    }, function (broadcast, new_client_id) {
        game_map = new map.Map(500);
        var player = new Player(game_map.start_tile.x, game_map.start_tile.y);
        if(new_client_id) {
            createNewPlayer(new_client_id, game_map.start_tile.x, game_map.start_tile.y);
        }
        tick(keys, player, broadcast, remote_players);
        render.start(width, height, game_map.tiles, player, players);
    }, function (new_client_id) {
        createNewPlayer(new_client_id, game_map.start_tile.x, game_map.start_tile.y);
    });


};

var tick = function(keys, player, broadcast, remote_players) {
    var _tick = function() {
        var dirs = {};
        if (keys.left) {
            dirs["w"] = true;
        }

        if (keys.right) {
            dirs["e"] = true;
        }

        if (keys.up) {
            dirs["n"] = true;
        }

        if (keys.down) {
            dirs["s"] = true;
        }

        var cmds = [new commands.cmds.MOVE(dirs).serial()];
        broadcast({"update": true, "cmds":cmds}, function(pkgs) {
            pkgs.forEach(function(pkg) {
                var _player = player;
                if (!pkg.self) {
                    _player = remote_players[pkg.id];
                }
                pkg.cmds.forEach(function(serial_cmd) {
                    commands.userial(serial_cmd).exec(_player);
                });
            });
            setTimeout(_tick, 20);
        });
    };
    _tick();
};

start();
return  {
    start: start
}
});