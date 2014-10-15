/**
* jQuery.fn.MultiFeedParser v1.1.0 | 2014-10-15
* Control center for all your polling requests. jQuery.ajax() required
* by Helcon Mabesa
* MIT license http://opensource.org/licenses/MIT
**/

var MultiFeedParser = (function(AJAX_REQUEST){
    
    var CONST = {
        logName: "[Feed Parser]",
        jsonpParam: "callback",
        minRefreshRate: 0.50 // minimum refresh rate - 0.5 mins === 30 seconds
    };
    
    /**
     * @param config {object}
     * (required)
     * config.feeds - {object} feed information
     *
     * (optional)
     * config.logging - {boolean} enable/disable console logging (default is false)
     * config.initOnLoad - {boolean} when enabled, it will load the feeds on initialization; when disabled, you will have to call event.reload() to initiate (default is true)
     * config.cacheTime - {integer} define the browser cache buster in minutes (default is nothing)
     */
    
    var App = function(config) {
        
        config = config || {}; // empty object
        
        var self = this;
        self.__vars = {};
        
        var v = self.__vars;
        
        // set up variables
        v._config = config; // user initial config
        v._fn = {}; // function holder
        v._data = {}; // data holder
        v._xhr = {}; // xhr requests holder
        v._callStack = {}; // function call stack for types
        v._initExe = {}; // feed initial execution boolean for types
        v._refreshObj = {};
        
        // add public calls
        self.event = new Events(self);
        
        // logging?
        v._fn.log = (v._config.logging) ? log : function(){};
        
        // initialize -
        var initOnLoad = (typeof v._config.initOnLoad === "boolean" && !v._config.initOnLoad) ? false : true; // by default, true if not defined
        
        var i, feeds = (v._config && v._config.feeds) ? v._config.feeds : false;
        
        if (initOnLoad && feeds) {
            for (i in feeds) {
                loadFeed(v,i);
                
                // set up refresh rates
                if (feeds[i].refresh) {
                    setRefreshRate(self,i,feeds[i]);
                }
                
            }
        }
        
    };
    
    /**
     * Events Prototype
     * All the accessible public event methods
     *
     */
    var Events = (function(){
        
        var Event = function(root) {
            this.__vars = {};
            var v = this.__vars;
            v.root = root;
        };
        
        /**
         * event.reload
         * Reloads the feed types
         *
         * @param types - {string} feed type name/s; if defined, it will only load the specific ones; if undefined it will reload all types (optional)
         *
         * Sample:
         * event.reload();
         * event.reload("feed1");
         * event.reload("feed1 feed2");
         *
         */
        Event.prototype.reload = function(types) {
            var i, x,
                hasLoad = false,
                self = this,
                root = self.__vars.root,
                v = root.__vars,
                feeds = (v._config && v._config.feeds) ? v._config.feeds : false,
                arr = [];
            
            if (!feeds) { return false; }
            
            // check if there is a refresh already set
            var setRefresh = function(type) {
                if (!v._refreshObj[type]) {
                    setRefreshRate(root,type,feeds[type]);
                }
            };
            
            // types
            if (typeof types === "string") {
                types = (trimStr(types)).replace(/\s+/g," ");
                arr = types.split(" ");
            }
            
            if (arr.length > 0) { // types
                for (x = 0; x < arr.length; x++) {
                    if (feeds[arr[x]]) {
                        v._fn.log(CONST.logName + " Reloading {type}: '" + arr[x] + "'");
                        loadFeed(v,arr[x]);
                        setRefresh(arr[x]);
                        hasLoad = true;
                    }
                }
            } else { // no types passed, reload all feeds
                v._fn.log(CONST.logName + " Reloading all feed {type}");
                for (i in feeds) {
                    loadFeed(v,i);
                    setRefresh(i);
                }
                hasLoad = true;
            }
            
        };
        
        /**
         * event.addFeed
         * Adds a feed after initialization of the script
         *
         * {arguments} options:
         * 1. Basic json/jsonp feed:
         * @param arg[0] - {string} feed type name
         * @param arg[1] - {string} url of the feed
         *
         * 2. Advanced:
         * @param arg[0] - {object} Same config options as initialization
         *
         * Sample:
         * event.addFeed("feed1","http://foo.bar.com");
         * event.addFeed({ type:"feed1", url:"http://foo.bar.com", refresh:60 });
         *
         */
        Event.prototype.addFeed = function() {
            var self = this,
                root = self.__vars.root,
                v = root.__vars,
                feeds = (v._config && v._config.feeds) ? v._config.feeds : {},
                args = arguments;
            
            var config = { type: false, url: false };
            
            if (typeof args[0] === "string" && typeof args[1] === "string") {
                config.type = args[0];
                config.url = args[1];
            } else if (typeof args[0] === "object" && args[0].type && args[0].url) {
                config = args[0];
            }
            
            if (!config.type || !config.url) { // check if no type
                v._fn.log(CONST.logName + " Cannot fire event.addFeed(). Missing config {type} or {url}.");
                return false;
            } else if (feeds[config.type]) { // check if type already exists
                v._fn.log(CONST.logName + " Cannot fire event.addFeed() for {type}: '" + config.type + "'. This type already exists.");
                return false;
            }
            
            // store
            var i, cfg = {};
            for (i in config) {
                if (i !== "type") { cfg[i] = config[i]; }
            }
            
            if (!root.__vars._config.feeds) { root.__vars._config.feeds = {}; }

            root.__vars._config.feeds[config.type] = cfg;
            loadFeed(v,config.type);
            
            // set up refresh rates
            if (config.refresh) {
                setRefreshRate(root,config.type,cfg);
            }
        };
        
        /**
         * event.removeFeed
         * Remove a feed and all its instances and dependencies
         *
         * @param type - {string} type id of the feed; you can remove multiple feeds by splitting with spaces
         *
         * Sample:
         * event.removeFeed("feed1");
         * event.removeFeed("feed1 feed2 feed3");
         *
         */
        Event.prototype.removeFeed = function(type) {
            var self = this,
                root = self.__vars.root,
                v = root.__vars,
                hasFeeds = (root.__vars._config && root.__vars._config.feeds) ? true : false;
            
            if (!hasFeeds || typeof type !== "string") { return false; }
            
            var removeType = function(val) {
                if (!root.__vars._config.feeds[val]) { return false; }
                
                // nullify
                root.__vars._config.feeds[val] = null;
                root.__vars._initExe[val] = null;
                root.__vars._callStack[val] = null;
                root.__vars._refreshObj[val] = null;
                
                // attempt to delete
                try {
                    delete root.__vars._config.feeds[val];
                    delete root.__vars._initExe[val];
                    delete root.__vars._callStack[val];
                    delete root.__vars._refreshObj[val];
                } catch(err) {
                    // do nothing
                }
                
                v._fn.log(CONST.logName + " Notice: Feed removed for {type}: '" + val + "'");
            };
            
            // if multiples
            type = (trimStr(type)).replace(/\s+/g," ");
            var sp = type.split(" ");

            for (var i = 0; i < sp.length; i++) {
                removeType(sp[i]);
            }

        };
        
        /**
         * event.onLoad
         * Bind a function to the onload event of a type
         * Different from event.getData() - this will trigger on event.reload();
         *
         * {argument} options:
         * 1. Basic:
         * @param args[0] - {string} feed type name
         * @param args[1] - {function} callback function to bind
         *
         * 2. Advanced:
         * @param args[0] - {object} contains the basic arguments
         *
         * Sample:
         * event.onLoad("feed1",function(data) { alert(data); });
         * event.onload({ type:"feed1", callback:function(data) { alert(data); });
         *
         */
        Event.prototype.onLoad = function() {
            var self = this,
                root = self.__vars.root,
                v = root.__vars,
                feeds = (v._config && v._config.feeds) ? v._config.feeds : {},
                args = setLoaderArgs(arguments);
            
            if (!args.type || !args.callback || !feeds[args.type]) { return false; }
            var type = args.type, callback = args.callback;
            
            // stack up callbacks
            if (!v._callStack[type]) { v._callStack[type] = []; }
            v._callStack[type].push(callback);
            
            if (v._initExe[type]) { // if called after initial feed load, run it!
                callback(v._data[type]);
            }
            
        };
        
        /**
         * event.getData
         * Bind a function to get the latest type's data.
         * Different from event.onLoad() - this will only trigger only when explicitly called
         *
         * {argument} options:
         * 1. Basic:
         * @param args[0] - {string} feed type name
         * @param args[1] - {function} callback function to bind
         *
         * 2. Advanced:
         * @param args[0] - {object} contains the basic arguments
         *
         * Sample:
         * event.onLoad("feed1",function(data) { alert(data); });
         * event.onload({ type:"feed1", callback:function(data) { alert(data); });
         *
         */
        Event.prototype.getData = function() {
            var self = this,
                root = self.__vars.root,
                v = root.__vars,
                feeds = (v._config && v._config.feeds) ? v._config.feeds : {},
                args = setLoaderArgs(arguments);
            
            if (!args.type || !args.callback) { return false; }
            var type = args.type, callback = args.callback;
            
            // attempt
            var cntr = 0,
                max = 120,
                timeoutObj;
            
            var attempt = function() {
                if (typeof v._data[type] !== "undefined") {
                    callback(v._data[type]);
                } else if (cntr <= max) {
                    clearTimeout(timeoutObj);
                    timeoutObj = setTimeout(function(){
                        attempt();
                    },250);
                    cntr++;
                }
            };

            attempt();

        };
        
        return Event;
        
    }());
    
    /*** PRIVATE ***/
    /**
     * Refresh rate helper function
     * Sets the refresh rate in seconds
     *
     * @param self - {object} prototype of the feed instance
     * @param type - {string} feed type name
     * @param info - {object} config information of the type
     *
     */
    var setRefreshRate = function(self, type, info) {
        // check refresh rate
        var refresh = (!isNaN(info.refresh) && parseFloat(info.refresh) >= CONST.minRefreshRate) ? (info.refresh).toFixed(2) : false;
        if (!refresh) {
            log(CONST.logName + " Warning: Cannot set refresh for {type}: '" + type + "' refresh rate less than minimum rate allowed.");
            return false;
        }
        
        // refresh in seconds
        refresh = refresh * 60000;
        
        clearInterval(self.__vars._refreshObj[type]);
        self.__vars._refreshObj[type] = setInterval(function(){
            if (self.event && typeof self.event.reload === "function") {
                self.event.reload(type);
            } else {
                log(CONST.logName + " Warning: Cannot find event.reload(). Reload for {type}: '" + type + "' not fired.");
            }
        },refresh);
    };
    
    /**
     * Feed loader helper
     * Loads the feed via jQuery.ajax()
     *
     * @param vars - {object} variables of the feed instance
     * @param type - {string} feed type name
     *
     */
    var loadFeed = function(vars, type) {
        var feeds = vars._config.feeds,
            info = feeds[type] || false;
        
        // make sure there's information about the type
        if (!info) { return false; }
        
        // get the feed url
        var url = (function(){
            var ret = false;
            
            if (typeof info === "string") {
                ret = info;
            } else if (info.url) {
                ret = info.url;
            }
            
            return ret;
        }());
        
        // make sure there's a url
        if (!url) { log(CONST.logName + " URL not defined for feed {type}: '" + type + "'"); return false; }
        
        // check what data type it is
        var dataType = (function(){
            var ret = "json", jsonpCallback = getJSONP(url);
            
            if (typeof info.jsonpCallback === "string" || jsonpCallback) {
                ret = "jsonp";
            } else if (info.type && inDataType(info.type)) {
                ret = info.type;
            }
            
            ret = ret.toLowerCase();
            return ret;
        }());
        
        // set up configs for $.ajax
        var ajaxConfig = {};
        
        switch (dataType) {
            
            case "json":
                ajaxConfig = {
                    dataType: "json",
                    cache: true,
                    async: true,
                    success: function(data) {
                        commonSuccessFN(data);
                    }
                };
                break;
            
            case "jsonp":
                var urlCallback = getJSONP(url), callback = useJSONPCallback(type, ((typeof info.jsonpCallback === "string") ? info.jsonpCallback : false), urlCallback);
                
                window[callback.name] = function(data) {
                    commonSuccessFN(data);
                };
            
                ajaxConfig = {
                    dataType: "script",
                    async: true,
                    cache: true
                };
                
                // jsonp callback
                if (!urlCallback) {
                    ajaxConfig.data = {};
                    ajaxConfig.data[callback.param] = callback.name;
                }
                
                
                break;
                
            case "xml":
                ajaxConfig = {
                    dataType: "xml",
                    cache: true,
                    async: true,
                    success: function(data) {
                        commonSuccessFN(data);
                    }
                };
                break;
            
        }
        
        // url
        ajaxConfig.url = url;
        
        // set up browser cache buster
        (function(){
            var cacheTime = (vars._config.cacheTime && !isNaN(vars._config.cacheTime)) ? parseFloat(vars._config.cacheTime) : false;
            if (cacheTime) {
                if (!ajaxConfig.data) { ajaxConfig.data = {}; }
                ajaxConfig.data["cb"] = cacheBuster(cacheTime);
            }
        }());
        
        
        // try to abort any existing ajax calls
        if (dataType !== "jsonp" && vars._xhr[type]) {
            try {
                if (typeof vars._xhr[type].abort === "function") {
                    vars._xhr[type].abort();
                }
            } catch(err) {
                // do nothing
            }
        }
        
        vars._xhr[type] = AJAX_REQUEST(ajaxConfig);
        
        // INTERNAL PRIVATE FUNCTIONS
        function commonSuccessFN(data) {
            // normalize
            var normFN = getNormalizationFN(info.normalize, feeds), normalized = (normFN) ? normFN(data) : data;
            
            // store
            vars._data[type] = normalized;
            
            if (!vars._initExe[type]) { vars._initExe[type] = true; }
            
            triggerStack(vars._callStack[type],vars._data[type]);
        }
        
    };
    
    /**
     * Function Stack trigger helper
     * Runs the stack of functions
     *
     */
    var triggerStack = function(stack,data) {
        if (!isArray(stack)) { return false; }
        for (var x = 0; x < stack.length; x++) {
            if (typeof stack[x] === "function") { stack[x](data); }
        }
    };
    
    /**
     * Loader Arguments helper
     * common arguments parser for event.getData and event.onLoad
     *
     */
    var setLoaderArgs = function(args) {
        var type = false,
            callbackFN = false;
        
        // type
        if (typeof args[0] === "string") {
            type = args[0];
        } else if (typeof args[0] === "object" && !isArray(args[0])) {
            type = (args[0].type) ? args[0].type : false;
        }
        
        // callbackFN
        if (typeof args[1] === "function") {
            callbackFN = args[1];
        }
        
        var obj = { type:type, callback:callbackFN };
        return obj;
        
    };
    
    /**
     * Normalization function helper
     * Checks to see if there is a normalization function to a feed type
     *
     */
    var getNormalizationFN = function(val,feeds) {
        var i, ret = false;
        
        if (typeof val === "function") {
            ret = val;
        } else if (typeof val === "string") {
            
            for (i in feeds) {
                if (val === i && typeof feeds[i].normalize === "function") {
                    ret = feeds[i].normalize; break;
                }
            }
            
        }
        
        return ret;
    };
    
    /**
     * JSONP callback helper
     * Checks whether to use option1 or option2 callback parameters
     *
     */
    var useJSONPCallback = function(type, opt1,opt2) {
        var ret = { param:"callback" };
        
        if (opt1 && opt1.split("=").length === 2) { // check if the string is a param pair
            var sp = opt1.split("=");
            ret.param = sp[0];
            ret.name = sp[1];
        } else if (opt1) { // if not a param pair, assume the query param is callback
            ret.name = opt1;
        } else if (opt2) {
            ret.name = opt2;
        } else {
            ret.name = "jsonp" + type;
        }
        
        return ret;
    };
    
    /**
     * Ajax types helper
     * Checks whether the ajax data type is supported
     *
     */
    var inDataType = function(type) {
        var x,
            ret = false,
            types = ["jsonp","json","xml","html","text","script"];

        for (x = 0; x < types.length; x++) {
            if (types[x] === type.toLowerCase()) { ret = true; break; }
        }
    };
    
    /**
     * JSONP callback helper
     * Gets the jsonp callback parameter from the url
     *
     */
    var getJSONP = function(url) { // check for default param "callback"
        var x,
            ret = false,
            sp = url.split("?"),
            search = sp[1];
        
        if (search) {
            var arr = ((search.toLowerCase()).indexOf(CONST.jsonpParam + "=") > -1) ? search.split("&") : [];
            for (x = 0; x < arr.length; x++) {
                var pair = arr[x].split("=");
                if (pair[0].toLowerCase() === CONST.jsonpParam) {
                    ret = decodeURI(pair[1]); break;
                }
            }
        }
        
        return ret;
    };
    
    // logger
    var log = function() {
        var loggerON = true;
        if (loggerON && window.console) {
            try {
                return console.log.apply(console, arguments);
            } catch(err) {
                console.log(arguments);
            }
        }
    };
    
    // cachebuster
    var cacheBuster = function(freq) {
        freq = freq || false;
        var date = new Date(), str = date.getFullYear().toString() + (date.getMonth()+1).toString() + date.getDate().toString(),
            hr = date.getHours()+1, min = date.getMinutes();
        str += hr.toString() + ((freq && !isNaN(freq)) ? (Math.floor(min/parseFloat(freq))).toString() : "");
        return str;
    };
    
    // array check
    var isArray = function(val) {
        val = val || false;
        return Object.prototype.toString.call(val) === "[object Array]";
    };
    
    // right/left trim
    var trimStr = function(val) {
        val = (val || "").replace(/^\s+|\s+$/g,"");
        return val;
    };
    
    return App;
    
}(

    (function($){

        return $.ajax;

    }(jQuery))
));