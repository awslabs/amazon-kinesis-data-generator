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
var clientIdParamName = "cid",
    userPoolIdParamName = "upid",
    identityPoolIdParamName = "ipid",
    cognitoRegionParamName = "r",
    debugColl = [];

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
    var kinesis, firehose;

    $("#btnCreateData").click(function () {

        streamName = $("#streamName").val();
        rate = $("#putRate").val();
        streamType = $("#streamName :selected").parent().attr("label") === "Kinesis Streams" ? "stream" : "firehose";

        if(region === undefined || streamName === undefined || rate === undefined || rate === 0) {
            $("#errorMessage").removeClass("hidden");
            return false;
        }

        $("#errorMessage").addClass("hidden");
        createData()
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
        if(e.which === 13) $("#btnLogin").trigger("click");
    });

    $("#userName").keypress(function(e) {
        if(e.which === 13) $("#btnLogin").trigger("click");
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
    
       $("#lockrealtime").click(function() {
           $('#startendtimes').toggle(!this.checked)
       })
    });

    $(function () {
        $('[data-toggle="tooltip"]').tooltip();
    })

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

    // Initialize the big inputs table to avoid tons of ugly HTML spam...
    var pi = $("#periodic-inputs")
    for(var j = 0; j <= 23; j++) {
        var tr = $( "<tr /> " )
        pi.append(tr)
        var th = $( "<th scope='row'>"+j+"</th>" )
        tr.append(th)
        for(var k = 0; k <= 6; k++) {
            var td = $ ( "<td />")
            tr.append(td)
            mID = k+"-"+j+"-mu"
            mInput = $( "<small>Mu:</small><input type='number' min='0' class='form-control' id='"+mID+"' value='100'/>" )
            td.append(mInput)
            $("#"+mID).blur(savePeriods)
            sID = k+"-"+j+"-sig"
            sInput = $( "<small>Sigma:</small><input type='number' min='0' class='form-control' id='"+sID+"' value='10'/>" )
            td.append(sInput)
            $("#"+sID).blur(savePeriods)
        }
    }

    // Load previously-keyed periodic config
    loadPeriods()

    $("#rate-tabs").tabs();

    $(".rate-tab").on("click", function(){
        $(".nav").find(".active").removeClass("active");
        $(this).addClass("active");
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
        kinesis = new AWS.Kinesis();
        firehose = new AWS.Firehose();

        var kinesisDropDown = $("#streamName");
        kinesisDropDown.find("optgroup")
            .remove()
            .end()
            .find("option")
            .remove()
            .end();

        kinesisDropDown.append("<option id='no-streams-msg'>No destinations found in this region</option>");
        $("#btnCreateData").prop("disabled", true);

        updateStreamsList();
        updateFirehoseList();
    }

    function updateStreamsList(startStream, streamArray ) {

        if(streamArray === undefined) {
            streamArray = [];
        }

        var params = {
            Limit: 100
        };
        if(startStream !== undefined) {
            params.ExclusiveStartStreamName = startStream;
        }

        kinesis.listStreams(params, function(err, data) {
            if(err) {
                console.log(err, err.stack);
            }
            else{
                streamArray.push.apply(streamArray, data.StreamNames);
                if(data.HasMoreStreams) {
                    updateStreamsList(data.StreamNames[data.StreamNames.length - 1], streamArray);
                }
                else {
                    if(streamArray.length > 0) {
                        $("#no-streams-msg").remove();
                        var html = "<optgroup label='Kinesis Streams'>";
                        for (var n = 0; n < streamArray.length; n++) {
                            html += "<option value='" + streamArray[n] + "'>" + streamArray[n] + "</option>";
                        }
                        html += "</optgroup>";
                        $("#btnCreateData").prop("disabled", false);
                        $("#streamName").append(html);
                    }
                }
            }
        });

    }

    function updateFirehoseList(startStream, streamArray) {

        if(streamArray === undefined) {
            streamArray = [];
        }

        var params = {
            Limit: 100
        };
        if(startStream !== undefined) {
            params.ExclusiveStartDeliveryStreamName = startStream;
        }

        firehose.listDeliveryStreams(params, function(err, data) {
            if(err) {
                console.log(err, err.stack);
            }
            else{
                streamArray.push.apply(streamArray, data.DeliveryStreamNames);
                if(data.HasMoreStreams) {
                    updateFirehoseList(data.DeliveryStreamNames[data.DeliveryStreamNames.length - 1], streamArray);
                }
                else {
                    if(streamArray.length > 0) {
                        $("#no-streams-msg").remove();
                        var html = "<optgroup label='Kinesis Firehose'>";
                        for (var n = 0; n < streamArray.length; n++) {
                            html += "<option value='" + streamArray[n] + "'>" + streamArray[n] + "</option>";
                        }
                        html += "</optgroup>";
                        $("#btnCreateData").prop("disabled", false);
                        $("#streamName").append(html);
                    }
                }
            }
        });
    }

    function createData() {
        var currRate = $("ul#rate-tabs li.active").text()
        console.log("Create data index "+currRate)

        if (currRate == "Constant") {
            sendDataHandle = setInterval(createDataConstant, 1000);
        } else if (currRate == "Periodic") {
            var lockRealTime = $("#lockrealtime").is(":checked")
            if(lockRealTime) {
                sendDataHandle = setInterval(createDataPeriodic, 1000);
            } else {
                var start = $("#starttime").data("DateTimePicker").viewDate().toDate()
                var end = $("#endtime").data("DateTimePicker").viewDate().toDate()
                var tick = parseInt($("#tick-wait").val())
                var tickCount = parseInt($("#tick-count").val())
                var generator = createPeriodicDataGenerator(start, end, tickCount)
                sendDataHandle = setInterval(() => {
                    var result = generator.next()
                    if(result.done) {
                        console.log("Finished with generator.");
                        clearInterval(sendDataHandle);
                        totalRecordsSent = 0;
                        $("#recordsSentMessage").text("0 records sent to Kinesis.");
                    }
                }, tick)
            }
        }
    }

    function* createPeriodicDataGenerator(startTime, endTime, tickCount) {
        var simTime = startTime
        while(simTime <= endTime) {
            var recordsToPush = []
            for(i = 0; i<tickCount; i++) 
            {
                faker.simTime = moment(simTime)
                createDataPeriodicForTime(simTime, recordsToPush)
                simTime.setSeconds(simTime.getSeconds() + 1)
            }
            sendToKinesis(recordsToPush)
            $("#recordsSentMessage").text(totalRecordsSent.toString() + " records sent to Kinesis.  SimTime: "+simTime.toString());
            yield simTime;
        }
    }

    function normal(mu, sigma) {
        do {
            var s1 = 2.0 * Math.random() - 1.0;
            var s2 = 2.0 * Math.random() - 1.0;
            var r2 = (s1 * s1) + (s2 * s2);
        } 
        while (r2 >= 1.0 || r2 == 0.0)

        var f = Math.sqrt( -2.0 * Math.log(r2) / r2);
        var val = f * s2;

        return mu + sigma * val;
    }

    function createDataPeriodic()
    {
        createDataPeriodicForTime(new Date())
    }

    function createDataPeriodicForTime(dateTime, recordsToPush) {
        if(typeof recordsToPush === "undefined") {
            recordsToPush = []
        }
        var now = dateTime;

        var hour = now.getHours()
        var day = now.getDay()
        var minute = now.getMinutes()
    
        var muInput = "#"+day+"-"+hour+"-mu"
        var sigInput = "#"+day+"-"+hour+"-sig"

        var mu = parseInt($(muInput).val())
        var sigma = parseInt($(sigInput).val())

        if($("#smoothing").is(':checked')) {
            var prevHour;
            var prevDay;
            var nextHour;
            var nextDay;
            if(hour > 0) {
                prevHour = hour - 1
                prevDay = day
            } else {
                prevHour = 23
                if(day > 0) {
                    prevDay = day - 1
                } else {
                    prevDay = 6
                }
            }
            if(hour < 22) {
                nextHour = hour + 1;
                nextDay = day;
            } else {
                nextHour = 0;
                if(nextDay < 6) {
                    nextDay = day + 1
                } else {
                    nextDay = 0
                }
            }
        }

        prevMu = parseInt($("#"+prevDay+"-"+prevHour+"-mu").val())
        nextMu = parseInt($("#"+nextDay+"-"+nextHour+"-mu").val())

        mu = adjustForMinute(mu, minute, prevMu, nextMu)

        generatePeriodicData(day, hour, parseFloat(mu), parseFloat(sigma), recordsToPush)
    }

    // Linear "smoothing" isn't great....but it's fast to calculate, easy to understand,
    // and gets rid of the step functions that will make data far too easy to train against.
    // Just be warned that linear models will fit better to this data than real life stuff.
    function adjustForMinute(mu, minute, prevMu, nextMu) {
        if(minute == 30) {
            return mu;
        } else if(minute < 30) {
            var d = mu - prevMu;
            var p = d * (minute / 60);
            return mu - p;
        } else if(minute > 30) {
            var d = nextMu - mu;
            var p = d * (minute / 60);
            return mu + p;
        }
    }

    function createDataConstant() {
        console.log("Creating data using constant rate")
        var maxRecordsTotal = 500,
            records = [];

        //clean up line breaks, and handle older timestamp template format
        var template = getCleanedTemplate();

        for(var n = 0; n < rate; n++) {
            var data = faker.fake(template);

            if($("#zipped").is(':checked')){
                var pako = window.pako;
                data = pako.gzip(data);
            } else {
                data = data + '\n';
            }

            var record = {
                "Data": data
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

    function divide_array(l, n) {
        var newArray = [];
        for(var i = 0; i < l.length; i += n) {
          newArray.push(l.slice(i, i+n));
        }
        return newArray;
    }

    function sendToKinesis(data) {
        if (data.length > 500) {
            toSend = divide_array(data, 500)
            for(var i = 0; i < toSend.length; i++) {
                sendToKinesisChunked(toSend[i])
            }
        } 
        else {
            sendToKinesisChunked(data)
        }
    }

    function sendToKinesisChunked(data){
        if(streamType === "stream"){
            var payload = {
                "Records": data,
                "StreamName": streamName
            };

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
                {"name": "Template 3", "template": ""},
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

    function savePeriods() {
        var periods = {}
        for(var j = 0; j <= 23; j++) {
            for(var k = 0; k <= 6; k++) {
                var sigID = "#"+k+"-"+j+"-sig"
                var muID = "#"+k+"-"+j+"-mu"
                var sig = $(sigID).val()
                var mu = $(muID).val()
                periods[sigID] = sig
                periods[muID] = mu
            }
        }
        var toSave = JSON.stringify(periods)
        localStorage.setItem("periods", toSave)
    }

    function loadPeriods() {
        console.log("Loading periods")
        var periodsStr = localStorage.getItem("periods")
        var periods = JSON.parse(periodsStr)
        for(var j = 0; j <= 23; j++) {
            for(var k = 0; k <= 6; k++) {
                var sigID = "#"+k+"-"+j+"-sig"
                var muID = "#"+k+"-"+j+"-mu"
                $(sigID).val(periods[sigID])
                $(muID).val(periods[muID])
            }
        }
    }

    function generatePeriodicData(day, hour, mu, sigma, recordsToPush) {
        var count = normal(mu, sigma)


        debugColl.push(count)
        var maxRecordsTotal = 500,
            records = [];
    
        var template = getCleanedTemplate();
    
        for(var n = 0; n < count; n++) {
            var data = faker.fake(template);
    
            if($("#zipped").is(':checked')){
                var pako = window.pako;
                data = pako.gzip(data);
            } else {
                data = data + '\n';
            }
    
            var record = {
                "Data": data
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
            recordsToPush.push(...records);
        }        
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
