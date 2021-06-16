const EventEmitter = require("events");

class RemoteFunctionsServerManager {
    clients = [];
    constructor(functions = []) {
        this.functions = new Map(functions.map((f) => [f.name, f]));
    }
    connectClient(sendToClient) {
        let client = {
            id: Math.random().toString(16).substr(2),
            send: sendToClient,
            _listeners: [],
            listen(cb) {
                this._listeners.push(cb);
            },
            unlisten(cb) {
                this._listeners = this._listeners.filter((l) => l != cb);
            },
        };
        this.clients.push(client);
        client.listen((message) => {
            try {
                message = JSON.parse(message);
                ({
                    callFunc: (data) => {
                        this.functions
                            .get(data.fname)(
                                ...this.__deserializeArgs(client, data.args)
                            )
                            .then((res) => {
                                client.send(
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
                                client.send(
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
                return client.send(
                    JSON.stringify({
                        type: "error",
                        data: e.toString(),
                    })
                );
            }
        });
        client.send(
            JSON.stringify({
                type: "availableFuncs",
                data: Array.from(this.functions.keys()),
            })
        );
        return {
            handleMessage: (data) => {
                client._listeners.forEach((c) => {
                    c(data);
                });
            },
            disconnected: () => {
                this.clients = this.clients.filter((c) => c.id != client.id);
            },
        };
    }
    addFunc(func) {
        this.functions.set(
            func.name,
            async (...args) => await this.__callFunc(func, args)
        );
        this.clients.forEach((client) => {
            client.send(
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
    __deserializeArgs(client, args) {
        return args.map((a) => this.__deserializeArg(client, a));
    }
    __deserializeArg(client, arg) {
        if (typeof arg == "object") {
            return (
                {
                    object: () => this.__deserializeObject(client, arg.data),
                    function:
                        () =>
                        async (...args) => {
                            this.__callClientFunc(client, arg.data, args);
                        },
                }[arg.type]() || arg
            );
        } else {
            return arg;
        }
    }
    __deserializeObject(client, object) {
        return Object.entries(object)
            .map((_key, value) => this.__deserializeArg(client, value))
            .reduce((pv, cv) => ({ ...pv, [cv[0]]: cv[1] }), {});
    }
    __callClientFunc(client, id, args) {
        client.send(
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
