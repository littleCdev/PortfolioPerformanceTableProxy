var request = require('request');
var cfg     = require("../config.json");

var SEARCHURL = "https://www.onvista.de/fonds/%ISIN%"
var URL = "http://www.onvista.de/fonds/kurshistorie.html?ID_NOTATION=%NOTATIONID%&RANGE=36M";
var TABLE = "<table>\n" +
    "    <thead>\n" +
    "        <tr>\n" +
    "            <th>Datum</th>\n" +
    "            <th>Close</th>\n" +
    "            <th>Tageshoch</th>\n" +
    "            <th>Tagestief</th>\n" +
    "        </tr>\n" +
    "    </thead>\n" +
    "    <tbody>\n" +
    "        %BODY%\n" +
    "    </tbody>\n" +
    "</table>";

var ROW = "<tr>" +
    "<td>%DATE%</td>" +
    "<td>%PRICE%</td>" +
    "<td>%PRICE%</td>" +
    "<td>%PRICE%</td>" +
    "</tr>";

function getIdNotation(isin,callback) {
     var sUrl = SEARCHURL.replace(/%ISIN%/gi,isin);
    var req;
    if(cfg.proxy.useproxy){
        console.log("proxy");
        var proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }

    req(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if(response === undefined || response.statusCode !== 200){
            callback("ERROR");
            return;
        }
        var regex = /data-notation="(.+)"/gmi;
        var x = body.match(regex);

        if(x.length !== 1){
            callback("error");
            return;
        }

        var html = x[0];

        var notationId = html.replace("data-notation=","").replace(/"/gi,"");

        console.log(notationId);

        callback(null,notationId);
    });
}

function getDataFromTable(res,notationId) {

    var sUrl = URL.replace(/%NOTATIONID%/gi,notationId);
    var req;
    if(cfg.proxy.useproxy){
        var proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }

    req(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if(response.statusCode !== 200){
            res.send("ERROR");
            return;
        }

        var sTableBody = "";
        var sHtml = body;
        var regex = /<td>([0-9]{2}.[0-9]{2}.[0-9]{2})<\/td><td>([0-9]+,[0-9]+)<\/td>/gim;
        var match, results = [];
        while (match = regex.exec(sHtml)) {
            sTableBody += ROW.replace(/%DATE%/ig,match[1]).replace(/%PRICE%/ig,match[2]);
        }
        var table = TABLE.replace(/%BODY%/ig,sTableBody);

        res.send(table);

    });

}

exports.getCreateTable = function (res,isin) {
    getIdNotation(isin,function (err,notationId) {
        if(err !== null){
            res.send("ERROR");
            return;
        }
        getDataFromTable(res,notationId);
    });
};

