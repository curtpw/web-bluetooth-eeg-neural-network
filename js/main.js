
/*******************************************************************************************************************
 *********************************************** WEB BLUETOOTH *****************************************************
 *******************************************************************************************************************/

//sensor data object
var state = {};

var dataType = "FIR";
var secondDataSet = false;
// Web Bluetooth connection -->
$( document ).ready(function() {
    button = document.getElementById("connect");
    message = document.getElementById("message");
});

var _this;

var sendCommandFlag = false; //global to keep track of when command is sent back to device
//let commandValue = new Uint8Array([0x01,0x03,0x02,0x03,0x01]);   //command to send back to device
let commandValue = new Uint8Array([0x99]); //command to send back to device
//connection flag
var bluetoothDataFlag = false;

if ( 'bluetooth' in navigator === false ) {
    button.style.display = 'none';
    message.innerHTML = 'This browser doesn\'t support the <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API" target="_blank">Web Bluetooth API</a> :(';
}

const services = {
    controlService: {
        name: 'control service',
        uuid: '0000a000-0000-1000-8000-00805f9b34fb'
    }
}

const characteristics = {
    commandReadCharacteristic: {
        name: 'command read characteristic',
        uuid: '0000a001-0000-1000-8000-00805f9b34fb'
    },
    commandWriteCharacteristic: {
        name: 'command write characteristic',
        uuid: '0000a002-0000-1000-8000-00805f9b34fb'
    },
    deviceDataCharacteristic: {
        name: 'eeg data characteristic',
        uuid: '0000a003-0000-1000-8000-00805f9b34fb'
    }
}



class ControllerWebBluetooth {
    constructor(name) {
        _this = this;
        this.name = name;
        this.services = services;
        this.characteristics = characteristics;
        this.standardServer;
    }

    connect() {
        return navigator.bluetooth.requestDevice({
            filters: [{
                        name: this.name
                    },
                    {
                        services: [services.controlService.uuid]
                    }
                ]
            })
            .then(device => {
                console.log('Device discovered', device.name);
                return device.gatt.connect();
            })
            .then(server => {
                console.log('server device: ' + Object.keys(server.device));

                this.getServices([services.controlService, ], [characteristics.commandReadCharacteristic, characteristics.commandWriteCharacteristic, characteristics.deviceDataCharacteristic], server);
            })
            .catch(error => {
                console.log('error', error)
            })
    }

    getServices(requestedServices, requestedCharacteristics, server) {
        this.standardServer = server;

        requestedServices.filter((service) => {
            if (service.uuid == services.controlService.uuid) {
                _this.getControlService(requestedServices, requestedCharacteristics, this.standardServer);
            }
        })
    }

    getControlService(requestedServices, requestedCharacteristics, server) {
        let controlService = requestedServices.filter((service) => {
            return service.uuid == services.controlService.uuid
        });
        let commandReadChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandReadCharacteristic.uuid
        });
        let commandWriteChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandWriteCharacteristic.uuid
        });

        // Before having access to eeg, EMG and Pose data, we need to indicate to the Myo that we want to receive this data.
        return server.getPrimaryService(controlService[0].uuid)
            .then(service => {
                console.log('getting service: ', controlService[0].name);
                return service.getCharacteristic(commandWriteChar[0].uuid);
            })
            .then(characteristic => {
                console.log('getting characteristic: ', commandWriteChar[0].name);
                // return new Buffer([0x01,3,emg_mode,eeg_mode,classifier_mode]);
                // The values passed in the buffer indicate that we want to receive all data without restriction;
                //  let commandValue = new Uint8Array([0x01,0x03,0x02,0x03,0x01]);
                //this could be config info to be sent to the wearable device
                let commandValue = new Uint8Array([0x99]);
                //   characteristic.writeValue(commandValue); //disable initial write to device
            })
            .then(_ => {

                let deviceDataChar = requestedCharacteristics.filter((char) => {
                    return char.uuid == characteristics.deviceDataCharacteristic.uuid
                });

                console.log('getting service: ', controlService[0].name);
                _this.getdeviceData(controlService[0], deviceDataChar[0], server);

            })
            .catch(error => {
                console.log('error: ', error);
            })
    }

    sendControlService(requestedServices, requestedCharacteristics, server) {
        let controlService = requestedServices.filter((service) => {
            return service.uuid == services.controlService.uuid
        });
        let commandReadChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandReadCharacteristic.uuid
        });
        let commandWriteChar = requestedCharacteristics.filter((char) => {
            return char.uuid == characteristics.commandWriteCharacteristic.uuid
        });

        return server.getPrimaryService(controlService[0].uuid)
            .then(service => {
                console.log('getting service: ', controlService[0].name);
                return service.getCharacteristic(commandWriteChar[0].uuid);
            })
            .then(characteristic => {
                console.log('getting write command to device characteristic: ', commandWriteChar[0].name);
                // return new Buffer([0x01,3,emg_mode,eeg_mode,classifier_mode]);
                // The values passed in the buffer indicate that we want to receive all data without restriction;
                let commandValue = new Uint8Array([0x99]);
                getConfig();
                commandValue[0] = targetCommand;

                console.log("CONFIG target:" + activeTarget + "  command:" + commandValue[0]);
                characteristic.writeValue(commandValue);
            })
            .then(_ => {

                //  let deviceDataChar = requestedCharacteristics.filter((char) => {return char.uuid == characteristics.deviceDataCharacteristic.uuid});
                console.log("COMMAND SENT TO DEVICE");
                sendCommandFlag = false;
                //   console.log('getting service: ', controlService[0].name);
                //  _this.getdeviceData(controlService[0], deviceDataChar[0], server);

            })
            .catch(error => {
                sendCommandFlag = false;
                console.log("COMMAND SEND ERROR");
                console.log('error: ', error);
            })
    }


    handleDeviceDataChanged(event) {
        //byteLength of deviceData DataView object is 20.
        // deviceData return {{orientation: {w: *, x: *, y: *, z: *}, accelerometer: Array, gyroscope: Array}}

        let deviceData = event.target.value;

  /*      if(dataType == "FFT"){
        //log base 10 values of eeg frequency bands are recieved so we have to take the inverse log to get our signal --> 10^x is inverse of log(x) base 10
	    	let deltaWave = Math.pow(10, (event.target.value.getUint8(0) / 10) + (event.target.value.getUint8(1) / 1000) + (event.target.value.getUint8(2) / 100000) );
	    	let thetaWave = Math.pow(10, (event.target.value.getUint8(3) / 10) + (event.target.value.getUint8(4) / 1000) + (event.target.value.getUint8(5) / 100000) );
	    	let alphaWave = Math.pow(10, (event.target.value.getUint8(6) / 10) + (event.target.value.getUint8(7) / 1000) + (event.target.value.getUint8(8) / 100000) );
	    	let betaWave = Math.pow(10, (event.target.value.getUint8(9) / 10) + (event.target.value.getUint8(10) / 1000) + (event.target.value.getUint8(11) / 100000) );
	        let EMGWave = Math.pow(10, (event.target.value.getUint8(12) / 10) + (event.target.value.getUint8(13) / 1000) + (event.target.value.getUint8(14) / 100000) );
	    } else if(dataType == "FIR"){ */
	    	let deltaWave = (event.target.value.getUint8(0) / 100) + (event.target.value.getUint8(1) / 10000) + (event.target.value.getUint8(2) / 1000000);
	    	let thetaWave = (event.target.value.getUint8(3) / 100) + (event.target.value.getUint8(4) / 10000) + (event.target.value.getUint8(5) / 1000000);
	    	let alphaWave = (event.target.value.getUint8(6) / 100) + (event.target.value.getUint8(7) / 10000) + (event.target.value.getUint8(8) / 1000000);
	    	let betaWave = (event.target.value.getUint8(9) / 100) + (event.target.value.getUint8(10) / 10000) + (event.target.value.getUint8(11) / 1000000);
	        let EMGWave = (event.target.value.getUint8(12) / 100) + (event.target.value.getUint8(13) / 10000) + (event.target.value.getUint8(14) / 1000000);

	        let deltaWave1 = (event.target.value.getUint8(0) / 100) + (event.target.value.getUint8(1) / 10000);
	    	let thetaWave1 = (event.target.value.getUint8(2) / 100) + (event.target.value.getUint8(3) / 10000);
	    	let alphaWave1 = (event.target.value.getUint8(4) / 100) + (event.target.value.getUint8(5) / 10000);
	    	let betaWave1 = (event.target.value.getUint8(6) / 100) + (event.target.value.getUint8(7) / 10000);
	        let EMGWave1 = (event.target.value.getUint8(8) / 100) + (event.target.value.getUint8(9) / 10000);

	        let deltaWave2 = (event.target.value.getUint8(10) / 100) + (event.target.value.getUint8(11) / 10000);
	    	let thetaWave2 = (event.target.value.getUint8(12) / 100) + (event.target.value.getUint8(13) / 10000);
	    	let alphaWave2 = (event.target.value.getUint8(14) / 100) + (event.target.value.getUint8(15) / 10000);
	    	let betaWave2 = (event.target.value.getUint8(16) / 100) + (event.target.value.getUint8(17) / 10000);
	        let EMGWave2 = (event.target.value.getUint8(18) / 100) + (event.target.value.getUint8(19) / 10000);
	//    }

    	console.log("first BLE packet vals: " + event.target.value.getUint8(0) + " " + event.target.value.getUint8(1) + " " + event.target.value.getUint8(2));
    	console.log("Combined delta BLE vals: " + ((event.target.value.getUint8(0) / 10) + (event.target.value.getUint8(1) / 1000) ) );
    	console.log("raw eeg (d1,t1,a1,b1,emg1,d2,t2,a2,b2,emg2): " + deltaWave1 + " " + thetaWave1 + " " + alphaWave1 + " " + betaWave1 + " " + EMGWave1 +  " " + deltaWave2 + " " + thetaWave2 + " " + alphaWave2 + " " + betaWave2 + " " + EMGWave2);

        //for recording
     //   console.log("[" + deltaWave1 + ", " + thetaWave1 + ", " + alphaWave1 + ", " + betaWave1 + ", " + EMGWave1 +  "],[" + deltaWave2 + ", " + thetaWave2 + ", " + alphaWave2 + ", " + betaWave2 + ", " + EMGWave2 + "],");

        state = {
            delta: deltaWave,
            theta: thetaWave,
            alpha: alphaWave,
            beta: betaWave,
            emg: EMGWave,

            delta1: deltaWave1,
            theta1: thetaWave1,
            alpha1: alphaWave1,
            beta1: betaWave1,
            emg1: EMGWave1,

            delta2: deltaWave2,
            theta2: thetaWave2,
            alpha2: alphaWave2,
            beta2: betaWave2,
            emg2: EMGWave2,
        }

        //send data to device if device asks for it - we send it a couple times to be sure
        if (sendCommandFlag) {
            //this.standardServer = server;
            for (var i = 0; i < 3; i++) {
                //  sendControlService();
                _this.sendControlService([services.controlService, ], [characteristics.commandReadCharacteristic, characteristics.commandWriteCharacteristic, characteristics.deviceDataCharacteristic], _this.standardServer);
            }
            sendCommandFlag = false;
        }
        _this.onStateChangeCallback(state);
    }

    onStateChangeCallback() {}

    getdeviceData(service, characteristic, server) {
        return server.getPrimaryService(service.uuid)
            .then(newService => {
                console.log('getting characteristic: ', characteristic.name);
                return newService.getCharacteristic(characteristic.uuid)
            })
            .then(char => {
                char.startNotifications().then(res => {
                    char.addEventListener('characteristicvaluechanged', _this.handleDeviceDataChanged);
                })
            })
    }
    onStateChange(callback) {
        _this.onStateChangeCallback = callback;
    }
}

/*******************************************************************************************************************
 *********************************************** INITIALIZE *********************************************************
 ********************************************************************************************************************/
var testSignalFlag = false;

//sensor array sample data
var sensorDataArray = new Array(6).fill(0);

//master session data array of arrays
var sensorDataSession = [];

//sensor array sample data FOR CUSTOM TRAINING
var NNTrueDataArray = new Array;
var NNFalseDataArray = new Array;

var NNArchitecture = 'none';
var numInputs = 4;

var getSamplesFlag = 0;
var getSamplesTypeFlag = 0; //0=none 1=NN1T 2=NN1F 3=NN2T 4=NN2F

//do we have a trained NN to apply to live sensor data?
var haveNNFlag = false;
var trainNNFlag = false;
var activeNNFlag = false;

//NN scores
var scoreArray = new Array(1).fill(0);

var oldScore = 0;

var initialised = false;
var timeout = null;

function testSignal(){
	while(testSignalFlag){
		setInterval(function() {
			//dfdf
		}, 200); // throttle 200 = 5Hz limit
	}
}

$(document).ready(function() {

    /*******************************************************************************************************************
     *********************************************** WEB BLUETOOTH ******************************************************
     ********************************************************************************************************************/

    //Web Bluetooth connection button and ongoing device data update function
    button.onclick = function(e) {
        var sensorController = new ControllerWebBluetooth("EEGlasses");
        sensorController.connect();

        //on bluetooth notification value update ie new data over bluetooth
        sensorController.onStateChange(function(state) {
            bluetoothDataFlag = true;
        });

        //check for new data every X milliseconds - this is to decouple execution from Web Bluetooth actions
        setInterval(function() {
            //     bluetoothDataFlag = getBluetoothDataFlag();

            if (bluetoothDataFlag == true || secondDataSet == true) {

                timeStamp = new Date().getTime();

                //load data into global array
                sensorDataArray = new Array(6).fill(0);

                if(dataType == "FFT"){
        		//log base 10 values of eeg frequency bands are recieved so we have to take the inverse log to get our signal --> 10^x is inverse of log(x) base 10
			    	state.delta = Math.pow(10, state.delta);
			    	state.theta = Math.pow(10, state.theta);
			    	state.alpha = Math.pow(10, state.alpha);
			    	state.beta = Math.pow(10, state.beta);
			    	state.emg = Math.pow(10, state.emg);
			    } /*else if(dataType == "FIR"){ 
			    	state.delta = state.delta * 100;
			    	state.theta = state.theta * 100;
			    	state.alpha = state.alpha * 100;
			    	state.beta = state.beta * 100;
			    	state.emg = state.emg * 100;
			    } */
			    if(bluetoothDataFlag == true){
            		secondDataSet = true;
            	
	                sensorDataArray[0] = state.delta1.toFixed(3);
	                sensorDataArray[1] = state.theta1.toFixed(3);
	                sensorDataArray[2] = state.alpha1.toFixed(3);
	                sensorDataArray[3] = state.beta1.toFixed(3);
	                sensorDataArray[4] = state.emg1.toFixed(3);
	                sensorDataArray[5] = 0;       
	                sensorDataArray[6] = timeStamp;
	            } else if(secondDataSet == true){
	            	secondDataSet = false;

	            	sensorDataArray[0] = state.delta2.toFixed(3);
	                sensorDataArray[1] = state.theta2.toFixed(3);
	                sensorDataArray[2] = state.alpha2.toFixed(3);
	                sensorDataArray[3] = state.beta2.toFixed(3);
	                sensorDataArray[4] = state.emg2.toFixed(3);
	                sensorDataArray[5] = 0;       
	                sensorDataArray[6] = timeStamp;
	            }

                //update time series chart with normalized values
                var rawDeltaChart = sensorDataArray[0];
                var rawThetaChart = sensorDataArray[1];
                var rawAlphaChart = sensorDataArray[2];
                var rawBetaChart  = sensorDataArray[3];
                var rawEMGChart  =  sensorDataArray[4];

                //sensor values in bottom 2/3 of chart , 1/10 height each
                rawDeltaChart = (rawDeltaChart / 0.5) + 2 * 0.1;
                rawThetaChart = (rawThetaChart / 0.5) + 1 * 0.1;
                rawAlphaChart = (rawAlphaChart / 0.5) + 0 * 0.1;
                rawBetaChart  = (rawBetaChart  / 4) + 6 * 0.1;
                rawEMGChart  = (rawEMGChart  / 3) + 4 * 0.1;

                lineDelta.append(timeStamp, rawDeltaChart);
                lineTheta.append(timeStamp, rawThetaChart);
                lineAlpha.append(timeStamp, rawAlphaChart);
                lineBeta.append(timeStamp, rawBetaChart);
                lineEMG.append(timeStamp, rawEMGChart);



                //if data sample collection has been flagged
                //  getSensorData();
                if (getSamplesFlag > 0) {
                    collectData();
                } else if (trainNNFlag) {
                    //don't do anything
                } else {
                    if (haveNNFlag && activeNNFlag) { //we have a NN and we want to apply to current sensor data
                        getNNScore();
                    } 
                }

                displayData();
                bluetoothDataFlag = false;
            }

        }, 200); // throttle 200 = 5Hz limit
    }


    /*******************************************************************************************************************
    **************************************** STREAMING SENSOR DATA CHART ***********************************************
    *******************************************************************************************************************/

    //add smoothie.js time series streaming data chart
    var chartHeight = 350;
    var chartWidth = $(".streaming-data").width(); //$(window).width();

    $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');

    var streamingChart = new SmoothieChart({/*  grid: { strokeStyle:'rgb(125, 0, 0)', fillStyle:'rgb(60, 0, 0)', lineWidth: 1, millisPerLine: 250, verticalSections: 6, }, labels: { fillStyle:'rgb(60, 0, 0)' } */ });

    streamingChart.streamTo(document.getElementById("chart-canvas"), 300 /*delay*/ ); //delay by one second because data aquisition is slow

    var lineDelta = new TimeSeries();
    var lineTheta = new TimeSeries();
    var lineAlpha = new TimeSeries();
    var lineBeta = new TimeSeries();
    var lineEMG = new TimeSeries();
    var lineNN = new TimeSeries();


    streamingChart.addTimeSeries(lineDelta,  {strokeStyle: 'rgb(255, 255, 0)', lineWidth: 4 });
    streamingChart.addTimeSeries(lineTheta,  {strokeStyle: 'rgb(185, 76, 255)',   lineWidth: 4 });
    streamingChart.addTimeSeries(lineAlpha,  {strokeStyle: 'rgb(255, 127, 0)',   lineWidth: 4 });
    streamingChart.addTimeSeries(lineBeta,   {strokeStyle: 'rgb(7, 185, 252)', lineWidth: 4 });
    streamingChart.addTimeSeries(lineEMG,    {strokeStyle: 'rgb(246, 70, 91)', lineWidth: 4 });
    streamingChart.addTimeSeries(lineNN,    {strokeStyle: 'rgb(72, 244, 68)',   lineWidth: 5 });


    //min/max streaming chart button
    $('#circleDrop').click(function() {

        $('.card-middle').slideToggle();
        $('.close').toggleClass('closeRotate');

        var chartHeight = $(window).height() / 1.2;
        var chartWidth = $(window).width();

        if ($("#chart-size-button").hasClass('closeRotate')) {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + chartHeight + '"></canvas>');
        } else {
            $("#streaming-data-chart").html('<canvas id="chart-canvas" width="' + chartWidth + '" height="' + 100 + '"></canvas>');
        }

        //hide controls
        $("#basic-interface-container, #hand-head-ui-container, #nn-slide-controls, .console, #interface-controls, #dump-print, #record-controls").toggleClass("hide-for-chart");
        //redraw chart
        streamingChart.streamTo(document.getElementById("chart-canvas"), 350 /*delay*/ );
    });

    //numerical data display
    function displayData() {
        var deltaElement =    document.getElementsByClassName('delta-data')[0];
        var thetaElement =    document.getElementsByClassName('theta-data')[0];
        var alphaElement =    document.getElementsByClassName('alpha-data')[0];
        var betaElement = 	  document.getElementsByClassName('beta-data')[0];
        var emgElement =     document.getElementsByClassName('emg-data')[0];

        deltaElement.innerHTML =      	((sensorDataArray[0] * 160000) - 80000).toFixed(2);
        thetaElement.innerHTML =      	((sensorDataArray[1] * 160000) - 80000).toFixed(2);
        alphaElement.innerHTML =      	((sensorDataArray[2] * 160000) - 80000).toFixed(2);
        betaElement.innerHTML =  		((sensorDataArray[3] * 160000) - 80000).toFixed(2);
        emgElement.innerHTML =          ((sensorDataArray[4] * 160000) - 80000).toFixed(2); 
    }

    function collectData() {
        console.log("web bluetooth sensor data:");
        console.dir(sensorDataArray);

        //add sample to set
        sensorDataSession.push(sensorDataArray);

        if (getSamplesTypeFlag == 1) {
            NNTrueDataArray.push(sensorDataArray);
            $('.message-nn-true').html(NNTrueDataArray.length);
        } else if (getSamplesTypeFlag == 2) {
            NNFalseDataArray.push(sensorDataArray);
            $('.message-nn-false').html(NNFalseDataArray.length);
        } 

        //countdown for data collection
        getSamplesFlag = getSamplesFlag - 1;
    }


    /*******************************************************************************************************************
     *********************************************** NEURAL NETWORKS ****************************************************
     ********************************************************************************************************************/
    /**
     * Attach synaptic neural net components to app object
     */
    var nnRate =        $("#rate-input").val();
    var nnIterations =  $("#iterations-input").val();
    var nnError =       $("#error-input").val();

    // ************** NEURAL NET 
    var Neuron = synaptic.Neuron;
    var Layer = synaptic.Layer;
    var Network = synaptic.Network;
    var Trainer = synaptic.Trainer;
    var Architect = synaptic.Architect;

    //** LSTM Options etc. **/
    /*    
const lstmOptions = {
        peepholes: Layer.connectionType.ALL_TO_ALL,
        hiddenToHidden: false,
        outputToHidden: false,
        outputToGates: false,
        inputToOutput: true,
    };
    const neuralNet = new Architect.LSTM(4, 4, 4, 1, lstmOptions);  
    */
    //LSTM options: https://github.com/cazala/synaptic/issues/217 
    //https://github.com/cazala/synaptic/issues/101
    //** END LSTM Options etc. **/

    var neuralNet = new Architect.Perceptron(4, 4, 4, 1);
    var trainer = new Trainer(neuralNet);
    var trainingData;


    function getNNScore() {
        var feedArray = new Array(1).fill(0);
        var scoreArray = new Array(1).fill(0);
        var timeStamp = new Date().getTime();
        var displayScore;

        feedArray[0] = sensorDataArray[1];
        feedArray[1] = sensorDataArray[2];

        if (numInputs > 2) feedArray[2] = sensorDataArray[3];
            
        if (numInputs > 3) feedArray[3] = sensorDataArray[4];
            
        //make sure we are in bounds of normalization
        for(var k = 0; k < numInputs; k++){
        	if(feedArray[k] > 1) feedArray[k] = 1;
        	if(feedArray[k] < 0) feedArray[k] = 0;
        }

        // use trained NN or loaded NN
        if (haveNNFlag && activeNNFlag ) {
            scoreArray = neuralNet.activate(feedArray);
        } else if (loadNNFlag) {
            scoreArray = neuralNetwork1(feedArray);
        }

        displayScore = (scoreArray[0].toFixed(4) * 100 + oldScore*2) / 3; //smooth
        oldScore = displayScore;
        displayScore = displayScore.toFixed(2);

        console.log("NN FEED ARRAY: " + feedArray);
        console.log("NN SCORE ARRAY: " + scoreArray);
        $(".message-nn-score").html(displayScore + '%');
        var rawlineNNChart = scoreArray[0].toFixed(4);
        rawlineNNChart = (rawlineNNChart / 3) + 0.8;
        lineNN.append(timeStamp, rawlineNNChart);
    }



    /**************************** TRAIN NN ******************************/
    function trainNN() {
        var processedDataSession = new Array;
        var falseDataArray = new Array;
        var trueDataArray = new Array;
        var combinedTrueFalse = new Array(13).fill(0);
        trainingData = new Array;

        var rawNNArchitecture = $("#nn-architecture").val();
        numInputs = parseInt(rawNNArchitecture.charAt(0)); 

        nnRate = $("#rate-input").val();
        nnIterations = $("#iterations-input").val();
        nnError = $("#error-input").val();

        trueDataArray = NNTrueDataArray;
        falseDataArray = NNFalseDataArray;


        //combine true and false data
        for (var j = 0; j < trueDataArray.length; j++) {
            combinedTrueFalse = trueDataArray[j];
            combinedTrueFalse[12] = 1; //true
            processedDataSession.push(combinedTrueFalse);
        }
        for (var k = 0; k < falseDataArray.length; k++) {
            combinedTrueFalse = falseDataArray[k];
            combinedTrueFalse[12] = 0; //false
            processedDataSession.push(combinedTrueFalse);
        }

        

        var getArchitect;
    /*    if (rawNNArchitecture == '2:1') {
            getArchitect = new Architect.LSTM(2, 1);
        } else if (rawNNArchitecture == '2:5:5:1') {
            getArchitect = new Architect.LSTM(2, 5, 5, 1);
        } else if (rawNNArchitecture == '3:1') {
            getArchitect = new Architect.LSTM(3, 1);
        } else if (rawNNArchitecture == '3:3:1') {
         //   getArchitect = new Architect.LSTM(3, 3, 1);
            getArchitect = new Architect.Perceptron(3, 3, 1);
        } else if (rawNNArchitecture == '3:3:3:1') {
        //    getArchitect = new Architect.LSTM(3, 3, 3, 1);
            getArchitect = new Architect.Perceptron(3, 3, 3, 1);
        } else if (rawNNArchitecture == '3:5:5:1') { */
           // getArchitect = new Architect.LSTM(4, 4, 4, 1);
            getArchitect = new Architect.Perceptron(4, 4, 4, 1);
     //   } 


        neuralNet = getArchitect;
        NNArchitecture = rawNNArchitecture;
        trainer = new Trainer(neuralNet);


        //   console.log("raw NN architecture: " + rawNNArchitecture);

        //  console.log("SIZE OF UNPROCESSED SESSION DATA: " + processedDataSession.length);

        for (var i = 0; i < processedDataSession.length; i++) {

            var currentSample = processedDataSession[i];
            var outputArray = new Array(1).fill(0);
            var inputArray = new Array(2).fill(0);

            outputArray[0] = currentSample[12]; //true or false

            inputArray[0] = currentSample[1];
            inputArray[1] = currentSample[2];

            if (numInputs > 2) inputArray[2] = currentSample[3];
            if (numInputs > 3) inputArray[3] = currentSample[4];

            //make sure we are in bounds of normalization
	        for(var k = 0; k < numInputs; k++){
	        	if(inputArray[k] > 1) inputArray[k] = 1;
	        	if(inputArray[k] < 0) inputArray[k] = 0;
	        }

            trainingData.push({
                input: inputArray,
                output: outputArray
            });

            console.log(currentSample + " TRAINING INPUT: " + inputArray);
            console.log(currentSample + " TRAINING OUTPUT: " + outputArray);
        }



            console.log("TRAINING interations:" + nnIterations + "  error:" + nnError + "  rate:" + nnRate + "  arch:" + rawNNArchitecture + "  inputs:" + numInputs);

            trainer.train(trainingData, {
                rate: nnRate,
                //   iterations: 15000,
                iterations: nnIterations,
                error: nnError,
                shuffle: true,
                //   log: 1000,
                log: 5,
                cost: Trainer.cost.CROSS_ENTROPY
            });

            //we have a trained NN to use
            haveNNFlag = true;
            trainNNFlag = false;
            $('#activate-btn').addClass("haveNN");
            $('#export-btn').addClass("haveNN");

      
    }


    /*******************************************************************************************************************
     ******************************************* NEURAL NETWORK BUTTONS *************************************************
     ********************************************************************************************************************/
    $('#train-btn').click(function() {
        console.log("train button");
        trainNNFlag = true;
        trainNN();
    });

    $('#activate-btn').click(function() {
        console.log("activate button");
        activeNNFlag = true;
        $('#activate-btn').toggleClass("activatedNN");
    });


    /*******************************************************************************************************************
     ********************************** COLLECT, PRINT, LOAD BUTTON ACTIONS *********************************************
     ********************************************************************************************************************/

    /*************** COLLECT SAMPLE - SONSOR AND MODEL DATA - STORE IN GSHEET AND ADD TO NN TRAINING OBJECT *****************/
    $('#collect-true').click(function() {
        //how many samples for this set?
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 1;
        console.log("Collect btn NN T #samples flag: " + getSamplesFlag);
    });

    $('#collect-false').click(function() {
        //how many samples for this set?
        //this flag is applied in the bluetooth data notification function
        getSamplesFlag = $('input.sample-size').val();
        getSamplesTypeFlag = 2;
        console.log("Collect btn NN F #samples flag: " + getSamplesFlag);
    });


    $('#clear').click(function() {
        clearData();
    });

    function clearData(){
        NNTrueDataArray = new Array;
        NNFalseDataArray = new Array;
        sensorDataArray = new Array(18).fill(0);
        sensorDataSession = new Array;
        $('.message-nn-true').html('');
        $('.message-nn-false').html('');
        $("#dump-print").html("");
        console.log("Clear NN Data");
    }


    $('#export-btn').click(function() {
        console.log("export NN button");
        //clear everything but key values from stored NN
        neuralNet.clear();

        //export optimized weights and activation function
        var standalone = neuralNet.standalone();

        //convert to string for parsing
        standalone = standalone.toString();

        console.log(standalone);
        $("#dump-print").html(standalone);
        $("#dump-print").addClass("active-print");
    });

    $('#true-test-data').click(function() {
        console.log("true test data button");
        $('#true-test-data').addClass('active-data');
        $('#connect','#false-test-data').removeClass('active-data');

        //load and run test data
        runData();
    });

    $('#false-test-data').click(function() {
        console.log("false test data button");
        $('#false-test-data').addClass('active-data');
        $('#connect','#true-test-data').removeClass('active-data');

        //load and run test data
        runData();
    });

    function runData(){

        let runTimeData;
        let currentDataType;
        let runIndex = 0;
        let testDataLength = 0;

        var runDataHandle = setInterval(function() {

            //are we using test data, and if so what data
            if ( $('#true-test-data').hasClass('active-data') ){
                runTimeData = eegTestData;
                testDataLength = eegTestData.length;
                currentDataType = 'test-true';
            }else if( $('#false-test-data').hasClass('active-data') ){
                runTimeData = eegTestData;
                testDataLength = eegTestData.length;
                currentDataType = 'test-false';
            } else{
                clearInterval(runDataHandle);
                return;
            }

            timeStamp = new Date().getTime();

            if(runIndex >= testDataLength){ runIndex = 0; } else { runIndex++; }

            //load data into global array
            sensorDataArray = new Array(6).fill(0);

            sensorDataArray[0] = runTimeData[runIndex][0].toFixed(3);
            sensorDataArray[1] = runTimeData[runIndex][1].toFixed(3);
            sensorDataArray[2] = runTimeData[runIndex][2].toFixed(3);
            sensorDataArray[3] = runTimeData[runIndex][3].toFixed(3);
            sensorDataArray[4] = runTimeData[runIndex][4].toFixed(3);
            sensorDataArray[5] = 0;       
            sensorDataArray[6] = timeStamp;
          
            //update time series chart with normalized values
            var rawDeltaChart = sensorDataArray[0];
            var rawThetaChart = sensorDataArray[1];
            var rawAlphaChart = sensorDataArray[2];
            var rawBetaChart  = sensorDataArray[3];
            var rawEMGChart  =  sensorDataArray[4];

            //sensor values in bottom 2/3 of chart , 1/10 height each
            rawDeltaChart = (rawDeltaChart / 0.5) + 2 * 0.1;
            rawThetaChart = (rawThetaChart / 0.5) + 1 * 0.1;
            rawAlphaChart = (rawAlphaChart / 0.5) + 0 * 0.1;
            rawBetaChart  = (rawBetaChart  / 4) + 6 * 0.1;
            rawEMGChart  = (rawEMGChart  / 3) + 4 * 0.1;

            lineDelta.append(timeStamp, rawDeltaChart);
            lineTheta.append(timeStamp, rawThetaChart);
            lineAlpha.append(timeStamp, rawAlphaChart);
            lineBeta.append(timeStamp, rawBetaChart);
            lineEMG.append(timeStamp, rawEMGChart);

            //if data sample collection has been flagged
            if (getSamplesFlag > 0) {
                collectData();
            } else if (trainNNFlag) {
                //don't do anything
            } else {
                if (haveNNFlag && activeNNFlag) { //we have a NN and we want to apply to current sensor data
                    getNNScore();
                } 
            }

            displayData();
            bluetoothDataFlag = false;

        }, 200); // throttle 200 = 5Hz limit
    }

     /*******************************************************************************************************************
     *********************************************** SLIDER UI ******************************************************
     ********************************************************************************************************************/
    var rangeSlider = function(){
        var slider = $('.range-slider'),
            range = $('.range-slider__range'),
            value = $('.range-slider__value');
          
        slider.each(function(){

        value.each(function(){
            var value = $(this).prev().attr('value');
            $(this).html(value);
        });

        if( $(this).hasClass('nn-architecture') ){ $('.range-slider__value.nn-architecture').html('4:4:4:1'); }

        range.on('input', function(){
            var labels = ['2:1', '3:4:4:1', '4:1', '4:4:1', '4:3:3:1', '4:4:4:1'];
            $(this).next(value).html(this.value);

            if( $(this).hasClass('nn-architecture') ){ $(this).next(value).html( labels[this.value] ); }
          
          });
        });
    }

    rangeSlider();

    //RANGE SLIDER EVENT HANDLER
    $( ".range-slider" ).each(function() {

        if($(this).hasClass("nn-architecture")){
            // Add labels to slider whose values 
            // are specified by min, max and whose
            // step is set to 1
            
            // Get the options for this slider
            //var opt = $(this).data().uiSlider.options;
            // Get the number of possible values
            var $input = $(this).find("input");
            var min = parseInt($input.attr("min"));
            var max = parseInt($input.attr("max"));
            var step = parseInt($input.attr("step"));
            var increment = parseInt($input.attr("increment"));
            var vals = max - min; //opt.max - opt.min;
            //if(min < 0){ vals = max + min; }
            var labels = ['2:1', '3:4:4:1', '4:1', '4:3:1', '4:3:3:1', '4:4:4:1'];
            
            // Space out values
            for (var i = 0; (i * increment) <= vals; i++) {
                var s = min + (i * increment);
                var el = $('<label>'+ labels[s] +'</label>').css('left',( 4 + Math.abs((s-min)/vals) *($input.width() -24)+'px'));
                //   var el = $('<label>'+ s +'</label>').css('left',( 3 + ((s-min)/vals) *($input.width() -24)+'px'));
                if(s == 0){ el = $('<label>'+ labels[s] +'</label>').css('left',( 21 + Math.abs((s-min)/vals) *($input.width() -24)+'px')); }
                if(s == vals){ el = $('<label>'+ labels[s] +'</label>').css('left',( -20 + Math.abs((s-min)/vals) *($input.width() -24)+'px')); }
                $(this).append(el);
            }
        }  
    });

    //TEST DATA AUTOMATICALLY LOADS WHEN SITE LOADS
    $(document).ready(function() {
        $('#true-test-data').addClass('active-data');
        $('#connect','#false-test-data').removeClass('active-data');

        //load and run test data
        runData();
    });

}); // end on document load
