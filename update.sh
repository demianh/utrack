#!/bin/bash

# Fetch source
git pull origin master

# Install Packages
npm install

cd src/frontend
bower install
cd ../../

# Restart Server
./start_server.sh
