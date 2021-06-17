class RFManager {
    __callbacks = new Map();
    __sendQueue = [];
    __awaiting = {};
    constructor(functions = []) {
        this.__sendRaw = (data) => this.__sendQueue.push(data);
        this.__readyState = 0;
        this.__functions = new Map(
            functions.map((f) => [
                f.name,
                async (...args) => await this.__callFunc(f, args),
            ])
        );
    }
    RFPrepare(sendMessage) {
        this.__sendRaw = sendMessage;
        this.__sendQueue.forEach((message) => this.__sendRaw(message));
        this.__sendQueue = null;
        return new Promise((resolve, reject) => {
            if (this.__readyState == 2) {
                resolve();
            } else {
                this.__send(
                    "availableFuncs",
                    Array.from(this.__functions.keys())
                );

                this.__readyIndicator = { resolve, reject };
            }
        });
    }
    RFMessageReceived(message) {
        message = JSON.parse(message);

        this.__dispatch(message.type, message.data);
    }

    __dispatch(type, data) {
        ({
            availableFuncs: () => {
                data.forEach((name) => {
                    this[name] = (...args) => this.__callServerFunc(name, args);
                });
                this.__send("funcsReceived", true);
                this.__readyState++;
                if (this.__readyState == 2) {
                    this.__readyIndicator.resolve();
                    delete this.__readyIndicator;
                }
            },
            functionResult: () => {
                if (!this.__awaiting[data.reqId]) {
                    return;
                }

                this.__awaiting[data.reqId][data.resultType](data.result);
                delete this.__awaiting[data.reqId];
            },
            error: () => {
                console.error(data);
            },
            callClientCallback: () => {
                let { id, args } = data;
                let func = this.__callbacks.get(id);
                if (func) {
                    func(...this.__deserializeArgs(args));
                }
            },
            callClientFunc: () => {
                let fun = this.__functions.get(data.fname);
                if (!fun) {
                    return;
                }
                fun(...this.__deserializeArgs(data.args))
                    .then((res) => {
                        this.__send(
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
                        this.__send(
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
            funcsReceived: () => {
                this.__readyState++;
                if (this.__readyState == 2) {
                    this.__readyIndicator.resolve();
                    delete this.__readyIndicator;
                }
            },
        }[type]());
    }

    __send(type, data) {
        this.__sendRaw(
            JSON.stringify({
                type,
                data,
            })
        );
    }
    __deserializeArgs(args) {
        return args.map((a) => this.__deserializeArg(a));
    }
    __deserializeArg(arg) {
        if (typeof arg == "object") {
            return (
                {
                    object: () => this.__deserializeObject(arg.data),
                    function:
                        () =>
                        async (...args) => {
                            this.__callServerCallback(arg.data, args);
                        },
                }[arg.type]() || arg
            );
        } else {
            return arg;
        }
    }
    __deserializeObject(object) {
        return Object.entries(object)
            .map((_key, value) => this.__deserializeArg(value))
            .reduce((pv, cv) => ({ ...pv, [cv[0]]: cv[1] }), {});
    }
    __callServerCallback(id, args) {
        this.__send(
            JSON.stringify({
                type: "callServerCallback",
                data: {
                    id,
                    args: this.__serializeArgs(args),
                },
            })
        );
    }
    __callServerFunc(fname, args) {
        return new Promise((resolve, reject) => {
            let reqId = Math.random().toString(16).substr(2);
            this.__send("callFunc", {
                fname,
                args: this.__serializeArgs(args),
                reqId,
            });
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
    RFAddFunc(func) {
        this.__functions.set(
            func.name,
            async (...args) => await this.__callFunc(func, args)
        );

        this.__send(
            JSON.stringify({
                type: "availableFuncs",
                data: Array.from(this.functions.keys()),
            })
        );
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
}
export default RFManager;
