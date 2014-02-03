define(function() {
    var cmds = {
        MOVE : function (dirs) {
            this.dirs = dirs;
            this.serial = function () {
                return {type: "MOVE", dirs: this.dirs};
            };

            this.unserial = function(cmd) {
                return new cmds.MOVE(cmd.dirs);
            };

            this.exec = function (player) {
                if (this.dirs.w) {
                    player.x -= 10;
                }

                if (this.dirs.e) {
                    player.x += 10;
                }

                if (this.dirs.s) {
                    player.y -= 10;
                }

                if (this.dirs.n) {
                    player.y += 10;
                }
            }
        }
    };

    return {
        cmds: cmds,
        unserial:function(cmd) {
            return new cmds[cmd.type]().unserial(cmd);
        }
    };
});
