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

function Monster(x, y) {
    this.sprite = "monster.png";
    this.x = x;
    this.y = y;
    this.img = null;
    this.speed = 2;
    var self = this;
    this.serial = function() {
        return {"x": this.x, "y": this.y};
    };

    this.walkTowards = function(target) {
        if (self.x < target.x) {
            self.x += Math.min(this.speed, target.x - self.x);
        } else {
            self.x -= Math.min(this.speed, self.x - target.x);
        }

        if (self.y < target.y) {
            self.y += Math.min(this.speed, target.y - self.y);
        } else {
            self.y -= Math.min(this.speed, self.y - target.y);
        }
    };

    this.walkAway = function(target) {
        if (self.x < target.x) {
            self.x -= self.speed;
        } else {
            self.x += self.speed;
        }

        if (self.y < target.y) {
            self.y -= self.speed;
        } else {
            self.y += self.speed;
        }
    };

    this.update = function(map, players, monsters) {
        var closest_player = null;
        players.forEach(function(player) {
            var distance = Math.sqrt(Math.pow(self.x - player.x, 2) + Math.pow(self.y - player.y, 2));
            if (closest_player === null) {
                closest_player = {d:distance, p:player};
            } else if (closest_player.d > distance) {
                closest_player = {d:distance, p:player};
            }
        });

        var closest_monster = null;
        monsters.forEach(function(monster) {
            var distance = Math.sqrt(Math.pow(self.x - monster.x, 2) + Math.pow(self.y - monster.y, 2));
            if(distance != 0) {
                if (closest_monster === null) {
                    closest_monster = {d:distance, m:monster};
                } else if (closest_monster.d > distance) {
                    closest_monster = {d:distance, m:monster};
                }
            }
        });

        if (closest_monster.d < 50) {
            self.walkAway(closest_monster.m);
        } else if (closest_player.d < 500 && closest_player.d > 30) {
            if (closest_player.d < 300) {
                if (closest_monster.d < 300 && closest_monster.d > 100) {
                    this.walkTowards(closest_monster.m);
                } else {
                    this.walkTowards(closest_player.p);
                }
            }
        }
    };
}

Monster.unserial = function(serial) {
    return new Monster(serial.x, serial.y);
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
    var monsters = [];

    var createNewPlayer = function(player_id, x, y) {
        var new_player = new Player(player_id, x, y);
        // TODO: Race condition!
        render.addSpritedObject(new_player, function() {
            console.log("New player: ", player_id);
            players_map[player_id] = new_player;
            players.push(new_player);
        });
    };

    var createNewMonster = function(x, y) {
        var new_monster = new Monster(x, y);
        monsters.push(new_monster);
    };

    var serializeGameState = function () {
        var data = {players:[player.serial()], monsters:[]};
        players.forEach(function(remote_player) {
            data.players.push(remote_player.serial());
        });

        monsters.forEach(function(monster) {
            data.monsters.push(monster.serial());
        });
        return data;
    };

    var unserializeGameState = function (state) {
        state.players.forEach(function(player) {
            createNewPlayer(player.id, player.x, player.y);
        });

        state.monsters.forEach(function(monster) {
            createNewMonster(monster.x, monster.y);
        });
    };

    var generateMonsters = function (map) {
        map.tiles.forEach(function(tile) {
            if(tile.passable && Math.random() > 0.95) {
                createNewMonster(tile.x * 128 + 64, tile.y * 128 + 64);
            }
        });
    };

    peerclient.start(function (broadcast, game_state, id) {
            game_map = new map.Map(500);
            player = new Player(id, game_map.start_tile.x, game_map.start_tile.y);
            if(game_state) {
                unserializeGameState(game_state);
            } else {
                generateMonsters(game_map);
            }
            tick(keys, player, broadcast, players, players_map, monsters);
            render.start(width, height, game_map.tiles, player, players, monsters);
        },
        serializeGameState,
        function(new_player_id) {
            createNewPlayer(new_player_id, game_map.start_tile.x, game_map.start_tile.y);
    });


};

var tick = function(keys, player, broadcast, players, players_map, monsters) {
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

        monsters.forEach(function(monster) {
            monster.update(map, [player].concat(players), monsters);
        });

        var cmds = [new commands.cmds.MOVE(dirs).serial()];
        broadcast({"update": true, "cmds":cmds}, function(pkgs) {
            pkgs.forEach(function(pkg) {
                var _player = player;
                if (!pkg.self) {
                    _player = players_map[pkg.id];
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