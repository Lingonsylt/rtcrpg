define(["render", "peerclient", "map", "commands"], function(render, peerclient, map, commands) {

function Player(id, x, y) {
    this.sprite = "player.png";
    this.id = id;
    this.x = x;
    this.y = y;
    this.img = null;

    this.serial = function() {
        return {"id": this.id, "x": this.x, "y": this.y};
    };
}
Player.unserial = function(serial) {
    return new Player(serial.id, serial.x, serial.y);
};

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

    var players_map = {};
    var players = [];
    var game_map = null;
    var player = null;

    var createNewPlayer = function(player_id, x, y) {
        var new_player = new Player(player_id, x, y);
        // TODO: Race condition!
        render.addSpritedObject(new_player, function() {
            console.log("New player: ", player_id);
            players_map[player_id] = new_player;
            players.push(new_player);
        });
    };

    var serializeGameState = function () {
        var data = {players:[player.serial()]};
        players.forEach(function(remote_player) {
            data.players.push(remote_player.serial());
        });
        return data;
    };

    var unserializeGameState = function (state) {
        state.players.forEach(function(player) {
            createNewPlayer(player.id, player.x, player.y);
        });
    };

    peerclient.start(function (broadcast, game_state, id) {
            game_map = new map.Map(500);
            player = new Player(id, game_map.start_tile.x, game_map.start_tile.y);
            if(game_state) {
                unserializeGameState(game_state);
            }
            tick(keys, player, broadcast, players_map);
            render.start(width, height, game_map.tiles, player, players);
        },
        serializeGameState,
        function(new_player_id) {
            createNewPlayer(new_player_id, game_map.start_tile.x, game_map.start_tile.y);
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
                pkg.message.cmds.forEach(function(serial_cmd) {
                    commands.unserial(serial_cmd).exec(_player);
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