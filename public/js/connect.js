window.onload = function () {
    
    // Configuring nodegame.
    node.setup('nodegame', {
	// HOST needs to be specified only 
	// if this file is located in another server
	// host: http://myserver.com,	  
        verbosity: 10,
        window: {
            promptOnleave: false,
            noEscape: true // Defaults TRUE
        },
        env: {
            auto: false,
            debug: false
        },
        events: {
	    dumpEvents: true, // output to console all fired events
            history: false // keep a record of all fired events
        },
        socket: {
	    type: 'SocketIo', // for remote connections
	    reconnection: false
	}
    });

    // Connecting to waiting room.
    if (location.search) {
      // Pass query arguments on.
      node.connect("/meritocracy", { query: location.search.substr(1) });
    }
    else {
      node.connect("/meritocracy");
    }
};