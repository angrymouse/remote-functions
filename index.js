const WebSocket = require("ws");

class RemoteFunctionsServerManager {
    sockets = [];
    constructor(source = 80, functions = []) {
        this.functions = new Map(functions.map((f) => [f.name, f]));
        if (typeof source == "number") {
            this.server = new WebSocket.Server({
                port: source,
            });
        } else {
            this.server = new WebSocket.Server({
                source,
            });
        }
        this.server.on("connection", (socket) => {
            socket.id = Math.random().toString(16).substr(2);
            this.sockets.push(socket);
            socket.send(
                JSON.stringify({
                    type: "availableFuncs",
                    data: Array.from(this.functions.keys()),
                })
            );
            socket.on("close", () => {
                this.sockets = this.sockets.filter((s) => s.id != socket.id);
            });
            socket.on("message", (message) => {
                try {
                    message = JSON.parse(message);
                    ({
                        callFunc: (data) => {
                            this.functions
                                .get(data.fname)(
                                    ...this.__deserializeArgs(socket, data.args)
                                )
                                .then((res) => {
                                    socket.send(
                                        JSON.stringify({
                                            type: "functionResult",
                                            data: {
                                                reqId: data.reqId,
                                                resultType: "resolve",
                                                result: res,
                                            },
                                        })
                                    );
                                })
                                .catch((error) => {
                                    socket.send(
                                        JSON.stringify({
                                            type: "functionResult",
                                            data: {
                                                reqId: data.reqId,
                                                resultType: "reject",
                                                result: error.toString(),
                                            },
                                        })
                                    );
                                });
                        },
                    }[message.type](message.data));
                } catch (e) {
                    return socket.send(
                        JSON.stringify({
                            type: "error",
                            data: e.toString(),
                        })
                    );
                }
            });
        });
    }
    addFunc(func) {
        this.functions.set(
            func.name,
            async (...args) => await this.__callFunc(func, args)
        );
        this.sockets.forEach((socket) => {
            socket.send(
                JSON.stringify({
                    type: "availableFuncs",
                    data: Array.from(this.functions.keys()),
                })
            );
        });
    }
    async __callFunc(func, args) {
        return new Promise(async (resolve, reject) => {
            try {
                resolve(await func(...args));
            } catch (e) {
                reject(e);
            }
        });
    }
    __deserializeArgs(socket, args) {
        return args.map((a) => this.__deserializeArg(socket, a));
    }
    __deserializeArg(socket, arg) {
        if (typeof arg == "object") {
            return (
                {
                    object: () => this.__deserializeObject(socket, arg.data),
                    function:
                        () =>
                        async (...args) => {
                            this.__callClientFunc(socket, arg.data, args);
                        },
                }[arg.type]() || arg
            );
        } else {
            return arg;
        }
    }
    __deserializeObject(socket, object) {
        return Object.entries(object)
            .map((_key, value) => this.__deserializeArg(socket, value))
            .reduce((pv, cv) => ({ ...pv, [cv[0]]: cv[1] }), {});
    }
    __callClientFunc(socket, id, args) {
        socket.send(
            JSON.stringify({
                type: "callClientFunc",
                data: {
                    id,
                    args,
                },
            })
        );
    }
}
module.exports = RemoteFunctionsServerManager;
