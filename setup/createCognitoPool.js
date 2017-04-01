'use strict';

var aws = require('aws-sdk');
var AmazonCognitoIdentity = require('amazon-cognito-identity-js');
var async = require('async');


exports.createPoolAndUser = function(event, context) {

    if (event.RequestType == "Delete") {
        sendResponse(event, context, "SUCCESS");
        return;
    }


    var region = event.ResourceProperties.Region,
        userName = event.ResourceProperties.Username,
        password = event.ResourceProperties.Password,
        authRoleName = event.ResourceProperties.AuthRoleName,
        authRoleArn = event.ResourceProperties.AuthRoleArn,
        unauthRoleName = event.ResourceProperties.UnauthRoleName,
        unauthRoleArn = event.ResourceProperties.UnauthRoleArn,
        userPoolId = null,
        identityPoolId = null,
        clientAppId = null;

    aws.config.region = region;
    var cognitoProvider = new aws.CognitoIdentityServiceProvider(),
        cognitoIdentity = new aws.CognitoIdentity();


    async.waterfall([
        createUserPool,
        createUserPoolClient,
        signUpUser,
        confirmSignUp,
        createIdentityPool,
        setIdentityPoolRoles,
        updateRoles
    ], function (err, result) {
        if(err) {
            console.log(err);
            sendResponse(event, context, "FAILED", err);
        }
        else {
            var response = {
                Querystring: "upid=" + userPoolId + "&ipid=" + identityPoolId + "&cid=" + clientAppId + "&r=" + region
            };

            sendResponse(event, context, "SUCCESS", response);
        }

    });


    function createUserPool(callback) {

        var params = {
            PoolName: "Kinesis Data-Generator Users",
            Policies: {
                PasswordPolicy: {
                    MinimumLength: 6,
                    RequireLowercase: false,
                    RequireNumbers: true,
                    RequireSymbols: false,
                    RequireUppercase: false
                }
            }
        };

        cognitoProvider.createUserPool(params, function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                userPoolId = data.UserPool.Id;
                console.log("User Pool Created.  User Pool ID: " + userPoolId);
                callback(null);
            }
        });
    }

    function createUserPoolClient(callback) {

        var params = {
            ClientName: "Kinesis Data Generator",
            UserPoolId: userPoolId
        };

        cognitoProvider.createUserPoolClient(params, function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                clientAppId = data.UserPoolClient.ClientId;
                console.log("Client App Created: Client App ID: " + clientAppId);
                callback(null);
            }
        });
    }

    function signUpUser(callback) {

        var poolData = {
            UserPoolId: userPoolId,
            ClientId: clientAppId
        };

        var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

        userPool.signUp(userName, password, null, null, function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                console.log("User " + userName + " created.");
                callback(null);
            }
        });
    }

    function confirmSignUp(callback) {


        var params = {
            Username: userName,
            UserPoolId: userPoolId
        };
        cognitoProvider.adminConfirmSignUp(params, function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                console.log("User " + userName + " confirmed.");
                callback(null);
            }
        });
    }

    function createIdentityPool(callback) {
        var params = {
            AllowUnauthenticatedIdentities: false,
            IdentityPoolName: "KinesisDataGeneratorUsers",
            CognitoIdentityProviders: [
                {
                    ClientId: clientAppId,
                    ProviderName: "cognito-idp." + region + ".amazonaws.com/" + userPoolId
                }
            ]
        };

        cognitoIdentity.createIdentityPool(params, function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                identityPoolId = data.IdentityPoolId;
                console.log("Identity pool created.  Identity Pool ID:  " + identityPoolId);
                callback(null);
            }
        });
    }

    function setIdentityPoolRoles(callback) {

        var params = {
            IdentityPoolId: identityPoolId,
            Roles: {
                authenticated: authRoleArn,
                unauthenticated: unauthRoleArn
            }
        };

        cognitoIdentity.setIdentityPoolRoles(params, function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                console.log("Updated identity pool roles.");
                callback(null);
            }
        });
    }

    function updateRoles(callback) {

        var policyDoc = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        "Federated": "cognito-identity.amazonaws.com"
                    },
                    Action: "sts:AssumeRoleWithWebIdentity",
                    Condition: {
                        StringEquals: {
                            "cognito-identity.amazonaws.com:aud": identityPoolId
                        },
                        "ForAnyValue:StringLike": {
                            "cognito-identity.amazonaws.com:amr": "authenticated"
                        }
                    }
                }
            ]
        };


        var params = {
            PolicyDocument: JSON.stringify(policyDoc),
            RoleName: authRoleName
        };

        var iam = new aws.IAM();
        iam.updateAssumeRolePolicy(params, function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                console.log("Updated policy for authenticated role.");
                params['RoleName'] = unauthRoleName;
                iam.updateAssumeRolePolicy(params, function (err, data) {
                    if (err) {
                        callback(err);
                    }
                    else {
                        console.log("Updated policy for unauthenticated role.");
                        callback(null, "Done");
                    }
                });
            }
        });
    }


    function sendResponse(event, context, responseStatus, responseData) {

        var responseBody = JSON.stringify({
            Status: responseStatus,
            Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
            PhysicalResourceId: context.logStreamName,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: responseData
        });

        console.log("RESPONSE BODY:\n", responseBody);

        var https = require("https");
        var url = require("url");

        var parsedUrl = url.parse(event.ResponseURL);
        var options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.path,
            method: "PUT",
            headers: {
                "content-type": "",
                "content-length": responseBody.length
            }
        };

        console.log("SENDING RESPONSE...\n");

        var request = https.request(options, function(response) {
            console.log("STATUS: " + response.statusCode);
            console.log("HEADERS: " + JSON.stringify(response.headers));
            // Tell AWS Lambda that the function execution is done
            //context.done();
        });

        request.on("error", function(error) {
            console.log("sendResponse Error:" + error);
            // Tell AWS Lambda that the function execution is done
            //context.done();
        });

        // write data to request body
        request.write(responseBody);
        request.end();
    }

}