define(["peer", "seedrandom"], function(peer) {
var start = function(onMessageCallback, onStartCallback, onNewConnectionCallback) {
    var seed_number = Math.floor(Math.random() * 1000000) + "a";
    var remote_peers = [];
    var remote_peers_map = {};
    var id = window.location.hash.substring(1).split(",")[0];
    var endpoint = null;
    if(window.location.hash.substring(1).split(",").length >= 2) {
        endpoint = window.location.hash.substring(1).split(",")[1];
    }
    var p = new peer.Peer(id, {host: 'localhost', port: 9000, key: 'secret'});
    var onTickReadyCallback = null;

    var broadcast = function (message, _onTickReadyCallback) {
        onTickReadyCallback = _onTickReadyCallback;
        message.id = id;
        remote_peers.forEach(function(remote_peer) {
            remote_peer["conn"].send(message);
        });
    };

    var connectPeer = function (remote_id) {
        console.log("Connecting to '" + remote_id + "'...");

        var conn = p.connect(remote_id);
        conn.on('open', function(){
            console.log("Connected!");
            var new_peer = {"id": remote_id, "conn": conn, "tick_done": false};
            remote_peers.push(new_peer);
            remote_peers_map[new_peer.id] = new_peer;
            if (!endpoint) {
                onNewConnectionCallback(new_peer.id);
            }
            conn.send({"id": id});
            console.log("Connected peer: " + remote_id);
        });

        conn.on('data', function(data){
            if(endpoint && data.seed) {
                endpoint = null;
                seed_number = data["seed_number"];
                Math.seedrandom(seed_number);
                console.log("Set seed: ", data["seed_number"]);
                onStartCallback(broadcast, data.id);
            } else {
                receiveData(data);
            }
        });
    };

    var receiveData = function (data) {
        if (data.update) {
            if (!remote_peers_map[data.id]["tick_done"]) {
                remote_peers_map[data.id]["tick_done"] = data.cmds;

                var done = [];
                remote_peers.forEach(function(remote_peer) {
                    if (remote_peer["tick_done"]) {
                        done.push({"id": remote_peer["id"], "cmds":remote_peer["tick_done"], "self" : remote_peer["id"] === id});
                    }
                });
                if (done.length === remote_peers.length) {
                    remote_peers.forEach(function(remote_peer) { remote_peer["tick_done"] = false; });
                    onTickReadyCallback(done);
                }
            }
        } else if (data.new_peers) {
           data.new_peers.forEach(function(new_peer_id) {
               var is_new = false;
               if (new_peer_id !== id) {
                   is_new = true;
                   remote_peers.forEach(function(remote_peer) {
                       if (remote_peer.id === new_peer_id) {
                           is_new = false;
                       }
                   });
               }

               if (is_new) {
                   console.log("Received new peer '" + new_peer_id + "' from " + data.id);
                   connectPeer(new_peer_id);
               }
           });
        } else {
            console.log("Unknown packet: ", data);
        }
    };

    var self_peer = {"id": id, "conn": {"send":receiveData}, "tick_done": false};
    remote_peers.push(self_peer);
    remote_peers_map[self_peer.id] = self_peer;

    console.log("Receiving at '" + id + "'...");
    p.on('connection', function(conn) {
        console.log("Received new connection!");
        var remote_id = null;
        conn.on('data', function(data){
            if(remote_id !== null) {
                receiveData(data);
            } else if (data.id !== undefined) {
                remote_id = data.id;
                console.log("Accepted new connection from: ", remote_id);
                var new_peer = {"id": remote_id, "conn": conn, "tick_done": false};
                remote_peers.push(new_peer);
                remote_peers_map[new_peer.id] = new_peer;
                onNewConnectionCallback(new_peer.id);
                var remote_peer_ids = [];
                remote_peers.forEach(function(remote_peer) {
                    remote_peer_ids.push(remote_peer.id);
                });
                conn.send({"id": id, "new_peers": remote_peer_ids});
                conn.send({"id": id, "seed": true, "seed_number": seed_number});
            }
        });
    });

    if (endpoint !== null) {
        connectPeer(endpoint);
    } else {
        Math.seedrandom(seed_number);
        console.log("Set seed: ", seed_number);
        onStartCallback(broadcast);
    }
};

return {
    start : start
};
});

