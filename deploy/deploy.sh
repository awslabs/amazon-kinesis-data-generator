#!/bin/bash

# Upload to the main bucket
aws s3 cp ../setup/cognito-setup.yaml s3://aws-kdg-tools/cognito-setup.yaml
aws s3 cp ../setup/datagen-cognito-setup.zip s3://aws-kdg-tools/datagen-cognito-setup.zip
