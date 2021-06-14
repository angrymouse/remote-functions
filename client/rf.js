

class RFManager{
    constructor(uri=({"http:":"ws://","https:":"wss://"}[location.protocol])+window.location.host+"/") {
        this.__socket=new WebSocket(uri)
        this.__socket.onmessage=(message)=>{
          
            message=JSON.parse(message.data.toString())

            this.__dispatch(message.type,message.data)
        };
        this.__awaiting={}
    }
    __dispatch(type,data){

        ({
"availableFuncs":()=>{
   data.forEach(name=>{
       this[name]=(...args)=>this.__callFunc(name,args)
   })
},
"functionResult":()=>{
if(!this.__awaiting[data.reqId]){return}

this.__awaiting[data.reqId][data.resultType](data.result)
delete this.__awaiting[data.reqId]
},
"error":()=>{
    console.error(data)
}
})[type]()
    };
    __send(type,data){
        this.__socket.send(JSON.stringify({ type, data}))
    };
    __callFunc(fname,args){
        return new Promise((resolve, reject) => {
             let reqId=Math.random().toString(16).substr(2);
        this.__send("callFunc",{fname,args,reqId})
        this.__awaiting[reqId]={resolve,reject}
        });
       
    }
}
export default RFManager;
