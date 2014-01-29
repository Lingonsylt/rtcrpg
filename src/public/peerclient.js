define(["peer"], function(peer) {
var start = function(onMessageCallback) {
    var remote_peers = [];
    var id = window.location.hash.substring(1).split(",")[0];
    var endpoint = null;
    if(window.location.hash.substring(1).split(",").length >= 2) {
        endpoint = window.location.hash.substring(1).split(",")[1];
    }
    var p = new peer.Peer(id, {host: 'localhost', port: 9000, key: 'secret'});

    var connectPeer = function (remote_id) {
        console.log("Connecting to '" + remote_id + "'...");

        var conn = p.connect(remote_id);
        conn.on('open', function(){
            remote_peers.push({"id": remote_id, "conn": conn});
            conn.send({"id": id});
            console.log("Connected peer: " + remote_id);
        });

        conn.on('data', function(data){
            receiveData(data);
        });
    };

    var receiveData = function (data) {
        if (data.update) {
            onMessageCallback(data.id, data["pkg"]);
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
                remote_peers.push({"id": remote_id, "conn": conn});
                var remote_peer_ids = [];
                remote_peers.forEach(function(remote_peer) {
                    remote_peer_ids.push(remote_peer.id);
                });
                conn.send({"id": id, "new_peers": remote_peer_ids});
            }
        });
    });

    if (endpoint !== null) {
        connectPeer(endpoint);
    }

    return function (message) {
        message.id = id;
        remote_peers.forEach(function(remote_peer) {
            remote_peer["conn"].send(message);
        });
    }
};

return {
    start : start
};
});

