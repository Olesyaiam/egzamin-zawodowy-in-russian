#!/bin/bash
sudo mkdir -p server/storage/logs server/storage/ramdisk_tmpfs
sudo chown -R 33:33 server/storage
sudo chmod -R u+rwX,g+rwX server/storage
