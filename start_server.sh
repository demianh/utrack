#!/bin/bash

# use this script to start (or restart) the backend

# kill old phantomjs instances
killall phantomjs

# Start or restart
forever stop src/backend/server.js
forever start src/backend/server.js