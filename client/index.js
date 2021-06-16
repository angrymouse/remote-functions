class RFManager {
    __functions = new Map();
    __awaiting = {};
    constructor(sendMessage) {
        this.__sendRaw = sendMessage;
        this.__ready = false;
    }
    prepare() {
        return new Promise((resolve, reject) => {
            if (this.__ready) {
                resolve();
            } else {
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
                    this[name] = (...args) => this.__callFunc(name, args);
                });
                this.__ready = true;
                if (this.__readyIndicator) {
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
            callClientFunc: () => {
                let { id, args } = data;
                let func = this.__functions.get(id);
                if (func) {
                    func(...args);
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

    __callFunc(fname, args) {
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
                    data: _this.__registerFunction(arg),
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
    __registerFunction(func) {
        let foundFunction = Array.from(this.__functions.entries()).find(
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
            this.__functions.set(id, func);
        }
        return id;
    }
}
export default RFManager;
