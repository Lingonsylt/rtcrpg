define(function() {

var scheduleCommand = function(ticks, at, command) {
    console.log("Scheduling new player join at:", at);
    if (ticks[at + ""] === undefined) {
        ticks[at + ""] = {};
    }
    var tick = ticks[at + ""];
    if (tick.cmds === undefined) {
        tick.cmds = [];
    }
    tick.cmds.push(command);
};

var cmds =  {
    NEW_PLAYER : function(new_peer_id) {
        this.new_peer_id = new_peer_id;
        this.exec = function(pc) {
            scheduleCommand(pc.ticks, pc.tick + 3, function () {
                var new_peer = pc.unactive_remote_peers[new_peer_id];
                if (new_peer) {
                    console.log("Adding new player", new_peer_id);
                    delete pc.unactive_remote_peers[new_peer_id];
                    pc.remote_peers.push(new_peer);
                    pc.remote_peers_map[new_peer.id] = new_peer;
                    pc.send(new_peer_id, new cmds.GAME_STATE(pc.tick, pc.seed_number, pc.serializeGameState()).serial());
                    pc.onNewClient(new_peer_id);
                    return false;
                } else {
                    console.log("Could not add scheduled new player '" + new_peer_id + "', no hello received yet. Trying again...");
                    // TODO: Will reschedule, should just rerun
                    return true;
                }
            });
        };

        this.serial = function () {
            return {type: "NEW_PLAYER", new_peer_id: this.new_peer_id};
        };

        this.unserial = function(data) {
            return new cmds.NEW_PLAYER(data.new_peer_id);
        }
    },

    GAME_STATE : function (tick, seed, state) {
        this.tick = tick;
        this.seed = seed;
        this.state = state;
        this.exec = function (pc, from) {
            if(!pc.unactive_remote_peers[from] && !pc.remote_peers_map[from]) {
                console.log("Not ready to send game state, '" + from + "' not accepted yet. Trying again...");
                return true;
            } else {
                pc.onEndpointGameState(from, this.tick, this.seed, this.state);
                return false;
            }
        };

        this.serial = function () {
            return {type: "GAME_STATE", tick: this.tick, seed: this.seed, state: this.state};
        };

        this.unserial = function(data) {
            return new cmds.GAME_STATE(data.tick, data.seed, data.state);
        }
    },

    JOIN : function (id) {
        this.id = id;
        this.exec = function(pc) {
            pc.packet.cmds.push(new cmds.NEW_PLAYER(this.id).serial());
            var remote_peer_ids = [];
            pc.remote_peers.forEach(function(remote_peer) {
                remote_peer_ids.push(remote_peer.id);
            });
            pc.send(this.id, new cmds.NEW_PEERS(remote_peer_ids).serial());
        };

        this.serial = function () {
            return {type: "JOIN", id: this.id};
        };

        this.unserial = function(data) {
            return new cmds.JOIN(data.id);
        }
    },

    NEW_PEERS : function (new_peers) {
        this.new_peers = new_peers;

        this.exec = function (pc) {
            var new_peer_found = false;
            this.new_peers.forEach(function(new_peer_id) {
                if (pc.unactive_remote_peers[new_peer_id]) {
                    console.log("Activated peer", new_peer_id);
                    var new_peer = pc.unactive_remote_peers[new_peer_id];
                    delete pc.unactive_remote_peers[new_peer_id];
                    pc.remote_peers.push(new_peer);
                    pc.remote_peers_map[new_peer.id] = new_peer;
                } if(!pc.remote_peers_map[new_peer_id]) {
                    console.log("Received new peer '" + new_peer_id);
                    pc.connectPeer(new_peer_id, false, true);
                    new_peer_found = true;
                }
            });
            pc.conn_state = new_peer_found ? "peers_received" : "peers_connected";
            console.log("conn_state: ", pc.conn_state);
        };

        this.serial = function () {
            return {type: "NEW_PEERS", new_peers: this.new_peers};
        };

        this.unserial = function(data) {
            return new cmds.NEW_PEERS(data.new_peers);
        }
    }
};

return {
    cmds: cmds,
    unserial: function(cmd) {
        return new cmds[cmd.type]().unserial(cmd);
    }
};

});
