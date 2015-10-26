#!/bin/bash
cat config/pids|xargs kill
echo `date +%s` > config/version 
echo '' > config/pids
nohup node boot.js http.js >> /tmp/log/rr_http.log  &
nohup node boot.js api.js >> /tmp/log/rr_api.log  &
