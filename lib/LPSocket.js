

function LPSocket(socket,handler) {
    this.socket = socket;
    this.handler = handler;

    this._bufferedLength = 0;
    this._queue = []; //array of buffers

    this._state = "HEADER";
    this._process = true;

    this._packet = {};
}


LPSocket.prototype.init = function() {

    this.socket.on('data', (data)=>{
        this._bufferedLength += data.length;
        this._queue.push(data);
        this._process = true;
        this._onData();
    });

    this.socket.on('received', this.handler);
}

LPSocket.prototype._onData = function() {

    while(this._process) {
        switch(this._state) {
            case "HEADER": this._getHeader();
                break;
            case "PAYLOAD": this._getPayload();
        }
    }
}

LPSocket.prototype._getHeader = function() {
    if(this._bufferedLength >= 2) {
        this._state = "PAYLOAD";
        const length = this._readBytes(2).readUInt16BE(0,true);
        this._packet.length = length;
    } else {
        this._process = false;
    }
}

LPSocket.prototype._getPayload = function() {
    if(this._bufferedLength >= this._packet.length) {
        const payload = this._readBytes(this._packet.length);
        this.socket.emit('received', payload);
        this._state = "HEADER"; //reset state to header
        this._process = false;
    } else {
        this._process = false;
    }
}

LPSocket.prototype._readBytes = function(size) {
    let result;

    this._bufferedLength -= size;

    // best case -> just return the result;
    if(size === this._queue[0].length) {
        result = this._queue.shift();
        return result;
    }

    // second best case -> just return the necessary piece
    if(size < this._queue[0].length) {
        result = this._queue[0].slice(0,size);
        this._queue[0] = this._queue[0].slice(size);
        return result;
    }

    //worst case ... loop through the queue and create buffer from it
    result = Buffer.allocUnsafe(size);
    let offset = 0;

    while(size > 0) {
        const length = this._queue[0].length;

        if(size >= length) {
            this._queue[0].copy(result,offset);
            offset += length;
            this._queue.shift();
        } else {
            this._queue[0].copy(result,offset,0,size);
            this._queue[0] = this._queue[0].slice(size);
        }

        size = size - length;
    }

    return result;
}

LPSocket.prototype._setHeader = function(length) {
    this._packet.length = length;
}

LPSocket.prototype._setPayload = function(payload) {
    this._packet.payload = payload;
}

LPSocket.prototype.send = function(message) {
    const buffer = Buffer.from(message);
    this._setHeader(buffer.length);
    this._setPayload(buffer);

    this._send();
}

LPSocket.prototype._send = function() {
    const payloadLength = Buffer.allocUnsafe(2);
    payloadLength.writeUInt16BE(this._packet.length);

    this.socket.write(payloadLength);
    this.socket.write(this._packet.payload);

    this._packet = {};
}



module.exports = LPSocket;