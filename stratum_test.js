sinon = require('sinon');

suite("stratum", function() {

    test("ns exists", function() {
        ok(stratum);
    });

    suite("Connection", function() {

        test("can be instantiated", function() {
            ok(new stratum.Connection() instanceof stratum.Connection);
        });
        
        suite("transport", function() {

            var adapter, connection;

            test("is being passed .send() calls", function() {
                var adapterMessage = {};
                adapter = {send:function(strMessage) { adapterMessage = JSON.parse(strMessage); }};
                var params = [1,2];
                connection = new stratum.Connection(adapter);
                connection.send("methodName", params);
                ok(adapterMessage.method, "methodName");
                ok(Array.isArray(adapterMessage.params));
                for (var i=0; i<params.length; i++) {
                    ok(adapterMessage.params[i] === params[i]);
                }
            });

            test("adds .id property to transport json-encoded strings that go to adapter.send()", function() {
                var adapterMessage = {};
                adapter = {send:function(strMessage) { adapterMessage = JSON.parse(strMessage); }};
                var params = [1,2];
                connection = new stratum.Connection(adapter);
                connection.send("methodName", params);
                ok(adapterMessage.id);
            });

            test(".id property is string", function() {
                var adapterMessage = {};
                connection = new stratum.Connection({send:function(strMessage) { adapterMessage = JSON.parse(strMessage); }});
                connection.send("methodName");
                ok(typeof adapterMessage.id === "string");
            });

            test("sends unique request ids", function() {
                var ids = [];
                adapter = {send:function(strMessage) { ids.push(JSON.parse(strMessage).id); }};
                var params = [];
                connection = new stratum.Connection(adapter);
                connection.send("methodName", params);
                connection.send("methodName", params);
                ok(ids[0] !== ids[1]);
            });

            test("is being passed .close() calls", function() {
                adapter = {close:spy()};
                (new stratum.Connection(adapter)).close();
                ok(adapter.close.called);
            });

            suite("acceptResponse()", function() {
                test("exists", function() {
                   ok(typeof new stratum.Connection().acceptResponse == "function");
                });
            });

            suite("throws exceptions", function() {
                test("on malformed message", function() {
                    var c = new stratum.Connection();
                    var E = stratum.Connection.MessageFormatError;
                    prevent(function(){ c.acceptResponse(); }, E);
                    prevent(function(){ c.acceptResponse(null); }, E);
                    prevent(function(){ c.acceptResponse(undefined); }, E);
                    prevent(function(){ c.acceptResponse("Non-JSON string"); }, E);
                    prevent(function(){ c.acceptResponse("{}"); }, E);
                });
            });

            test("accepts wellformed message", function() {
                var c = new stratum.Connection();
                c.acceptResponse("{\"id\":1}");
                c.acceptResponse({id:1});
                c.acceptResponse({id:"1"});
            });

            test("accepts response consisting of messages divided by enter", function() {
                var c = new stratum.Connection();
                c.acceptResponse("{\"id\":1}\n{\"id\":2}");
            });

        });

        suite("notifications", function() {
            var c, handler;
            setup(function() {
                c = new stratum.Connection();
                handler = spy();
            });

            test("can be attached by .addEventListener", function() {
                c.addEventListener("some.notification.name", function() { });
            });

            test("handlers are called on response messages with .id === null", function() {
                var notificationName = "some.notification.name";
                c.addEventListener(notificationName, handler);
                c.acceptResponse({id:null, method:"some.notification.name"});
                ok(handler.called)
            });

        });

        suite("matches messages by id", function() {
           var client, send, cb;
           setup(function() {
               send = spy();
               cb = spy();
               client = new stratum.Connection({send:send});
           });
           test("in simple request/response case", function() {
               client.send("method", [1,2,3], cb);
               var adapterMessageObj = JSON.parse(send.firstCall.args[0]);
               client.acceptResponse({id:adapterMessageObj.id, data:"data"});
               ok(cb.firstCall.args[0], "data");
           });
        });

    });

    suite("Abstract", function() {
        test("exist", function() {
            ok(new stratum.Connection.Adapter() instanceof stratum.Connection.Adapter);
        });
        test("has default methods and they throw", function() {
            var a = new stratum.Connection.Adapter();
            ok(a.close);
            ok(a.send);
            prevent(function(){ a.close(); });
            prevent(function(){ a.send(); });
        });
    });

    suite("Polling adapter", function() {
        test("is an Adapter", function() {
            ok(new stratum.Connection.PollingAdapter() instanceof stratum.Connection.Adapter);
        });

        suite("sends requests", function() {
            var a;
            setup(function() {
                a = new stratum.Connection.PollingAdapter("url", null);
                a.makeRequest = sinon.spy();
            });
            test("without calling .flush()", function() {
                a.send("String message");
                ok(a.makeRequest.called);
            });
            test("with right arguments", function() {
                a.send("String message");
                a.flush();
                ok(a.makeRequest.firstCall.args[0], "url");
                ok(JSON.parse(a.makeRequest.firstCall.args[1]).messages.length, 1);
                ok(typeof a.makeRequest.firstCall.args[2], "function");
            });

        });

        suite("XmlHttpRequests", function() {
            var a, sandbox;
            setup(function() {
                sandbox = sinon.sandbox.create();
                stratum.XmlHttpRequest = sinon.FakeXMLHttpRequest;
                a = new stratum.Connection.PollingAdapter("url", null);
            });
            test("Content-Type", function() {
                ok(typeof sinon.FakeXMLHttpRequest, "function");
            });
            teardown(function() {
            });
        });

        suite("responses", function() {
            var onResponse, makeRequest, a;
            setup(function() {
                onResponse = sinon.spy();
                a = new stratum.Connection.PollingAdapter("url", onResponse);
                a.makeRequest = sinon.spy();
            });
            test("are tunnelled to onResponse argument", function() {
                a.send("String message");
                a.makeRequest.firstCall.args[2]("ok", "response");
                ok(onResponse.firstCall.args[0], "response");
            });
        });

        suite("periodically", function() {
            var a;
            setup(function() {
                a = new stratum.Connection.PollingAdapter("url");
                a.makeRequest = sinon.spy();
            });
            test("sends requests on tick", function() {
                a.tick();
                ok(a.makeRequest.calledOnce);
            });
            test("won't make request while another one active", function() {
                a.tick();
                a.tick();
                ok(a.makeRequest.calledOnce);
            });
        });
    });

    suite("util", function() {
       test("message with id === null is not a respose", function() {
           ok(!stratum.util.serverMessageIsResponse({id:null}));
       });
        test("responses are split by enter", function() {
            ok(stratum.util.parseResponseToMessages("foo\nbar\nbaz").length, 3);
        });
    });

});