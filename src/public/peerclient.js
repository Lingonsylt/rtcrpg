define(["peer", "seedrandom", "peercmds"], function(peer, seedrandom, peercmds) {
var PeerClient = function (onStartCallback, serializeGameState, onNewClient) {
    var logging = false;
    var connecting = false;
    var self = this;

    this.seed_number = Math.floor(Math.random() * 1000000) + "a";
    this.unactive_remote_peers = {};
    this.remote_peers = [];
    this.remote_peers_map = {};
    this.id = window.location.hash.substring(1).split(",")[0];
    this.serializeGameState = serializeGameState;
    this.onStartCallback = onStartCallback;
    this.onNewClient = onNewClient;
    var endpoint = null;
    var initial_game_state = null;

    if(window.location.hash.substring(1).split(",").length >= 2) {
        endpoint = window.location.hash.substring(1).split(",")[1];
    }

    this.conn_state = endpoint ? "init" : "ready";

    this.tick = 0;

    this.ticks = {"0": {cmds: []}};
    var createPacket = function () {
        return {new_tick: true, id: self.id, tick: self.tick, cmds: []};
    };

    this.packet = createPacket();
    var p = new peer.Peer(this.id, {host: 'localhost', port: 9000, key: 'secret'});
    var onTickReadyCallback = null;

    var broadcast = function (message, _onTickReadyCallback) {
        onTickReadyCallback = _onTickReadyCallback;
        self.packet.message = message;
        self.remote_peers.forEach(function(remote_peer) {
            remote_peer.conn.send(self.packet);
        });

        self.tick++;
        self.packet = createPacket();
    };

    this.send = function(target, message) {
        if (self.unactive_remote_peers[target]) {
            self.unactive_remote_peers[target].conn.send(message);
        } else if (self.remote_peers_map[target]) {
            self.remote_peers_map[target].conn.send(message);
        } else {
            throw "unknown peer: " + target;
        }
    };

    this.connectPeer = function (remote_id, join, active) {
        console.log("Connecting to '" + remote_id + "'...");
        var conn = p.connect(remote_id);
        conn.on('open', function(){
            console.log("Connected!");
            var new_peer = {"id": remote_id, "conn": conn, "tick_done": false};
            if (active) {
                self.remote_peers_map[new_peer.id] = new_peer;
                self.remote_peers.push(new_peer);
                if (self.conn_state === "peers_received" && Object.keys(self.unactive_remote_peers).length === 0) {
                    self.conn_state = "peers_connected";
                    console.log("conn_state:", self.conn_state);
                }
            } else {
                self.unactive_remote_peers[remote_id] = new_peer;
            }
            conn.send({"id": self.id});
            console.log("Connected peer: " + remote_id);
            if (join) {
                self.conn_state = "join_sent";
                console.log("conn_state: ", self.conn_state);
                conn.send(new peercmds.cmds.JOIN(self.id).serial());
            }
        });

        conn.on('data', function(data){
            receiveData(data, remote_id);
        });
    };

    var receiveData = function (data, source_id) {
        if (data.new_tick) {
            if (data.cmds) {
                data.cmds.forEach(function(cmd) {
                    peercmds.unserial(cmd).exec(self, source_id);
                });
            }
            if(!self.remote_peers_map[data.id]) { console.log("Remote missing:", data, self.unactive_remote_peers, self.remote_peers_map); }
            if (!self.remote_peers_map[data.id]["tick_done"]) {
                self.remote_peers_map[data.id]["tick_done"] = data.message;

                var done = [];
                self.remote_peers.forEach(function(remote_peer) {
                    if (remote_peer["tick_done"]) {
                        done.push({"id": remote_peer["id"], "message": remote_peer["tick_done"], "self" : remote_peer["id"] === self.id});
                    }
                });

                if (done.length === self.remote_peers.length && self.conn_state == "ready") {
                    var tickReady = function (retry_cmds) {
                        var cmds_not_ready = [];
                        var current_tick = self.ticks[self.tick + ""];
                        var cmds = retry_cmds || (current_tick && current_tick.cmds);
                        if (cmds && cmds.length != 0) {
                            cmds.forEach(function(cmd) {
                                var res = cmd();
                                if(res) {
                                    cmds_not_ready.push(cmd);
                                }
                            });
                        }


                        if (cmds_not_ready.length > 0) {
                            setTimeout(function() { tickReady(cmds_not_ready); }, 100);
                        } else {
                            delete self.ticks[self.tick + ""];
                            self.remote_peers.forEach(function(remote_peer) { remote_peer["tick_done"] = false; });
                            onTickReadyCallback(done);
                        }
                    };
                    tickReady();
                } else if (!logging) {
                    logging = true;
                    //console.log("remote peers", self.remote_peers);
                    setTimeout(function() { logging = false;}, 500);
                }
            }
        } else {
            peercmds.unserial(data).exec(self, source_id);
        }
    };

    var self_peer = {"id": this.id,
                     "conn":
                         {"send" :
                             function(message) {
                                 receiveData(message, self.id);
                             }
                         },
                    "tick_done": false};
    this.remote_peers.push(self_peer);
    this.remote_peers_map[self_peer.id] = self_peer;

    this.onEndpointGameState = function (from, tick, seed, state) {
        if (!initial_game_state) {
            initial_game_state = tick + "," + seed + JSON.stringify(state);
            self.tick = tick;
            self.seed_number = seed;
            Math.seedrandom(self.seed_number);
        } else {
            if(initial_game_state != tick + "," + seed + JSON.stringify(state)) {
                // TODO: Sort everything before comparing
                console.log("Initial game state mismatch!");
            }
        }

        this.remote_peers_map[from].state_received = true;
        var done = true;
        if (self.conn_state == "peers_connected") {
            this.remote_peers.forEach(function(remote_peer) {
                if (remote_peer.id !== self.id && !remote_peer.state_received) {
                    done = false;
                }
            });
        } else {
            done = false;
        }

        if (done) {
            self.conn_state = "ready";
            console.log("conn_state: ", self.conn_state);
            self.onStartCallback(broadcast, state, self.id);
        }
    };

    this.start = function() {
        console.log("Receiving at '" + self.id + "'...");
        p.on('connection', function(conn) {
            connecting = true;
            console.log("Received new connection!");
            var remote_id = null;
            conn.on('data', function(data){
                if(remote_id !== null) {
                    receiveData(data, remote_id);
                } else if (data.id !== undefined) {
                    remote_id = data.id;
                    console.log("Accepted new connection from: ", remote_id);
                    self.unactive_remote_peers[remote_id] = {"id": remote_id, "conn": conn, "tick_done": false};
                }
            });
        });

        if (self.conn_state === "init") {
            self.connectPeer(endpoint, true);
        } else {
            Math.seedrandom(self.seed_number);
            console.log("Set seed: ", self.seed_number);
            self.onStartCallback(broadcast, null, this.id);
        }
    };
};

return {
    start : function (onStartCallback, serializeGameState, onNewClient) {
        var pc = new PeerClient(onStartCallback, serializeGameState, onNewClient);
        pc.start();
    }
};
});

