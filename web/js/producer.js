/*
Copyright 2014-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License").

You may not use this file except in compliance with the License. A copy
of the License is located at

http://aws.amazon.com/apache2.0/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific language governing
permissions and limitations under the License.
*/
const   clientIdParamName = "cid",
        userPoolIdParamName = "upid",
        identityPoolIdParamName = "ipid",
        cognitoRegionParamName = "r";

function init(){

    var streamName,
        streamType,
        rate,
        sendDataHandle,
        totalRecordsSent = 0,
        cognitoAppClientId = getCongitoConfigParameterByName(clientIdParamName),
        cognitoUserPoolId = getCongitoConfigParameterByName(userPoolIdParamName),
        cognitoIdentityPoolId = getCongitoConfigParameterByName(identityPoolIdParamName),
        cognitoRegion = getCongitoConfigParameterByName(cognitoRegionParamName),
        cognitoUser;

    $("#userPoolId").val(cognitoUserPoolId);
    $("#identityPoolId").val(cognitoIdentityPoolId);
    $("#clientId").val(cognitoAppClientId);
    $("#userPoolRegion").val(cognitoRegion);


    AWS.config.region = cognitoRegion;
    AWSCognito.config.region = cognitoRegion;

    $("#btnCreateData").click(function () {

        streamName = $("#streamName").val();
        rate = $("#putRate").val();
        streamType = $("#streamName :selected").parent().attr("label") === "Kinesis Streams" ? "stream" : "firehose";

        if(region == undefined || streamName == undefined || rate == undefined || rate == 0) {
            $("#errorMessage").removeClass("hidden");
            return false;
        }

        $("#errorMessage").addClass("hidden");
        sendDataHandle = setInterval(createData, 1000);
    });

    $("#btnCancelSendData").click( function() {
        clearInterval(sendDataHandle);
        totalRecordsSent = 0;
        $("#recordsSentMessage").text("0 records sent to Kinesis.");
    });

    $("#logoutLink").click( function() {
        cognitoUser.signOut();

        $("#password").val("");
        $("#loginForm").removeClass("hidden");
        $("#logoutLink").addClass("hidden");
        $("#unauthMessage").removeClass("hidden");
        $("#kinesisInfo").addClass("hidden");
    });


    $("#btnSaveConfiguration").click(function (e) {

        var clientId = $("#clientId").val(),
            userPoolId = $("#userPoolId").val(),
            identityPoolId = $("#identityPoolId").val(),
            userPoolRegion = $("#userPoolRegion").val();

        if(clientId && userPoolId && identityPoolId && userPoolRegion){
            $("#configErr").addClass("hidden");
            localStorage.setItem(clientIdParamName, clientId);
            localStorage.setItem(userPoolIdParamName, userPoolId);
            localStorage.setItem(identityPoolIdParamName, identityPoolId);
            localStorage.setItem(cognitoRegionParamName, userPoolRegion);
            $("#cognitoModal").modal("hide");

        }
        else {
            $("#configErr").removeClass("hidden");
        }

    });

    $("#btnTestTemplate").click(function () {

        $("#sample-records").empty();
        var template = getCleanedTemplate();
        for(var i = 0; i < 5; i++){
            var record = faker.fake(template);
            $("#sample-records").append("<p><pre>" + record + "</pre></p>");
        }
    });

    $("#password").keypress(function(e) {
        if(e.which == 13) $("#btnLogin").trigger("click");
    });

    $("#userName").keypress(function(e) {
        if(e.which == 13) $("#btnLogin").trigger("click");
    });


    $("#btnLogin").click(function() {

        //validate that the Cognito configuration parameters have been set
        if(!cognitoAppClientId || !cognitoUserPoolId || !cognitoIdentityPoolId || !cognitoRegion) {
            $("#configErr").removeClass("hidden");
            $("#configureLink").trigger("click");
            return;
        }


        //update ui
        $("#loginForm").addClass("hidden");
        $("#signInSpinner").removeClass("hidden");

        var userName = $("#userName").val();
        var password = $("#password").val();

        var authData = {
            UserName: userName,
            Password: password
        };

        var authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);

        var poolData = {
            UserPoolId: cognitoUserPoolId,
            ClientId: cognitoAppClientId
        };

        var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        var userData = {
            Username: userName,
            Pool: userPool
        };

        cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
        cognitoUser.authenticateUser( authDetails, {
            onSuccess: function(result) {
                console.log('access token + ' + result.getAccessToken().getJwtToken());

                var logins = {};
                logins["cognito-idp." + cognitoRegion + ".amazonaws.com/" + cognitoUserPoolId] = result.getIdToken().getJwtToken();
                var params = {
                    IdentityPoolId: cognitoIdentityPoolId,
                    Logins: logins
                };

                AWS.config.region = cognitoRegion;
                AWSCognito.config.region = cognitoRegion;

                AWS.config.credentials = new AWS.CognitoIdentityCredentials(params);

                AWS.config.credentials.get(function(refreshErr) {
                    if(refreshErr) {
                        console.error(refreshErr);
                    }
                    else {
                        var ec2 = new AWS.EC2();
                        ec2.describeRegions({}, function(err, data){
                            if(err){
                                if(err.code === "UnauthorizedOperation"){
                                    $("#permissionsErrorMessage").removeClass("hidden");
                                    $("#kinesisInfo").addClass("hidden");
                                }
                                console.log(err, err.stack);
                            }
                            else {
                                $("#permissionsErrorMessage").addClass("hidden");
                                $("#logoutLink").removeClass("hidden");
                                $("#loginForm").addClass("hidden");
                                $("#signInSpinner").addClass("hidden");

                                $("#region").empty();
                                for(var i = 0; i < data.Regions.length; i++){
                                    var name = data.Regions[i].RegionName;
                                    $("#region").append("<option value='" + name + "'>" + name + "</option>");
                                }
                                loadSavedTemplates(0);
                                updateKinesisList();

                                $("#unauthMessage").addClass("hidden");
                                $("#kinesisInfo").removeClass("hidden");
                            }
                        });
                    }
                });
            },
            onFailure: function(err) {
                $("#logoutLink").addClass("hidden");
                $("#loginForm").removeClass("hidden");
                $("#signInSpinner").addClass("hidden");

                alert(err);
            }
       });
    });

    $("#template-name").blur(function() {
        var index = $("ul#template-tabs li").index($("ul#template-tabs li.active"));
        updateTemplate(index);
    });

    $("#recordTemplate").blur(function() {
        var index = $("ul#template-tabs li").index($("ul#template-tabs li.active"));
        updateTemplate(index);
    });

    $("ul#template-tabs li").click(function() {
        var index = $("ul#template-tabs li").index($(this));
        loadSavedTemplates(index);
    });


    $("#region").change(function() {
        updateKinesisList();
    });

    //Insert 4 spaces in textarea when tab is typed within the Record Template
    $(document).delegate('#recordTemplate', 'keydown', function(e) {
        var keyCode = e.keyCode || e.which;

        if (keyCode == 9) {
            e.preventDefault();
            var start = $(this).get(0).selectionStart;
            var end = $(this).get(0).selectionEnd;

            // set textarea value to: text before caret + tab + text after caret
            $(this).val($(this).val().substring(0, start)
                + "    "
                + $(this).val().substring(end));

            // put caret at right position again
            $(this).get(0).selectionStart =
                $(this).get(0).selectionEnd = start + 4;
        }
    });

    function getCleanedTemplate() {
        return $("#recordTemplate").val().trim().replace(/\n/g, "").replace("{{current.timestamp}}", "{{date.now}}");
    }

    function updateKinesisList() {

        AWS.config.region = $("#region").val();

        var kinesisDropDown = $("#streamName");
        kinesisDropDown.find("optgroup")
            .remove()
            .end()
            .find("option")
            .remove()
            .end();

        kinesisDropDown.append("<option id='no-streams-msg'>No destinations found in this region</option>");

        $("#btnCreateData").prop("disabled", true);

        var kinesis = new AWS.Kinesis();
        kinesis.listStreams({}, function(err, data) {
            if(err) {
                console.log(err, err.stack);
            }
            else{
                if(data.StreamNames.length > 0) {
                    $("#no-streams-msg").remove();
                    var html = "<optgroup label='Kinesis Streams'>";
                    for(var n = 0; n < data.StreamNames.length; n++) {
                        html += "<option value='" + data.StreamNames[n] + "'>" + data.StreamNames[n] + "</option>";
                    }
                    html += "</optgroup>";
                    kinesisDropDown.append(html);
                    $("#btnCreateData").prop("disabled", false);
                }
            }
        });

        var firehose = new AWS.Firehose();
        firehose.listDeliveryStreams({}, function(err, data) {
            if(err) {
                console.log(err, err.stack);
            }
            else{
                if(data.DeliveryStreamNames.length > 0) {
                    $("#no-streams-msg").remove();
                    var html = "<optgroup label='Kinesis Firehose'>";
                    for(var n = 0; n < data.DeliveryStreamNames.length; n++) {
                        html += "<option value='" + data.DeliveryStreamNames[n] + "'>" + data.DeliveryStreamNames[n] + "</option>";
                    }
                    html += "</optgroup>";
                    kinesisDropDown.append(html);
                    $("#btnCreateData").prop("disabled", false);
                }
            }
        });
    }

    function createData() {
        var maxRecordsTotal = 500,
            records = [];

        //clean up line breaks, and a handle older timestamp template format
        var template = getCleanedTemplate();

        for(var n = 0; n < rate; n++) {
            var data = faker.fake(template);
            var record = {
                "Data": data + '\n'
            };
            if(streamType === "stream"){
                record.PartitionKey = (Math.floor(Math.random() * (10000000000))).toString();
            }
            records.push(record);
            if(records.length === maxRecordsTotal){
                sendToKinesis(records);
                records = [];
            }
        }

        if(records.length > 0){
            sendToKinesis(records);
        }

        $("#recordsSentMessage").text(totalRecordsSent.toString() + " records sent to Kinesis.");
    }

    function sendToKinesis(data){
        if(streamType === "stream"){
            var payload = {
                "Records": data,
                "StreamName": streamName
            };

            var kinesis = new AWS.Kinesis();
            kinesis.putRecords(payload, function(err, data) {
                if(err){
                    console.log(err, err.stack);
                }
                else{
                    console.log(data);
                }
            });
        } else {
            payload = {
                "Records": data,
                "DeliveryStreamName": streamName
            };

            var firehose = new AWS.Firehose();
            firehose.putRecordBatch(payload, function(err, data) {
                if(err) {
                    console.log(err, err.stack);
                }
                else {
                    console.log(data);
                }
            });
        }
        totalRecordsSent += data.length;
    }

    function loadSavedTemplates(activeTabIndex){
        var savedTemplates = JSON.parse(localStorage.getItem("templates"));
        if(savedTemplates) {
            for(var i = 0; i < 5; i++){
                $("#template-tab-" + i).html(savedTemplates[i].name);
            }
            $("#template-name").html(savedTemplates[activeTabIndex].name);
            $("#recordTemplate").val(savedTemplates[activeTabIndex].template)
        } else {
            var templates = [
                {"name": "Template 1", "template": ""},
                {"name": "Template 2", "template": ""},
                {"name": "Template 4", "template": ""},
                {"name": "Template 4", "template": ""},
                {"name": "Template 5", "template": ""}
            ];
            localStorage.setItem("templates", JSON.stringify(templates));
            loadSavedTemplates(0);
        }
    }

    function updateTemplate(templateIndex) {
        var savedTemplates = JSON.parse(localStorage.getItem("templates"));
        savedTemplates[templateIndex].name = $("#template-name").html();
        savedTemplates[templateIndex].template = $("#recordTemplate").val();
        localStorage.setItem("templates", JSON.stringify(savedTemplates));
        loadSavedTemplates(templateIndex);
    }
}

function getCongitoConfigParameterByName(name) {
    var data = getQSParameterByName(name);
    if(data == null || data == '') {
        data = localStorage.getItem(name);
        return data;
    }
    localStorage.setItem(name, data);
    return data;
}


function getQSParameterByName(name, url) {
    if (!url) {
        url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}