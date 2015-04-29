#!/bin/bash

# Fetch source
git pull origin master

# Install Packages
npm install

# Restart Server
./start_server.sh
