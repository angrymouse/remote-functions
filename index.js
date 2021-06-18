class RemoteFunctionsServerManager {
    clients = [];
    __callbacks = new Map();
    __awaiting = {};
    constructor(functions = []) {
        this.functions = new Map(
            functions.map((f) => [
                f.name,
                (...args) => this.__callFunc(f, args),
            ])
        );
    }
    connectClient(sendToClient) {
        let client = {
            id: Math.random().toString(16).substr(2),
            send: sendToClient,
            functions: {},
            readyState: 0,
            readyIndicator: { resolve: () => {}, reject: () => {} },
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
                    availableFuncs: (data) => {
                        data.forEach((name) => {
                            client.functions[name] = (...args) =>
                                this.__callClientFunc(client, name, args);
                        });
                        client.send(
                            JSON.stringify({
                                type: "funcsReceived",
                                data: true,
                            })
                        );
                        client.readyState++;
                        if (client.readyState == 2) {
                            client.readyIndicator.resolve();
                        }
                    },
                    funcsReceived: (data) => {
                        client.readyState++;
                        if (client.readyState == 2) {
                            client.readyIndicator.resolve();
                        }
                    },
                    functionResult: (data) => {
                        if (!this.__awaiting[data.reqId]) {
                            return;
                        }

                        this.__awaiting[data.reqId][data.resultType](
                            data.result
                        );
                        delete this.__awaiting[data.reqId];
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

        return {
            handleMessage: (data) => {
                client._listeners.forEach((c) => {
                    c(data);
                });
            },
            disconnected: () => {
                this.clients = this.clients.filter((c) => c.id != client.id);
            },
            clientReady: () => {
                return new Promise((resolve, reject) => {
                    if (client.readyState == 2) {
                        resolve();
                    } else {
                        client.readyIndicator = { resolve, reject };
                        client.send(
                            JSON.stringify({
                                type: "availableFuncs",
                                data: Array.from(this.functions.keys()),
                            })
                        );
                    }
                });
            },
            rfc: client.functions,
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

    __callClientFunc(client, fname, args) {
        return new Promise((resolve, reject) => {
            let reqId = Math.random().toString(16).substr(2);
            client.send(
                JSON.stringify({
                    type: "callClientFunc",
                    data: {
                        fname,
                        args: this.__serializeArgs(args),
                        reqId,
                    },
                })
            );
            this.__awaiting[reqId] = {
                resolve,
                reject,
            };
        });
    }
    __serializeArgs(args) {
        return args.map(this.__serializeArg);
    }
    __serializeArg = (arg) => {
        let _this = this;

        let scenario = {
            object: () => ({
                type: "object",
                data: _this.__serializeObject(arg),
            }),
            function: function () {
                return {
                    type: "function",
                    data: _this.__registerCallback(arg),
                };
            },
        }[typeof arg];
        return scenario ? scenario() : arg;
    };
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
                            this.__callClientCallback(client, arg.data, args);
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
    __callClientCallback(client, id, args) {
        client.send(
            JSON.stringify({
                type: "callClientCallback",
                data: {
                    id,
                    args,
                },
            })
        );
    }
    __serializeObject(object) {
        return Object.entries(object)
            .map((_key, value) => this.__serializeArg(value))
            .reduce((pv, cv) => ({ ...pv, [cv[0]]: cv[1] }), {});
    }
    __registerCallback(func) {
        let foundFunction = Array.from(this.__callbacks.entries()).find(
            (funcInfo) => {
                let [, fun] = funcInfo;
                return func == fun;
            }
        );
        let id;
        if (foundFunction) {
            [id] = foundFunction;
        } else {
            id = Math.random().toString(16).substr(2);
            this.__callbacks.set(id, func);
        }
        return id;
    }
}
module.exports = RemoteFunctionsServerManager;
