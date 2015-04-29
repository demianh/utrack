#!/bin/bash

# Start or restart
forever stop src/backend/server.js
forever start src/backend/server.js