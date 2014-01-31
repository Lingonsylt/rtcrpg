define(function() {
    function Tile(x, y, passable) {
        this.sprite = passable ? "G000M800.BMP" : "B1B0I800.BMP";
        this.x = x;
        this.y = y;
        this.img = null;
    }

    function Map(numtiles) {
        var nav = {"n": [0, -1], "e": [1, 0], "s": [0, 1], "w":[-1, 0]};
        var invnav = {"n": "s", "s": "n", "e": "w", "w":"e"};
        var turnnav = {"n": ["e", "w"], "s": ["e", "w"], "e":["n", "s"], "w":["n", "s"]};
        this.start_tile = new Tile(0,0, true);
        var current = this.start_tile;
        var tiles = [current];
        var tile_map = {"0,0":current};

        var gn = function(tile, dir) {
            return tile_map[(tile.x + nav[dir][0]) + "," + (tile.y + nav[dir][1])];
        };

        var dir = ["n", "e", "s", "w"][Math.floor(Math.random() * 4)];
        for(var i = 0; i < numtiles; i++) {
            if(Math.random() > 0.8) {
                dir = turnnav[dir][Math.floor(Math.random() * 2)];
            }
            var neigbor = gn(current, dir);
            if(!neigbor) {
                neigbor = new Tile(current.x + nav[dir][0], current.y + nav[dir][1], true);
                tiles.push(neigbor);
                tile_map[neigbor.x + "," + neigbor.y] = neigbor;
                current = neigbor;
            }
            if (neigbor && Math.random() > 0.6) {
                current = tiles[Math.floor(Math.random() * tiles.length)];
            }
        }

        tiles.forEach(function(tile) {
            ["n", "e", "s", "w"].forEach(function(dir) {
                var neigbor = gn(tile, dir);
                if (!neigbor) {
                    neigbor = new Tile(tile.x + nav[dir][0], tile.y + nav[dir][1], false);
                    tiles.push(neigbor);
                    tile_map[neigbor.x + "," + neigbor.y] = neigbor;
                }
            });
        });

        this.tiles = tiles;
    }

    return  {
        Map: Map
    }
});