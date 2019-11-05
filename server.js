var ws = require('ws');
var http = require('http');
var https = require('https');
var fs = require('fs');
var express = require('express');
var app = express();


var clients = new Set();


var options = {
    key: fs.readFileSync('certs/2_www.mcyyx.com.key'),
    cert: fs.readFileSync('certs/1_www.mcyyx.com_bundle.crt')
};

var wss_server_port = (process.env.PORT + 1 || 7443);
var ssl_server = https.createServer(options, app).listen(wss_server_port, () => {
    console.log("Start WSS Server: bind => wss://0.0.0.0:" + wss_server_port);
});

var wss = new ws.Server({ server: ssl_server });

wss.on('connection', onConnection);

function onConnection(client_self, socket) {
    console.log('connection');

    let _send = this._send;

    clients.add(client_self);

    client_self.on("close", (data) => {
        clients.delete(client_self);
        this.onClose(client_self, data)
    });

    client_self.on("message", message => {
        try {
            message = JSON.parse(message);
            console.log("message.type:: " + message.type + ", \nbody: " + JSON.stringify(message));
        } catch (e) {
            console.log(e.message);
        }

        switch (message.type) {
            case 'new':
                {
                    client_self.id = "" + message.id;
                    client_self.name = message.name;
                    client_self.user_agent = message.user_agent;
                    this.updatePeers();
                }
                break;
            case 'bye':
                {
                    var session = null;
                    this.sessions.forEach((sess) => {
                        if (sess.id == message.session_id) {
                            session = sess;
                        }
                    });

                    if (!session) {
                        var msg = {
                            type: "error",
                            data: {
                                error: "Invalid session " + message.session_id,
                            },
                        };
                        _send(client_self, JSON.stringify(msg));
                        return;
                    }

                    clients.forEach((client) => {
                        if (client.session_id === message.session_id) {
                            try {

                                var msg = {
                                    type: "bye",
                                    data: {
                                        session_id: message.session_id,
                                        from: message.from,
                                        to: (client.id == session.from ? session.to : session.from),
                                    },
                                };
                                _send(client, JSON.stringify(msg));
                            } catch (e) {
                                console.log("onUserJoin:" + e.message);
                            }
                        }
                    });
                }
                break;
            case "offer":
                {
                    var peer = null;
                    clients.forEach(function (client) {
                        if (client.hasOwnProperty('id') && client.id === "" + message.to) {
                            peer = client;
                        }
                    });

                    if (peer != null) {

                        msg = {
                            type: "offer",
                            data: {
                                to: peer.id,
                                from: client_self.id,
                                media: message.media,
                                session_id: message.session_id,
                                description: message.description,
                            }
                        }
                        _send(peer, JSON.stringify(msg));

                        peer.session_id = message.session_id;
                        client_self.session_id = message.session_id;

                        let session = {
                            id: message.session_id,
                            from: client_self.id,
                            to: peer.id,
                        };
                        this.sessions.push(session);
                    }

                    break;
                }
            case 'answer':
                {
                    var msg = {
                        type: "answer",
                        data: {
                            from: client_self.id,
                            to: message.to,
                            description: message.description,
                        }
                    };

                    clients.forEach(function (client) {
                        if (client.id === "" + message.to && client.session_id === message.session_id) {
                            try {
                                _send(client, JSON.stringify(msg));
                            } catch (e) {
                                console.log("onUserJoin:" + e.message);
                            }
                        }
                    });
                }
                break;
            case 'candidate':
                {
                    var msg = {
                        type: "candidate",
                        data: {
                            from: client_self.id,
                            to: message.to,
                            candidate: message.candidate,
                        }
                    };

                    clients.forEach(function (client) {
                        if (client.id === "" + message.to && client.session_id === message.session_id) {
                            try {
                                _send(client, JSON.stringify(msg));
                            } catch (e) {
                                console.log("onUserJoin:" + e.message);
                            }
                        }
                    });
                }
                break;
            case 'keepalive':
                _send(client_self, JSON.stringify({ type: 'keepalive', data: {} }));
                break;
            default:
                console.log("Unhandled message: " + message.type);
        }
    });

    _send = (client, message) => {
        try {
            client.send(message);
        }catch(e){
            console.log("Send failure !: " + e);
        }
    }

}