#!/bin/bash

# Fetch source
git pull origin master

# Install Packages
npm install

cd src/dashboard
bower install
cd ../../

# Restart Server
./start_server.sh
