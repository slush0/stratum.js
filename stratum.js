// goog.provide("stratum");

stratum = {};

stratum.Connection = (function() {

    function Connection(adapter) {
        this.adapter = adapter;
        this.counter = 0;
        this.callbacks = {};
        this.notificationHandlers = {};
    };

    Connection.prototype._getId = function() {
        return (this.counter++).toString();
    };

    Connection.prototype.send = function(methodName, params, cb) {
        var id = this._getId();
        this.callbacks[id] = cb;
        this.adapter.send(JSON.stringify({method:methodName, params:params, id:id}));
    };

    Connection.prototype.close = function() {
        this.adapter.close();
    };

    Connection.prototype.addEventListener = function(notificationName, handler) {
        if (!this.notificationHandlers[notificationName]) {
            this.notificationHandlers[notificationName] = [];
        }
        this.notificationHandlers[notificationName].push(handler);
    };

    Connection.prototype._fireNotificationHandlers = function(notificationName, responseParams) {
        var handlers;
        if (handlers = this.notificationHandlers[notificationName]) {
            for (var i=0; i<handlers.length; i++) {
                handlers[i].call(this, new stratum.NotificationEvent(notificationName, responseParams));
            }
        }
    };

    Connection.prototype.acceptResponse = function(response) {
        var messages, objMessage, id, i;
        if (typeof response === "string") {
            messages = stratum.util.parseResponseToMessages(response), objMessage, id, i;
        } else {
            messages = [response];
        }
        for (i=0; i<messages.length; i++) {
            objMessage = stratum.util.parseMessage(messages[i]);
            if (stratum.util.serverMessageIsResponse(objMessage)) {
                id = objMessage.id;
                if (this.callbacks[id]) {
                    this.callbacks[id](response.data);
                }
            } else {
                this._fireNotificationHandlers(objMessage.method, objMessage.params);
            }
        }
    };

    return Connection;

}());


stratum.NotificationEvent = function NotificationEvent(type, data) {
    this.type = type;
    this.data = data;
};


stratum.MessageFormatError = function MessageFormatError(message) {
    this.message = message;
};

stratum.MessageFormatError.prototype = Error.prototype;


stratum.util = (function() {

    return {

        parseResponseToMessages : function(strResponse) {
            return strResponse.split("\n");
        },

        serverMessageIsResponse : function(objMessage) {
            return objMessage.id !== null;
        },

        parseMessage : function(message) {
            var msgObject = message;
            var E = stratum.MessageFormatError;

            if ((typeof message !== "string") && (typeof message !== "object")) {
                throw new E("Message can be either object or non-empty string");
            }
            if (!message) {
                throw new E("Message can be either object or non-empty string");
            }
            if (typeof message === "string") {
                try {
                    msgObject = JSON.parse(message);
                } catch (e) {
                    throw new E("Can't parse string message: "+message);
                }
            } else {
                msgObject = message;
            }
            if (msgObject.id !== null) {
                if (!msgObject.id || (typeof msgObject.id !== "string" && typeof msgObject.id !== "number")) {
                    throw new E("Message .id must be non-empty string or a number");
                }
            }
            return msgObject;
        }

    }

}());

stratum.Connection.Adapter = (function() {

    function Adapter() {
    };

    var abstr = function() {
        throw new Error("This method is abstract, override it.");
    };

    Adapter.prototype.send = abstr;
    Adapter.prototype.close = abstr;

    return Adapter;

}());

stratum.Connection.PollingAdapter = (function() {

    function PollingAdapter(url, responseCallback) {
        this.url = url;
        this.boundProcessResponse = this.processResponse.bind(this);
        this.responseCallback = responseCallback;
        this.requestMessages = [];
        this.requestActive = false;
    };

    var base = stratum.Connection.Adapter.prototype;
    PollingAdapter.prototype = Object.create(base);

    function formatMessages(messages) {
        return JSON.stringify({messages:messages});
    };

    PollingAdapter.prototype.flush = function() {
        if (!this.requestActive) {
            this.requestActive = true;
            this.makeRequest(this.url, formatMessages(this.requestMessages), this.boundProcessResponse);
            this.requestMessages = [];
        }
    };

    PollingAdapter.prototype.processResponse = function(httpState, responseText) {
        this.requestActive = false;
        this.responseCallback(responseText);
    };

    PollingAdapter.prototype.tick = function() {
        this.flush();
    };

    PollingAdapter.prototype.send = function(strMessage) {
       this.requestMessages.push(strMessage);
       this.flush();
    };

    PollingAdapter.prototype.makeRequest = function(url, payload, callbackFunction) {
        var request = new XMLHttpRequest();

        request.onreadystatechange = function() {
            if (request.readyState==4) {
                callbackFunction(request.responseText);
                request = null;
                callbackFunction = null;
            }
        };

        request.open("POST", url, true);
        request.setRequestHeader('Content-type', 'application/stratum');
        request.setRequestHeader('Connection', 'close');
        request.open("GET", url, true);
        request.send(payload);
    };

    return PollingAdapter;

}());




stratum.Connection.create = (function() {



    function createAdapter() {

    };

    return function create() {

    };

}());
