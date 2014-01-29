var id = "1";

var requestRTCDesc = function (msg, success) {
    var xhr=new XMLHttpRequest();
    xhr.open("POST","/desc/",true);
    xhr.setRequestHeader("Content-Type","application/json");
    xhr.send(JSON.stringify(msg));
    xhr.onreadystatechange = function() {
        if (xhr.readyState==4 && xhr.status === 200) {
            success(JSON.parse(xhr.responseText));
        }
    }
};

var setUpConnection = function (success) {
    console.log("Setting up RTCPeerConnection");
    var pc = new RTCPeerConnection({ iceServers: [{ url: 'stun:stun.l.google.com:19302' }] }, {"optional": [{"RtpDataChannels": true}]});
    requestRTCDesc({"action": "getoffer", "id": id}, function (response) {
        if (response["desc"] === null) {
            console.log("No offer present. Creating ice candidate...");

                console.log("Got ice candidate, creating send channel");
                var sendChannel = pc.createDataChannel("sendDataChannel", {"reliable": false});
                pc.createOffer(function (desc) {
                    console.log("Local setting local desc: ", desc);
                    pc.setLocalDescription(desc);
                    var candidates = [];
                    pc.onicecandidate = function (evt) {
                        if (evt.candidate !== null) {
                            candidates.push(evt.candidate);
                        } else {
                            console.log("Publishing local offer: ", desc);
                            requestRTCDesc({"action": "publishoffer", "id": id, "desc": {"desc" : desc, "ice": candidates}}, function (response) {
                                console.log("Offer published, waiting for answer...");
                                var waitForAnswer = function () {
                                    requestRTCDesc({"action": "getanswer", "id": id}, function (response) {
                                        if(response["desc"] === null) {
                                            console.log("No answer yet. Trying again...");
                                            setTimeout(waitForAnswer, 500);
                                        } else {
                                            console.log("Got answer: ", response["desc"]);
                                            response["desc"]["ice"].forEach(function(ice) {
                                                //pc.addIceCandidate(new RTCIceCandidate(ice));
                                            });

                                            sendChannel.onopen = function () {
                                                if(sendChannel.readyState === "open") {
                                                    console.log("Send channel ready!");
                                                    success(sendChannel);
                                                } else {
                                                    console.log("Send channel unknown state: ", sendChannel.readyState);
                                                }
                                            };
                                            var remoteDesc = new RTCSessionDescription(response["desc"]["desc"]);
                                            console.log("Local setting remote desc: ", remoteDesc);
                                            console.log("Connecting to remote host...");
                                            pc.setRemoteDescription(remoteDesc);
                                        }
                                    });
                                };
                                waitForAnswer();
                            });
                        }
                    };
                });
        } else {
            var remoteDesc = new RTCSessionDescription(response["desc"]["desc"]);
            console.log("Remote setting remote desc: ", remoteDesc);
            pc.setRemoteDescription(remoteDesc);
            response["desc"]["ice"].forEach(function(ice) {
                //pc.addIceCandidate(new RTCIceCandidate(ice));
            });
            pc.createAnswer(function (desc) {
                console.log("Remote setting local desc: ", desc);
                pc.setLocalDescription(desc);

                var candidates = [];
                pc.onicecandidate = function (evt) {
                    if (evt.candidate !== null) {
                        candidates.push(evt.candidate);
                    } else {
                        console.log("Waiting for incoming connection...");
                        pc.ondatachannel = function (evt) {
                            console.log("Got receive channel");
                            evt.channel.onopen = function () {
                                if (evt.channel.readyState === "open") {
                                    console.log("Receive channel ready!");
                                    success(evt.channel);
                                } else {
                                    console.log("Receive channel unknown state: ", evt.channel.readyState);
                                }
                            }
                        };
                        console.log("Publishing answer: ", desc);
                        requestRTCDesc({"action": "publishanswer", "id": id, "desc": {"desc": desc, "ice": candidates}}, function (response) {

                        });
                    }
                };
            });

        }
    });
};


setUpConnection(function(channel) {
    channel.onmessage = function (evt) {
        console.log("Got message: " + evt.data);
    };

    var repeatSend = function () {
        channel.send("Hello!");
        setTimeout(repeatSend, 1000);
    };
    repeatSend();
});