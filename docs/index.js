var zg,
    _config = {
        "appid": 229059616,
        "idName": new Date().getTime() + '',
        "nickName": 'u' + new Date().getTime(),
        "server": "wss://wsliveroom229059616-api.zego.im:8282/ws",
        "logLevel": 0,
        "logUrl": "",
        "remoteLogLevel": 0
    },
    loginRoom = false;
    previewVideo,
    useLocalStreamList = [];

function init() {

    zg = new ZegoClient();

    console.log("config param:" + JSON.stringify(_config));

    zg.config(_config);

    enumDevices();
}


function enumDevices() {
    var  audioInputList = [],videoInputList = [];
    zg.enumDevices(deviceInfo => {
        console.log('enumDevices' + JSON.stringify(deviceInfo));
        if (deviceInfo.microphones) {
            for (let i = 0; i < deviceInfo.microphones.length; i++) {

                if (!deviceInfo.microphones[i].label) {
                    deviceInfo.microphones[i].label = 'microphone' + i;
                }
                audioInputList.push(' <option value="'+deviceInfo.microphones[i].deviceId+'">'+deviceInfo.microphones[i].label+'</option>');
                console.log("microphone: " + deviceInfo.microphones[i].label);
            }
        }

        if (deviceInfo.cameras) {
            for (let i = 0; i < deviceInfo.cameras.length; i++) {
                if (!deviceInfo.cameras[i].label) {
                    deviceInfo.cameras[i].label = 'camera' + i;
                }
                videoInputList.push('<option value="'+deviceInfo.cameras[i].deviceId+'">'+deviceInfo.cameras[i].label+'</option>');
                console.log("camera: " + deviceInfo.cameras[i].label);
            }
        }

        $('#audioList').html(audioInputList.join(''));
        $('#videoList').html(videoInputList.join(''));
    }, function (error) {
        console.error("enum device error: " + error);
    });
}


function openRoom(roomId) {

    if (!roomId) alert('请输入房间号');

    //get token
    $.get("https://wsliveroom229059616-api.zego.im:8282/token", {app_id: _config.appid, id_name: _config.idName},
        function (token) {
            if (!token) {
                alert('get token failed')
            } else {
                startLogin(token)
            }
        }, 'text');


    //login
    function startLogin(token) {
        zg.login(roomId, 2, token, function (streamList) {
            loginSuccess(streamList);
        }, function (err) {
            loginFailed(err);
        })
    }

    function loginFailed(err) {
        alert('登录失败');
        console.error(err)

    }

    function loginSuccess(streamList) {

        //限制房间最多人数，原因：视频软解码消耗cpu，浏览器之间能支撑的个数会有差异，太多会卡顿
        if (streamList.length >= 4) {
            alert('房间太拥挤，换一个吧！');
            leaveRoom();
            return;
        }

        useLocalStreamList = streamList;

        $('.remoteVideo').html('')
        for(var index=0;index<useLocalStreamList.length;index++){
            $('.remoteVideo').append($('<video  autoplay muted playsinline></video>') );
            play(useLocalStreamList[index].stream_id,$('.remoteVideo video:eq('+index+')')[0]);
        }
        console.log(`login success`);

        loginRoom = true;

        // 监听sdk回掉
        listen();

        //开始预览本地视频
        doPreviewPublish();

    }


    //预览
    function doPreviewPublish() {
        var previewConfig = {
            "audio": true,
            "audioInput": null,
            "video": true,
            "videoInput": null,
            "videoQuality": 2,
            "horizontal": true
        };
        var result = zg.startPreview(previewVideo, previewConfig, function () {
            console.log('preview success');
            publish();
            //部分浏览器会有初次调用摄像头后才能拿到音频和视频设备label的情况，
            enumDevices();
        }, function (err) {
            console.error('preview failed', err);
        });

        if (!result) alert('预览失败！')
    }

    //推流
    function publish() {
        zg.startPublishingStream(_config.idName, previewVideo);
    }

    function play(streamId, video) {
        var result = zg.startPlayingStream(streamId, video);


        if (!result) {
            alert('哎呀，播放失败啦');
            video.style = 'display:none';
            console.error("play " + el.nativeElement.id + " return " + result);

        }
    }


    function listen() {
        var _config = {
            onPlayStateUpdate: function (type, streamid, error) {
                if (type == 0) {
                    console.info('play  success');
                }
                else if (type == 2) {
                    console.info(` play retry`);
                } else {

                    console.error("play error " + error.msg);

                    var _msg = error.msg;
                    if (error.msg.indexOf('server session closed, reason: ') > -1) {
                        var code = error.msg.replace('server session closed, reason: ', '');
                        if (code == 21) {
                            _msg = '音频编解码不支持(opus)';
                        } else if (code == 22) {
                            _msg = '视频编解码不支持(H264)'
                        } else if (code == 20) {
                            _msg = 'sdp 解释错误';
                        }
                    }
                    alert('拉流失败,reason = ' + _msg);
                }

            },
            onPublishStateUpdate: function (type, streamid, error) {
                if (type == 0) {
                    console.info(` publish  success`);
                } else if (type == 2) {
                    console.info(` publish  retry`);
                } else {
                    // trace("publish " + streamid + "error " + error.code);

                    console.errors(` publish error ${error.msg}`);
                    var _msg = error.msg;
                    if (error.msg.indexOf('server session closed, reason: ') > -1) {
                        var code = error.msg.replace('server session closed, reason: ', '');
                        if (code == 21) {
                            _msg = '音频编解码不支持(opus)';
                        } else if (code == 22) {
                            _msg = '视频编解码不支持(H264)'
                        } else if (code == 20) {
                            _msg = 'sdp 解释错误';
                        }
                    }
                    alert('推流失败,reason = ' + _msg);

                }

            },
            onPublishQualityUpdate: function (streamid, quality) {
                console.info("#" + streamid + "#" + "publish " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
            },

            onPlayQualityUpdate: function (streamid, quality) {
                console.info("#" + streamid + "#" + "play " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
            },

            onDisconnect: function (error) {
                console.errors("onDisconnect " + JSON.stringify(error));
                alert('网络连接已断开' + JSON.stringify(error));
                leaveRooom();
            },

            onKickOut: function (error) {
                console.error("onKickOut " + JSON.stringify(error));
            },

            onStreamExtraInfoUpdated: function (streamList) {

            },

            onVideoSizeChanged: function (streamid, videoWidth, videoHeight) {
                console.info("#" + streamid + "#" + "play " + " : " + videoWidth + "x" + videoHeight);
            },

            onStreamUpdated: function (type, streamList) {
                if (type == 0) {
                    for (var i = 0; i < streamList.length; i++) {
                        console.info(streamList[i].stream_id + ' was added');
                        useLocalStreamList.push(streamList[i]);
                        $('.remoteVideo').append($('<video  autoplay muted playsinline></video>') );
                        play(streamList[i].stream_id, $('.remoteVideo video:last-child')[0]);
                    }

                } else if (type == 1) {

                    for (var k = 0; k < useLocalStreamList.length; k++) {

                        for (var j = 0; j < streamList.length; j++) {

                            if (useLocalStreamList[k].stream_id === streamList[j].stream_id) {

                                zg.stopPlayingStream(useLocalStreamList[k].stream_id);

                                console.info(useLocalStreamList[k].stream_id + 'was devared');

                                useLocalStreamList.splice(k, 1);

                                $('.remoteVideo video:eq('+k+')').remove();

                                break;
                            }
                        }
                    }
                }

            },
            onUserStateUpdate: function (roomId, userList) {
                console.info("onUserStateUpdate = " + roomId + JSON.stringify(userList));
            }
        }

        for (var key in _config) {
            zg[key] = _config[key]
        }

    }
}


function leaveRoom() {
   console.info('leave room  and close stream');

    zg.stopPreview(previewVideo);

    zg.stopPublishingStream(_config.idName);

    for (var i = 0; i < useLocalStreamList.length; i++) {
         zg.stopPlayingStream(useLocalStreamList[i].stream_id);
    }

    $('.remoteVideo').html('');
    zg.logout();
}

$(function () {

    previewVideo = $('#previewVideo')[0];

    //初始化sdk
    init();

    $('#openRoom').click(function () {
        openRoom($('#roomId').val());
    })

    $('#leaveRoom').click(function () {
        leaveRoom();
    });
});