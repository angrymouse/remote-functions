const WebSocket = require("ws");

class RemoteFunctionsServerManager {
	constructor(source = 80, functions = []) {
		this.functions = new Map(functions.map(f => [f.name, f]))
		if (typeof source == "number") {
			this.server = new WebSocket.Server({
				port: source
			});
		} else {
			this.server = new WebSocket.Server({
				source
			});
		}
		this.server.on("connection", (socket) => {

			socket.send(JSON.stringify({
				type: "availableFuncs",
				data: Array.from(this.functions.keys())
			}))
			socket.on("message", message => {
				try {
					message = JSON.parse(message);
					({
						"callFunc": (data) => {
							this.functions.get(data.fname)(...data.args).then(res => {
							
								socket.send(JSON.stringify({
									type: "functionResult",
									data: {
										reqId: data.reqId,
										resultType: "resolve",
										result: res
									}
								}))
							}).catch(error => {
							
								socket.send(JSON.stringify({
									type: "functionResult",
									data: {
										reqId: data.reqId,
										resultType: "reject",
										result: error
									}
								}))
							})
						}
					})[message.type](message.data)
				} catch (e) {
					return socket.send(JSON.stringify({
						type: "error",
						data: e
					}))
				}

			})
		});
	}
	addFunc(func) {
		this.functions.set(func.name, async (...args) => await this.__callFunc(func, args))
	}
	async __callFunc(func, args) {
		return new Promise(async(resolve, reject) => {
			try{
			resolve(await func(...args))
			}catch(e){
				reject(e)
			}
		});
	}
}
module.exports = RemoteFunctionsServerManager;