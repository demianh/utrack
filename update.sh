#!/bin/bash

# use this script to update the wtrack source and install dependencies

# Fetch source
git pull origin master

# Install Packages
npm install

cd src/dashboard
bower install --allow-root
cd ../../

# Restart Server
./start_server.sh
