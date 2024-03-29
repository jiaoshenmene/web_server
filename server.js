const WebSocket = require('ws');//引入模块

const wss = new WebSocket.Server({ port: 7080 }, () => {
    console.log("ws://0.0.0.0:" + 7080);
});//创建一个WebSocketServer的实例，监听端口8080
var clients = new Set();
var sessions = [];

function updatePeers() {
    var peers = [];

    clients.forEach(function (client) {
        var peer = {};
        if (client.hasOwnProperty('id')) {
            peer.id = client.id;
        }
        if (client.hasOwnProperty('name')) {
            peer.name = client.name;
        }
        if (client.hasOwnProperty('user_agent')) {
            peer.user_agent = client.user_agent;
        }
        if (client.hasOwnProperty('session_id')) {
            peer.session_id = client.session_id;
        }
        peers.push(peer);
    });

    var msg = {
        type: "peers",
        data: peers,
    };

    clients.forEach(function (client) {
        send(client, JSON.stringify(msg));
    });
}

function onClose(client_self) {
    console.log('close');
    var session_id = client_self.session_id;
    if (session_id !== undefined) {
        for (let i = 0; i < this.sessions.length; i++) {
            let item = this.sessions[i];
            if (item.id == session_id) {
                this.sessions.splice(i, 1);
                break;
            }
        }
    }

    var msg = {
        type: "leave",
        data: client_self.id,
    };


    clients.forEach(function (client) {
        if (client != client_self)
            send(client, JSON.stringify(msg));
    });

    this.updatePeers();
}

wss.on('connection', function connection(client_self) {

    clients.add(client_self);

    client_self.on("close", (data) => {
        clients.delete(client_self);

    });

    client_self.on('message', function (message) {
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
                    updatePeers();
                }
                break;
            case 'bye':
                {
                    var session = null;
                    sessions.forEach((sess) => {
                        if (sess.id == message.session_id) {
                            session = sess;
                        }
                    });

                    if (!session) {
                        var msg = {
                            type: "error", data: {
                                error: "Invalid session " + message.session_id,
                            }
                        };
                        send(client_self, JSON.stringify(msg));
                        break;
                    }
                }

            case "offer":
                {
                    var peer = null;
                    clients.forEach(function (client) {
                        if (client.hasOwnProperty('id') &&
                            client.id === "" + message.to) {
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
                        send(peer, JSON.stringify(msg));

                        peer.session_id = message.session_id;
                        client_self.session_id = message.session_id;

                        let session = {
                            id: message.session_id,
                            from: client_self.id,
                            to: peer.id
                        };

                        sessions.push(session);
                    }

                }
                break;

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
                        if (client.id === "" + message.to &&
                            client.session_id === message.session_id) {
                            send(client, JSON.stringify(msg));
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
                            send(client, JSON.stringify(msg));
                        }
                    })
                }
                break;
            case 'keepalive':
                {
                    send(client_self, JSON.stringify({ type: 'keepalive', data: {} }));
                }
                break;
        }
    });//当收到消息时，在控制台打印出来，并回复一条信息
});


function send(client, message) {
    try {
        client.send(message);
    } catch (e) {
        console.log("Send failure !: " + e);
    }
}